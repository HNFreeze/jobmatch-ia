# -*- coding: utf-8 -*-
"""
Servicio para análisis de CVs.
Extrae texto de PDFs y usa Claude para convertirlo en un perfil estructurado.
"""
import hashlib
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


async def improve_cv_with_ai(text: str, api_key: str, user_id: Optional[int] = None) -> tuple[dict, object]:
    """
    Llama a Claude para mejorar el CV en base a criterios ATS.
    Devuelve (improvement_result, usage).
    """
    client = anthropic.Anthropic(api_key=api_key)

    system_prompt = (
        "Eres un experto en CVs optimizados para ATS (Applicant Tracking Systems) con 15 años de experiencia "
        "en selección de personal en el sector tecnológico español. "
        "Analizas CVs y los mejoras siguiendo las mejores prácticas ATS: palabras clave, formato limpio, "
        "verbos de acción, métricas cuantificables y estructura clara. "
        "Respondes ÚNICAMENTE con JSON válido, sin texto adicional ni bloques markdown."
    )

    user_prompt = f"""Analiza este CV y devuelve un JSON con exactamente esta estructura:

{{
  "ats_score_before": número entero 0-100,
  "ats_score_after": número entero 0-100,
  "summary_improved": "resumen profesional reescrito y optimizado para ATS (3-4 frases con palabras clave del sector)",
  "key_improvements": ["mejora concreta 1", "mejora concreta 2"],
  "keywords_to_add": ["keyword1", "keyword2"],
  "format_suggestions": ["sugerencia de formato 1", "sugerencia de formato 2"],
  "experience_bullets": ["• Logro reescrito con verbo de acción + métrica 1", "• Logro reescrito 2"],
  "skills_section": "sección de habilidades reorganizada por categorías",
  "critical_issues": ["problema crítico ATS 1", "problema crítico 2"]
}}

Reglas:
- ats_score_before: evalúa el CV original (0=muy malo, 100=perfecto ATS). Considera: palabras clave, formato limpio, secciones definidas, verbos de acción, métricas
- ats_score_after: puntuación estimada DESPUÉS de aplicar las mejoras (siempre >= before)
- summary_improved: reescribe el resumen con palabras clave del sector tecnológico
- key_improvements: 4-6 mejoras concretas aplicadas
- keywords_to_add: 5-10 palabras clave técnicas que faltan y deberían añadirse
- format_suggestions: 3-5 sugerencias de formato para mejorar legibilidad ATS (evitar tablas, columnas, headers con imágenes)
- experience_bullets: 3-5 ejemplos de logros reescritos con verbos de acción (Desarrollé, Lideré, Incrementé, Reduje, Implementé) y métricas
- skills_section: texto sugerido para sección de habilidades agrupado por categorías (Lenguajes, Frameworks, Cloud, etc.)
- critical_issues: 2-4 problemas que actualmente reducen la visibilidad en ATS

CV a analizar:
{_truncate_cv_text(text)}"""

    try:
        response = client.messages.create(
            model=CV_AI_MODEL,
            max_tokens=3000,
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
        raw_result = _extract_json_from_response(raw_text)
    except (json.JSONDecodeError, Exception):
        raise HTTPException(
            status_code=502,
            detail="La IA no pudo analizar el CV correctamente. Inténtalo de nuevo.",
        )

    result = _sanitize_improve_result(raw_result)

    try:
        from app.database import get_session_local
        SessionLocal = get_session_local()
        if SessionLocal:
            db_cost = SessionLocal()
            try:
                record_ai_api_cost(
                    db=db_cost,
                    feature="cv_improve",
                    model=CV_AI_MODEL,
                    usage=response.usage,
                    user_id=user_id,
                )
                db_cost.commit()
            finally:
                db_cost.close()
    except Exception as e:
        print(f"[CV_IMPROVE_COST] Error registrando coste: {e}")

    return result, response.usage


def _sanitize_improve_result(raw: dict) -> dict:
    """Normaliza la respuesta de mejora de CV de Claude."""
    def safe_int(val, default: int, lo: int = 0, hi: int = 100) -> int:
        try:
            return max(lo, min(hi, int(val)))
        except (TypeError, ValueError):
            return default

    def safe_list_str(val, max_items: int = 20) -> list[str]:
        if not isinstance(val, list):
            return []
        return [str(x).strip() for x in val[:max_items] if str(x).strip()]

    def safe_str(val, fallback: str = "") -> str:
        s = str(val or "").strip()
        return s if s else fallback

    score_before = safe_int(raw.get("ats_score_before"), 40)
    score_after = max(safe_int(raw.get("ats_score_after"), score_before + 20), score_before)

    return {
        "ats_score_before": score_before,
        "ats_score_after": score_after,
        "summary_improved": safe_str(raw.get("summary_improved")),
        "key_improvements": safe_list_str(raw.get("key_improvements"), 8),
        "keywords_to_add": safe_list_str(raw.get("keywords_to_add"), 15),
        "format_suggestions": safe_list_str(raw.get("format_suggestions"), 6),
        "experience_bullets": safe_list_str(raw.get("experience_bullets"), 8),
        "skills_section": safe_str(raw.get("skills_section")),
        "critical_issues": safe_list_str(raw.get("critical_issues"), 5),
    }


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


def hash_cv_text(text: str) -> str:
    """SHA-256 del texto del CV para caching."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


async def improve_cv_full(
    text: str,
    api_key: str,
    user_id: Optional[int] = None,
) -> tuple[dict, object]:
    """
    Llama a Claude para:
    1. Analizar el CV (ATS score + problemas)
    2. Generar el texto COMPLETO del CV mejorado
    Devuelve (full_result_dict, usage).

    full_result_dict contiene:
      ats_score_before, ats_score_after, problems_detected,
      key_improvements, keywords_to_add, improved_cv_text
    """
    client = anthropic.Anthropic(api_key=api_key)

    system_prompt = (
        "Eres un experto en CVs optimizados para ATS con 15 años en selección técnica española. "
        "Tu tarea es analizar un CV y devolver ÚNICAMENTE un JSON válido con el análisis y el CV mejorado completo. "
        "Sin texto adicional, sin bloques markdown. "
        "NUNCA inventas información: solo reorganizas, mejoras la redacción y optimizas para ATS. "
        "Todo el texto del CV mejorado debe estar en español, con tildes y ñ correctamente escritas."
    )

    user_prompt = f"""Analiza este CV y devuelve un JSON con EXACTAMENTE esta estructura:

{{
  "ats_score_before": número 0-100 (evaluación del CV original),
  "ats_score_after": número 0-100 (estimación tras las mejoras, siempre >= before),
  "problems_detected": [
    {{"category": "keywords|structure|verbos|metrics|format", "description": "descripción del problema en español"}}
  ],
  "key_improvements": ["mejora aplicada 1 en español", "mejora aplicada 2"],
  "keywords_to_add": ["keyword1", "keyword2"],
  "improved_cv_text": "TEXTO COMPLETO DEL CV MEJORADO en el formato indicado abajo"
}}

FORMATO OBLIGATORIO para improved_cv_text (usa EXACTAMENTE estos marcadores de sección):

NAME: [Nombre completo del candidato tal como aparece en el CV]
TITLE: [Título profesional optimizado para ATS en español]

RESUMEN
[3-4 frases de perfil profesional en español con keywords del sector, verbos de impacto y métricas reales del CV]

EXPERIENCIA
[Empresa] | [Cargo] | [Periodo]
- [Logro mejorado con verbo de acción en español + métrica real, ej: Reduje el tiempo de carga en un 40%]
- [Logro 2]

[Empresa 2] | [Cargo] | [Periodo]
- [Logro 1]

EDUCACIÓN
[Título] | [Institución] | [Año]

HABILIDADES
Lenguajes: [lista]
Frameworks: [lista]
Bases de datos: [lista, solo si aplica]
Cloud/DevOps: [lista, solo si aplica]
Herramientas: [lista, solo si aplica]

IDIOMAS
[Idioma]: [Nivel]

[INCLUIR SOLO SI EL CV ORIGINAL CONTIENE PROYECTOS:]
PROYECTOS
[Nombre del proyecto] | [URL completa si existe en el CV, ej: https://github.com/usuario/repo]
- [Descripción mejorada basada en lo que aparece en el CV]

[INCLUIR SOLO SI EL CV ORIGINAL CONTIENE CERTIFICACIONES REALES:]
CERTIFICACIONES
[Nombre de la certificación] ([Año si aparece en el CV])

REGLAS CRÍTICAS — incumplirlas invalida el resultado:
1. NO inventar NINGUNA información: experiencias, proyectos, tecnologías, certificaciones, fechas
2. SOLO reorganizar, mejorar redacción y optimizar para ATS usando el contenido real del CV
3. Todo el texto en ESPAÑOL: usar tildes (á, é, í, ó, ú) y ñ correctamente
4. Omitir completamente las secciones PROYECTOS y CERTIFICACIONES si no aparecen en el CV original
5. Los marcadores de sección van solos en su línea, en MAYÚSCULAS, sin dos puntos al final
6. Educación se llama EDUCACIÓN (nunca CERTIFICATIONS ni CERTIFICATIONS para estudios)
7. ats_score_before y ats_score_after son números enteros 0-100

CV a analizar y mejorar:
{_truncate_cv_text(text, max_chars=7000)}"""

    try:
        response = client.messages.create(
            model=CV_AI_MODEL,
            max_tokens=4000,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
    except anthropic.APIStatusError as exc:
        if exc.status_code == 429:
            raise HTTPException(status_code=429, detail="Límite de Claude API alcanzado. Inténtalo en unos minutos.")
        raise HTTPException(status_code=502, detail=f"Error de Claude API: {exc.message}")

    raw_text = response.content[0].text if response.content else ""
    try:
        raw = _extract_json_from_response(raw_text)
    except Exception:
        raise HTTPException(status_code=502, detail="La IA no pudo procesar el CV. Inténtalo de nuevo.")

    result = _sanitize_full_improvement(raw)

    try:
        from app.database import get_session_local
        SessionLocal = get_session_local()
        if SessionLocal:
            db_cost = SessionLocal()
            try:
                record_ai_api_cost(
                    db=db_cost,
                    feature="cv_improve_full",
                    model=CV_AI_MODEL,
                    usage=response.usage,
                    user_id=user_id,
                )
                db_cost.commit()
            finally:
                db_cost.close()
    except Exception as e:
        print(f"[CV_IMPROVE_FULL_COST] Error registrando coste: {e}")

    return result, response.usage


def _sanitize_full_improvement(raw: dict) -> dict:
    """Normaliza y valida el resultado completo de mejora de CV."""
    def safe_int(val, default: int, lo: int = 0, hi: int = 100) -> int:
        try:
            return max(lo, min(hi, int(val)))
        except (TypeError, ValueError):
            return default

    def safe_list_str(val, max_items: int = 20) -> list[str]:
        if not isinstance(val, list):
            return []
        return [str(x).strip() for x in val[:max_items] if str(x).strip()]

    def safe_list_dicts(val, max_items: int = 10) -> list[dict]:
        if not isinstance(val, list):
            return []
        return [x for x in val[:max_items] if isinstance(x, dict)]

    def safe_str(val, fallback: str = "") -> str:
        s = str(val or "").strip()
        return s if s else fallback

    score_before = safe_int(raw.get("ats_score_before"), 40)
    score_after = max(safe_int(raw.get("ats_score_after"), score_before + 20), score_before)

    return {
        "ats_score_before": score_before,
        "ats_score_after": score_after,
        "problems_detected": safe_list_dicts(raw.get("problems_detected"), 8),
        "key_improvements": safe_list_str(raw.get("key_improvements"), 8),
        "keywords_to_add": safe_list_str(raw.get("keywords_to_add"), 15),
        "improved_cv_text": safe_str(raw.get("improved_cv_text")),
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
