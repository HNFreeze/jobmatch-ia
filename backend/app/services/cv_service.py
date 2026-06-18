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
from app.services.claude_client import call_claude, system_with_cache

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


def _truncate_cv_text(text: str, max_chars: int = 12000) -> str:
    """Trunca el texto del CV intentando no cortar en medio de una sección.

    Busca el último salto de sección antes del límite para no dejar
    una experiencia/educación partida a la mitad.
    """
    if len(text) <= max_chars:
        return text

    # Intentar cortar en un límite de sección (línea en blanco antes de bloque clave)
    _SECTION_STARTS = (
        "\nEXPERIENCIA", "\nEDUCACIÓN", "\nEDUCACION",
        "\nHABILIDADES", "\nIDIOMAS", "\nPROYECTOS",
        "\nCERTIFICACIONES", "\nRESUMEN",
        # inglés (por si el CV original las usa)
        "\nEXPERIENCE", "\nEDUCATION", "\nSKILLS", "\nLANGUAGES",
    )
    candidate_cut = max_chars
    for marker in _SECTION_STARTS:
        pos = text.rfind(marker, 0, max_chars)
        if pos > max_chars // 2 and pos > candidate_cut - 1000:
            candidate_cut = pos

    return text[:candidate_cut].rstrip()


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
        response = call_claude(lambda: client.messages.create(
            model=CV_AI_MODEL,
            max_tokens=2000,
            system=system_with_cache(system_prompt),
            messages=[{"role": "user", "content": user_prompt}],
        ))
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
        response = call_claude(lambda: client.messages.create(
            model=CV_AI_MODEL,
            max_tokens=3000,
            system=system_with_cache(system_prompt),
            messages=[{"role": "user", "content": user_prompt}],
        ))
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
    edit_context: str = "",
) -> tuple[dict, object]:
    """
    Llama a Claude para:
    1. Analizar el CV (ATS score + problemas)
    2. Generar el CV mejorado como JSON estructurado canónico

    Devuelve (full_result_dict, usage).
    full_result_dict contiene: ats_score_before, ats_score_after,
      problems_detected, key_improvements, keywords_to_add,
      cv_structured_json (dict), improved_cv_text (str derivado del JSON)
    """
    client = anthropic.Anthropic(api_key=api_key)

    system_prompt = (
        "Eres un experto en CVs optimizados para ATS con 15 años en selección técnica española. "
        "Tu tarea es analizar un CV y devolver ÚNICAMENTE un JSON válido con el análisis y el CV mejorado. "
        "Sin texto adicional, sin bloques markdown. "
        "NUNCA inventas información: solo reorganizas, mejoras la redacción y optimizas para ATS. "
        "Todo el texto debe estar en español correcto, con tildes (á,é,í,ó,ú) y ñ. "
        "Cada experiencia laboral es un objeto JSON independiente: NUNCA mezcles empresa, cargo, "
        "fechas o bullets de una experiencia con otra."
    )

    if edit_context:
        system_prompt += f"\n\nCORRECCIONES PREVIAS DEL USUARIO (aplicar misma lógica):\n{edit_context}"

    user_prompt = f"""Analiza este CV y devuelve un JSON con EXACTAMENTE esta estructura:

{{
  "ats_score_before": número entero 0-100,
  "ats_score_after": número entero 0-100 (siempre >= before),
  "problems_detected": [
    {{"category": "keywords|structure|verbos|metrics|format", "description": "descripción en español"}}
  ],
  "key_improvements": ["mejora 1", "mejora 2"],
  "keywords_to_add": ["kw1", "kw2"],
  "cv_structured_json": {{
    "meta": {{"version": 1, "warnings": [], "source": "ai_generated"}},
    "personal": {{"name": "COPIA EXACTA del nombre del CV sin modificar ningún carácter ni tilde", "title": "título profesional optimizado para ATS en español"}},
    "summary": "resumen profesional 3-4 frases con keywords ATS, en español",
    "experience": [
      {{
        "id": "exp_0",
        "company": "nombre EXACTO de la empresa tal como aparece",
        "role": "cargo EXACTO tal como aparece",
        "period": "periodo exacto del CV",
        "location": "ciudad/modalidad si aparece",
        "bullets": ["logro mejorado con verbo acción + métrica real, en español"],
        "flagged": false
      }}
    ],
    "education": [
      {{
        "id": "edu_0",
        "degree": "título académico exacto",
        "institution": "institución exacta",
        "year": "año si aparece",
        "flagged": false
      }}
    ],
    "skills": [
      {{"category": "Lenguajes", "items": ["Python", "Java"]}}
    ],
    "languages": [
      {{"language": "Español", "level": "Nativo"}}
    ],
    "projects": [],
    "certifications": []
  }}
}}

REGLAS ABSOLUTAS — incumplirlas invalida el resultado:
1. NO inventar NADA: empresas, cargos, fechas, tecnologías, proyectos, certificaciones, descripciones
2. Cada objeto en experience[] contiene SOLO los datos de ESA empresa — nunca mezcles bullets de otra
3. projects[] y certifications[] solo si EXISTEN en el CV original; si no, déjalos como []
4. education[] es para estudios académicos; certifications[] para certificados profesionales
5. ats_score_before y ats_score_after son números enteros, no strings
6. Todo el texto en español con tildes correctas (á,é,í,ó,ú,ñ)
7. personal.name: copia el nombre EXACTAMENTE como aparece en el CV, sin cambiar ningún carácter, tilde, letra ni orden
8. education[]: incluye TODOS los estudios académicos del CV original sin omitir ninguno
9. Usa inglés SOLO para nombres propios de tecnologías (Python, React, SQL...); títulos y texto en español
10. skills[]: ordena las categorías de más a menos relevantes para el perfil del candidato

CV original a analizar:
{_truncate_cv_text(text, max_chars=12000)}"""

    try:
        response = call_claude(lambda: client.messages.create(
            model=CV_AI_MODEL,
            max_tokens=6000,
            system=system_with_cache(system_prompt),
            messages=[{"role": "user", "content": user_prompt}],
        ))
    except anthropic.APIStatusError as exc:
        if exc.status_code == 429:
            raise HTTPException(status_code=429, detail="Límite de Claude API alcanzado. Inténtalo en unos minutos.")
        raise HTTPException(status_code=502, detail=f"Error de Claude API: {exc.message}")

    raw_text = response.content[0].text if response.content else ""
    try:
        raw = _extract_json_from_response(raw_text)
    except Exception:
        raise HTTPException(status_code=502, detail="La IA no pudo procesar el CV. Inténtalo de nuevo.")

    result = _sanitize_full_improvement(raw, original_cv_text=text)

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


async def optimize_cv_json_for_offer(
    cv_json: dict,
    offer_snapshot: dict,
    api_key: str,
    user_id: Optional[int] = None,
) -> tuple[dict, object]:
    """Optimiza un CV estructurado para una oferta concreta sin inventar informacion."""
    client = anthropic.Anthropic(api_key=api_key)
    source_cv = normalize_cv_structured(cv_json or {})
    source_cv = validate_cv_structured(
        source_cv,
        original_cv_text=derive_improved_cv_text_from_json(source_cv),
    )
    existing_meta = dict(source_cv.get("meta") or {})
    clean_offer = offer_snapshot if isinstance(offer_snapshot, dict) else {}

    system_prompt = (
        "Eres un experto en CVs ATS para tecnologia en Espana. "
        "Tu trabajo es adaptar un CV estructurado a una oferta concreta sin inventar experiencia, skills, empresas, fechas ni certificaciones. "
        "Solo puedes reordenar, resumir, mejorar la redaccion, priorizar informacion existente y ocultar secciones poco utiles. "
        "Devuelves unicamente JSON valido, sin markdown."
    )

    user_prompt = f"""Devuelve EXACTAMENTE un JSON con esta estructura:

{{
  "focus_summary": "resumen breve en espanol de la estrategia aplicada",
  "changes_applied": ["cambio 1", "cambio 2"],
  "cv_structured_json": {{
    "meta": {{
      "version": 1,
      "warnings": [],
      "source": "ai_offer_optimized",
      "fit_one_page": true,
      "hidden_sections": ["certifications"]
    }},
    "personal": {{"name": "nombre exacto", "title": "titulo profesional en espanol"}},
    "summary": "resumen profesional optimizado para la oferta",
    "experience": [
      {{
        "id": "exp_0",
        "company": "empresa exacta",
        "role": "cargo exacto",
        "period": "periodo exacto",
        "location": "ubicacion",
        "bullets": ["logro relevante reescrito sin inventar datos"],
        "flagged": false
      }}
    ],
    "education": [{{"id": "edu_0", "degree": "titulo", "institution": "centro", "year": "2024", "flagged": false}}],
    "skills": [{{"category": "Backend", "items": ["Python", "FastAPI"]}}],
    "languages": [{{"language": "Ingles", "level": "C1"}}],
    "projects": [],
    "certifications": []
  }}
}}

REGLAS:
1. No inventes nada. Si un dato no esta en el CV original, no lo anadas.
2. Manten el nombre exacto del candidato.
3. Puedes reordenar secciones, resumir bullets largos y priorizar lo mas relevante para la oferta.
4. Si una seccion aporta poco a la oferta y esta vacia o es secundaria, puedes incluirla en meta.hidden_sections.
5. Puedes activar fit_one_page solo si ayuda a concentrar el CV, pero no elimines informacion real.
6. Todo en espanol correcto.
7. changes_applied debe describir ajustes reales, no promesas.

OFERTA OBJETIVO:
{json.dumps(clean_offer, ensure_ascii=False, indent=2)}

CV ESTRUCTURADO ACTUAL:
{json.dumps(source_cv, ensure_ascii=False, indent=2)}
"""

    try:
        response = call_claude(lambda: client.messages.create(
            model=CV_AI_MODEL,
            max_tokens=5000,
            system=system_with_cache(system_prompt),
            messages=[{"role": "user", "content": user_prompt}],
        ))
    except anthropic.APIStatusError as exc:
        if exc.status_code == 429:
            raise HTTPException(status_code=429, detail="Limite de Claude API alcanzado. Intentalo en unos minutos.")
        raise HTTPException(status_code=502, detail=f"Error de Claude API: {exc.message}")

    raw_text = response.content[0].text if response.content else ""
    try:
        raw = _extract_json_from_response(raw_text)
    except Exception:
        raise HTTPException(status_code=502, detail="La IA no pudo optimizar esta variante del CV.")

    raw_cv_json = raw.get("cv_structured_json") or {}
    if not isinstance(raw_cv_json, dict):
        raise HTTPException(status_code=502, detail="La IA devolvio una estructura de CV invalida.")

    optimized_cv = normalize_cv_structured(raw_cv_json)
    optimized_cv = validate_cv_structured(
        optimized_cv,
        original_cv_text=derive_improved_cv_text_from_json(source_cv),
    )
    optimized_meta = dict(optimized_cv.get("meta") or {})
    merged_meta = {
        **existing_meta,
        **optimized_meta,
        "source": "ai_offer_optimized",
    }
    if clean_offer:
        merged_meta["target_offer"] = clean_offer
    optimized_cv["meta"] = merged_meta

    try:
        from app.database import get_session_local
        SessionLocal = get_session_local()
        if SessionLocal:
            db_cost = SessionLocal()
            try:
                record_ai_api_cost(
                    db=db_cost,
                    feature="cv_optimize_offer",
                    model=CV_AI_MODEL,
                    usage=response.usage,
                    user_id=user_id,
                )
                db_cost.commit()
            finally:
                db_cost.close()
    except Exception as e:
        print(f"[CV_OPTIMIZE_OFFER_COST] Error registrando coste: {e}")

    return {
        "focus_summary": str(raw.get("focus_summary") or "").strip(),
        "changes_applied": [str(item).strip() for item in (raw.get("changes_applied") or []) if str(item).strip()][:8],
        "cv_structured_json": optimized_cv,
        "improved_cv_text": derive_improved_cv_text_from_json(optimized_cv),
    }, response.usage


def _sanitize_full_improvement(raw: dict, original_cv_text: str = "") -> dict:
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

    score_before = safe_int(raw.get("ats_score_before"), 40)
    score_after = max(safe_int(raw.get("ats_score_after"), score_before + 20), score_before)

    # Obtener y normalizar el JSON estructurado del CV
    raw_cv_json = raw.get("cv_structured_json") or {}
    if not isinstance(raw_cv_json, dict):
        raw_cv_json = {}

    cv_structured = normalize_cv_structured(raw_cv_json)
    cv_structured = validate_cv_structured(cv_structured, original_cv_text)

    # Derivar improved_cv_text desde JSON para retrocompatibilidad
    improved_cv_text = derive_improved_cv_text_from_json(cv_structured)

    return {
        "ats_score_before": score_before,
        "ats_score_after": score_after,
        "problems_detected": safe_list_dicts(raw.get("problems_detected"), 8),
        "key_improvements": safe_list_str(raw.get("key_improvements"), 8),
        "keywords_to_add": safe_list_str(raw.get("keywords_to_add"), 15),
        "cv_structured_json": cv_structured,
        "improved_cv_text": improved_cv_text,
    }


def normalize_cv_structured(cv_json: dict) -> dict:
    """Normaliza el JSON canónico del CV: garantiza arrays, strings vacíos, IDs estables.

    No añade ni inventa contenido. Solo limpia y completa la estructura.
    """
    def s(val, fallback: str = "") -> str:
        return str(val or "").strip() or fallback

    def ensure_list(val) -> list:
        return val if isinstance(val, list) else []

    personal = cv_json.get("personal") or {}
    skills_raw = ensure_list(cv_json.get("skills"))
    langs_raw = ensure_list(cv_json.get("languages"))

    experience = []
    for i, exp in enumerate(ensure_list(cv_json.get("experience"))):
        if not isinstance(exp, dict):
            continue
        bullets = [b for b in ensure_list(exp.get("bullets")) if str(b or "").strip()]
        experience.append({
            "id": exp.get("id") or f"exp_{i}",
            "company": s(exp.get("company")),
            "role": s(exp.get("role")),
            "period": s(exp.get("period")),
            "location": s(exp.get("location")),
            "bullets": bullets,
            "flagged": bool(exp.get("flagged", False)),
        })

    education = []
    for i, edu in enumerate(ensure_list(cv_json.get("education"))):
        if not isinstance(edu, dict):
            continue
        education.append({
            "id": edu.get("id") or f"edu_{i}",
            "degree": s(edu.get("degree")),
            "institution": s(edu.get("institution")),
            "year": s(edu.get("year")),
            "flagged": bool(edu.get("flagged", False)),
        })

    projects = []
    for i, proj in enumerate(ensure_list(cv_json.get("projects"))):
        if not isinstance(proj, dict):
            continue
        bullets = [b for b in ensure_list(proj.get("bullets")) if str(b or "").strip()]
        projects.append({
            "id": proj.get("id") or f"proj_{i}",
            "name": s(proj.get("name")),
            "url": s(proj.get("url")),
            "bullets": bullets,
            "flagged": bool(proj.get("flagged", False)),
        })

    certifications = []
    for i, cert in enumerate(ensure_list(cv_json.get("certifications"))):
        if not isinstance(cert, dict):
            continue
        certifications.append({
            "id": cert.get("id") or f"cert_{i}",
            "name": s(cert.get("name")),
            "year": s(cert.get("year")),
            "flagged": bool(cert.get("flagged", False)),
        })

    skills = []
    for sg in skills_raw:
        if isinstance(sg, dict):
            items = [str(it).strip() for it in ensure_list(sg.get("items")) if str(it or "").strip()]
            if items:
                skills.append({"category": s(sg.get("category"), "Otros"), "items": items})
        elif isinstance(sg, str) and sg.strip():
            skills.append({"category": "Habilidades", "items": [sg.strip()]})

    languages = []
    for lang in langs_raw:
        if isinstance(lang, dict):
            languages.append({"language": s(lang.get("language")), "level": s(lang.get("level"))})

    meta_raw = cv_json.get("meta") or {}
    meta = {
        "version": int(meta_raw.get("version") or 1),
        "warnings": ensure_list(meta_raw.get("warnings")),
        "source": str(meta_raw.get("source") or "ai_generated"),
    }
    selected_template = str(meta_raw.get("selected_template") or "").strip()
    if selected_template:
        meta["selected_template"] = selected_template
    if meta_raw.get("fit_one_page") is not None:
        meta["fit_one_page"] = bool(meta_raw.get("fit_one_page"))
    hidden_sections = [str(section).strip() for section in ensure_list(meta_raw.get("hidden_sections")) if str(section).strip()]
    if hidden_sections:
        meta["hidden_sections"] = hidden_sections
    variant_name = str(meta_raw.get("variant_name") or "").strip()
    if variant_name:
        meta["variant_name"] = variant_name
    target_offer = meta_raw.get("target_offer")
    if isinstance(target_offer, dict) and target_offer:
        meta["target_offer"] = target_offer

    # Reasignar IDs consecutivos para garantizar unicidad
    for i, exp in enumerate(experience):
        exp["id"] = f"exp_{i}"
    for i, edu in enumerate(education):
        edu["id"] = f"edu_{i}"
    for i, proj in enumerate(projects):
        proj["id"] = f"proj_{i}"
    for i, cert in enumerate(certifications):
        cert["id"] = f"cert_{i}"

    return {
        "meta": meta,
        "personal": {"name": s(personal.get("name")), "title": s(personal.get("title"))},
        "summary": s(cv_json.get("summary")),
        "experience": experience,
        "education": education,
        "skills": skills,
        "languages": languages,
        "projects": projects,
        "certifications": certifications,
    }


def validate_cv_structured(cv_json: dict, original_cv_text: str = "") -> dict:
    """Valida el JSON canónico y marca bloques sospechosos con flagged=True.

    Nunca lanza excepción ni inventa correcciones. Solo señala riesgo.
    """
    import re
    warnings: list[str] = list(cv_json.get("meta", {}).get("warnings") or [])

    # Set de nombres de empresa en minúsculas para detectar contaminación cruzada
    company_names = {
        exp["company"].lower()
        for exp in cv_json.get("experience", [])
        if exp.get("company")
    }

    for exp in cv_json.get("experience", []):
        exp_id = exp.get("id", "?")
        company_lower = exp.get("company", "").lower()
        bullets = exp.get("bullets", [])

        # Regla 1: demasiados bullets → posible mezcla
        if len(bullets) > 12:
            exp["flagged"] = True
            warnings.append(f"{exp_id}: {len(bullets)} bullets (posible mezcla de experiencias)")

        # Regla 2: company o role vacíos → bloque incompleto
        if not exp.get("company", "").strip() or not exp.get("role", "").strip():
            exp["flagged"] = True
            warnings.append(f"{exp_id}: company o role vacíos")

        # Regla 3: bullet menciona otra empresa (contaminación cruzada)
        for bullet in bullets:
            b_lower = bullet.lower()
            for other_company in company_names:
                if other_company and other_company != company_lower:
                    # Buscar como palabra completa (3+ chars para evitar falsos positivos)
                    if len(other_company) >= 4 and re.search(
                        r"\b" + re.escape(other_company) + r"\b", b_lower
                    ):
                        exp["flagged"] = True
                        warnings.append(
                            f"{exp_id}: bullet menciona '{other_company}' (otra empresa del CV)"
                        )
                        break

    # Regla 4: education con degree e institution vacíos
    for edu in cv_json.get("education", []):
        if not edu.get("degree", "").strip() and not edu.get("institution", "").strip():
            edu["flagged"] = True
            warnings.append(f"{edu.get('id','?')}: educación sin título ni institución")

    # Regla 5: conteo de experiencias muy diferente al original (si tenemos texto)
    if original_cv_text:
        # Estimación simple: líneas que parecen "Empresa | Cargo" en el original
        orig_exp_approx = len(re.findall(
            r"(?:^|\n)[A-ZÁÉÍÓÚÑ][^\n]{2,40}\s*[\|·]\s*[A-ZÁÉÍÓÚÑ]",
            original_cv_text, re.MULTILINE
        ))
        generated_count = len(cv_json.get("experience", []))
        if orig_exp_approx > 0 and abs(generated_count - orig_exp_approx) > 2:
            warnings.append(
                f"Conteo de experiencias: {generated_count} generadas vs ~{orig_exp_approx} detectadas en original"
            )

    cv_json["meta"]["warnings"] = warnings
    return cv_json


def derive_improved_cv_text_from_json(cv_json: dict) -> str:
    """Deriva el texto legacy improved_cv_text desde el JSON canónico.

    Se usa para mantener compatibilidad con search_from_improvement
    que llama a analyze_cv_with_ai(record.improved_cv_text).
    """
    lines: list[str] = []
    personal = cv_json.get("personal") or {}
    lines.append(f"NAME: {personal.get('name', '')}")
    lines.append(f"TITLE: {personal.get('title', '')}")

    if cv_json.get("summary"):
        lines.append("")
        lines.append("RESUMEN")
        lines.append(cv_json["summary"])

    experiences = cv_json.get("experience") or []
    if experiences:
        lines.append("")
        lines.append("EXPERIENCIA")
        for exp in experiences:
            loc = f" | {exp['location']}" if exp.get("location") else ""
            lines.append(f"{exp.get('company','')} | {exp.get('role','')} | {exp.get('period','')}{loc}")
            for b in exp.get("bullets") or []:
                lines.append(f"- {b}")
            lines.append("")

    education = cv_json.get("education") or []
    if education:
        lines.append("EDUCACIÓN")
        for edu in education:
            lines.append(f"{edu.get('degree','')} | {edu.get('institution','')} | {edu.get('year','')}")
        lines.append("")

    skills = cv_json.get("skills") or []
    if skills:
        lines.append("HABILIDADES")
        for sg in skills:
            items_str = ", ".join(sg.get("items") or [])
            lines.append(f"{sg.get('category','')}: {items_str}")
        lines.append("")

    languages = cv_json.get("languages") or []
    if languages:
        lines.append("IDIOMAS")
        for lang in languages:
            lines.append(f"{lang.get('language','')}: {lang.get('level','')}")
        lines.append("")

    projects = cv_json.get("projects") or []
    if projects:
        lines.append("PROYECTOS")
        for proj in projects:
            url_part = f" | {proj['url']}" if proj.get("url") else ""
            lines.append(f"{proj.get('name','')}{url_part}")
            for b in proj.get("bullets") or []:
                lines.append(f"- {b}")
            lines.append("")

    certifications = cv_json.get("certifications") or []
    if certifications:
        lines.append("CERTIFICACIONES")
        for cert in certifications:
            year_part = f" ({cert['year']})" if cert.get("year") else ""
            lines.append(f"{cert.get('name','')}{year_part}")

    return "\n".join(lines)


def build_edit_context_for_prompt(action_log_json_str: str) -> str:
    """Construye un resumen de correcciones previas del usuario para el prompt.

    Extrae patrones de move_block, edit_field y mark_incorrect.
    Devuelve string de máx ~500 chars, o "" si no hay nada relevante.
    """
    import json as _json
    try:
        actions = _json.loads(action_log_json_str or "[]")
    except Exception:
        return ""

    if not isinstance(actions, list) or len(actions) < 2:
        return ""

    moved_blocks: list[str] = []
    edited_companies: list[str] = []
    marked_incorrect: list[str] = []

    for act in actions:
        if not isinstance(act, dict):
            continue
        t = act.get("type", "")
        if t == "move_block":
            moved_blocks.append(
                f"{act.get('block_id','?')}: {act.get('from_section','?')} → {act.get('to_section','?')}"
            )
        elif t == "edit_field" and act.get("field") == "company":
            edited_companies.append(
                f"'{act.get('old_value','?')}' → '{act.get('new_value','?')}'"
            )
        elif t == "mark_incorrect":
            marked_incorrect.append(str(act.get("block_id", "?")))

    parts: list[str] = []
    if moved_blocks:
        parts.append("Bloques reubicados: " + "; ".join(moved_blocks[:5]))
    if edited_companies:
        parts.append("Empresas corregidas: " + "; ".join(edited_companies[:3]))
    if marked_incorrect:
        parts.append("Marcados como incorrectos: " + ", ".join(marked_incorrect[:4]))

    result = " | ".join(parts)
    return result[:500] if result else ""


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
