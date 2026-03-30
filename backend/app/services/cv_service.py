# -*- coding: utf-8 -*-
"""
Servicio para análisis de CVs.
Extrae texto de PDFs y usa Claude para convertirlo en un perfil estructurado.
"""
import io
import json
import re
from typing import Optional

from fastapi import HTTPException, UploadFile

import anthropic

from app.services.ai_cost_service import record_ai_api_cost

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_CONTENT_TYPES = {"application/pdf"}
CV_AI_MODEL = "claude-haiku-4-5-20251001"

# Mapa seniority del CV a string de años para el sistema de matching
_SENIORITY_TO_YEARS = {
    "junior": "1",
    "mid": "3",
    "senior": "6",
    "lead": "8",
    "desconocido": "2",
}


def validate_cv_upload(file: UploadFile) -> None:
    """Valida tipo MIME y nombre de fichero antes de leer el contenido."""
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Solo se aceptan ficheros PDF. Para otros formatos (DOCX, etc.) estaréis al corriente próximamente.",
        )
    # Sanitización básica del nombre de fichero
    filename = file.filename or ""
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="El fichero debe tener extensión .pdf.")


async def read_and_validate_content(file: UploadFile) -> bytes:
    """Lee el contenido del fichero ya validado en tipo."""
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="El fichero está vacío.")
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"El fichero supera el límite de 5 MB. Sube un CV más compacto.",
        )
    return content


def extract_text_from_pdf(content: bytes) -> str:
    """Extrae texto plano de bytes PDF usando pypdf."""
    try:
        from pypdf import PdfReader  # type: ignore
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="Librería de extracción PDF no disponible. Contacta con el administrador.",
        )

    try:
        reader = PdfReader(io.BytesIO(content))
    except Exception:
        raise HTTPException(
            status_code=422,
            detail="No se pudo leer el PDF. Asegúrate de que no está protegido con contraseña.",
        )

    parts: list[str] = []
    for page in reader.pages:
        try:
            text = page.extract_text() or ""
            if text.strip():
                parts.append(text.strip())
        except Exception:
            continue

    full_text = "\n\n".join(parts).strip()
    if not full_text:
        raise HTTPException(
            status_code=422,
            detail="El PDF no contiene texto extraíble. Prueba con un CV en formato texto (no escaneado).",
        )
    return full_text


def _truncate_cv_text(text: str, max_chars: int = 9000) -> str:
    """Trunca el texto del CV para no exceder el contexto del modelo."""
    if len(text) <= max_chars:
        return text
    head = text[: max_chars * 2 // 3].rstrip()
    tail = text[-(max_chars // 3) :].lstrip()
    return f"{head}\n...\n{tail}"


def _extract_json_from_response(raw: str) -> dict:
    """Extrae el JSON del texto de respuesta de Claude (maneja bloques markdown)."""
    cleaned = (raw or "").strip()
    if cleaned.startswith("```"):
        parts = cleaned.split("```", 2)
        if len(parts) >= 2:
            cleaned = parts[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.strip()
    # Intento directo
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Busca el primer objeto JSON en el texto
        match = re.search(r"\{[\s\S]+\}", cleaned)
        if match:
            return json.loads(match.group())
        raise


def _sanitize_structured_profile(raw: dict) -> dict:
    """Limpia y normaliza el perfil estructurado devuelto por Claude."""
    def safe_str(val, fallback="desconocido") -> str:
        if val is None:
            return fallback
        s = str(val).strip()
        return s if s else fallback

    def safe_list(val, max_items=20) -> list[str]:
        if not isinstance(val, list):
            return []
        result = []
        for item in val[:max_items]:
            s = str(item or "").strip()
            if s:
                result.append(s)
        return result

    def safe_list_dicts(val, max_items=10) -> list[dict]:
        if not isinstance(val, list):
            return []
        result = []
        for item in val[:max_items]:
            if isinstance(item, dict):
                result.append(item)
        return result

    seniority_raw = safe_str(raw.get("seniority"), "desconocido")
    valid_seniorities = {"junior", "mid", "senior", "lead", "desconocido"}
    seniority = seniority_raw if seniority_raw in valid_seniorities else "desconocido"

    years_raw = raw.get("years_experience")
    years: Optional[int] = None
    if isinstance(years_raw, (int, float)) and years_raw >= 0:
        years = int(years_raw)
    elif isinstance(years_raw, str):
        m = re.search(r"\d+", years_raw)
        if m:
            years = int(m.group())

    return {
        "full_name": safe_str(raw.get("full_name"), None),
        "target_roles": safe_list(raw.get("target_roles"), 6),
        "seniority": seniority,
        "years_experience": years,
        "skills": safe_list(raw.get("skills"), 30),
        "languages": safe_list_dicts(raw.get("languages"), 8),
        "education": safe_list_dicts(raw.get("education"), 5),
        "certifications": safe_list(raw.get("certifications"), 10),
        "preferred_locations": safe_list(raw.get("preferred_locations"), 6),
        "work_modalities": safe_list(raw.get("work_modalities"), 4),
        "summary": safe_str(raw.get("summary"), ""),
    }


async def analyze_cv_with_ai(text: str, api_key: str, user_id: Optional[int] = None) -> tuple[dict, object]:
    """
    Llama a Claude para convertir el texto del CV en un perfil estructurado.
    Devuelve (structured_profile, usage) donde usage es el objeto de tokens de Anthropic.
    """
    client = anthropic.Anthropic(api_key=api_key)

    system_prompt = (
        "Eres un experto en análisis de CVs del sector tecnológico español. "
        "Extraes información de CVs y la estructuras en JSON válido. "
        "Nunca inventas datos. Si falta información, usas null, [] o 'desconocido'. "
        "Respondes ÚNICAMENTE con el JSON, sin texto adicional ni bloques markdown."
    )

    user_prompt = f"""Analiza este CV y devuelve un JSON con exactamente esta estructura:

{{
  "full_name": "nombre completo o null",
  "target_roles": ["rol objetivo 1", "rol objetivo 2"],
  "seniority": "junior|mid|senior|lead|desconocido",
  "years_experience": número entero o null,
  "skills": ["Python", "React", "Docker"],
  "languages": [{{"language": "Inglés", "level": "nativo|avanzado|intermedio|básico"}}],
  "education": [{{"degree": "título", "institution": "centro", "year": 2020}}],
  "certifications": ["AWS Certified Developer"],
  "preferred_locations": ["Madrid", "Barcelona"],
  "work_modalities": ["Remoto", "Híbrido", "Presencial"],
  "summary": "resumen profesional de 2-3 frases en español"
}}

Reglas:
- skills: lista completa de tecnologías, lenguajes, frameworks y herramientas que aparezcan
- target_roles: infiere los roles más relevantes según la experiencia (ej: "Backend Developer", "Data Engineer")
- seniority: infiere de años totales de experiencia y responsabilidades (junior <2, mid 2-5, senior 5+, lead si gestiona equipos)
- years_experience: años totales de experiencia laboral relevante en tecnología
- preferred_locations: extrae si aparecen, o deja []
- work_modalities: usa exactamente "Remoto", "Híbrido" o "Presencial" si aparecen, o deja []

CV:
{_truncate_cv_text(text)}"""

    try:
        response = client.messages.create(
            model=CV_AI_MODEL,
            max_tokens=2000,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
    except anthropic.APIStatusError as exc:
        if exc.status_code == 429:
            raise HTTPException(
                status_code=429,
                detail="Límite de API de Claude alcanzado. Inténtalo en unos minutos.",
            )
        raise HTTPException(status_code=502, detail=f"Error de Claude API: {exc.message}")

    raw_text = response.content[0].text if response.content else ""

    try:
        raw_profile = _extract_json_from_response(raw_text)
    except (json.JSONDecodeError, Exception):
        raise HTTPException(
            status_code=502,
            detail="La IA no pudo procesar el CV correctamente. Inténtalo de nuevo.",
        )

    profile = _sanitize_structured_profile(raw_profile)

    # Registrar coste IA
    try:
        import os
        from app.database import get_session_local
        SessionLocal = get_session_local()
        if SessionLocal:
            db_cost = SessionLocal()
            try:
                record_ai_api_cost(
                    db=db_cost,
                    feature="cv_analysis",
                    model=CV_AI_MODEL,
                    usage=response.usage,
                    user_id=user_id,
                )
                db_cost.commit()
            finally:
                db_cost.close()
    except Exception as e:
        print(f"[CV_COST] Error registrando coste: {e}")

    return profile, response.usage


def build_matching_profile(structured_profile: dict) -> dict:
    """
    Convierte el perfil estructurado del CV al formato de ProfileRequest
    que espera el sistema de matching existente.
    """
    skills = structured_profile.get("skills") or []
    languages = structured_profile.get("languages") or []
    preferred_locations = structured_profile.get("preferred_locations") or []
    work_modalities = structured_profile.get("work_modalities") or []
    seniority = structured_profile.get("seniority") or "desconocido"
    years = structured_profile.get("years_experience")

    # Experiencia: preferimos años exactos; si no, inferimos de seniority
    if years is not None:
        experience = str(years)
    else:
        experience = _SENIORITY_TO_YEARS.get(seniority, "2")

    # Idioma inglés para el campo legacy `english`
    english_level = ""
    idiomas_list: list[dict] = []
    for lang in languages:
        lang_name = str(lang.get("language") or "").strip()
        lang_level = str(lang.get("level") or "").strip().lower()
        if not lang_name:
            continue
        # Normalizar nivel al formato del sistema (basico/intermedio/avanzado/nativo)
        if lang_level in ("nativo", "native", "c2"):
            normalized_level = "nativo"
        elif lang_level in ("avanzado", "advanced", "c1", "b2"):
            normalized_level = "avanzado"
        elif lang_level in ("intermedio", "intermediate", "b1"):
            normalized_level = "intermedio"
        else:
            normalized_level = "basico"

        idiomas_list.append({"idioma": lang_name, "nivel": normalized_level})

        name_lower = lang_name.lower()
        if "ingl" in name_lower or "english" in name_lower:
            english_level = normalized_level

    # Normalizar modalidades al formato del sistema
    _MODALITY_MAP = {
        "remoto": "Remoto",
        "remote": "Remoto",
        "teletrabajo": "Remoto",
        "híbrido": "Híbrido",
        "hibrido": "Híbrido",
        "hybrid": "Híbrido",
        "presencial": "Presencial",
        "onsite": "Presencial",
    }
    normalized_modalities: list[str] = []
    for mod in work_modalities:
        key = mod.strip().lower().replace("í", "i")
        normalized = _MODALITY_MAP.get(key, mod.strip())
        if normalized not in normalized_modalities:
            normalized_modalities.append(normalized)

    return {
        "experience": experience,
        "stack": skills[:25],
        "english": english_level or "intermedio",
        "ubicaciones": preferred_locations,
        "modalidad": normalized_modalities,
        "idiomas": idiomas_list,
    }


def build_adzuna_search_params(structured_profile: dict) -> tuple[list[str], list[str]]:
    """
    Genera los parámetros de búsqueda en Adzuna a partir del perfil del CV.
    Devuelve (skills_para_buscar, locations_para_buscar).
    """
    skills = structured_profile.get("skills") or []
    roles = structured_profile.get("target_roles") or []
    locations = structured_profile.get("preferred_locations") or []

    # Adzuna recibe las habilidades como términos de búsqueda.
    # Usamos los primeros skills + primeros roles como queries.
    search_terms = skills[:10]
    if roles:
        # Añadir el primer rol como término adicional de búsqueda
        search_terms = list({*search_terms, roles[0]})[:12]

    return search_terms, locations
