# -*- coding: utf-8 -*-
import hashlib
import html as html_module
import json
import os
import re
from datetime import datetime
from typing import Any

import anthropic

from app.models.job_offer import JobOffer
from app.services.ai_cost_service import record_ai_api_cost
from app.services.claude_client import call_claude

MATCH_ENGINE_VERSION = "v8_synonyms"
MATCH_SIGNAL_BATCH_SIZE = max(1, min(int(os.getenv("MATCH_SIGNAL_BATCH_SIZE", "8")), 12))
MATCH_MAX_OFFERS_ANALYZED = max(1, int(os.getenv("MATCH_MAX_OFFERS_ANALYZED", "20")))
MATCH_MAX_OFFERS_RETURNED = max(1, int(os.getenv("MATCH_MAX_OFFERS_RETURNED", "20")))

TECH_KEYWORDS = [
    "python", "django", "flask", "fastapi", "java", "spring", "kotlin", "scala",
    "javascript", "typescript", "node.js", "node", "react", "react native", "next.js",
    "angular", "vue", "php", "laravel", "symfony", "c#", ".net", "asp.net",
    # "go" removed — too ambiguous (matches "go to market", "go ahead", etc.)
    # Use "golang" as the canonical form; profile stack "Go" is expanded via TECH_NAME_SYNONYMS
    "golang", "rust", "swift", "sql", "postgresql", "mysql", "mongodb", "redis",
    "docker", "kubernetes", "aws", "azure", "gcp", "terraform", "graphql", "git",
    "linux", "devops", "pandas", "numpy", "spark", "airflow", "etl", "machine learning",
    "data engineering", "power bi", "tableau", "salesforce", "sap", "elasticsearch",
]

# Canonical name synonyms for profile stack normalization.
# Ensures that user-written variants match signals extracted from offer descriptions.
TECH_NAME_SYNONYMS: dict[str, str] = {
    # Go / Golang
    "go": "golang",
    # JavaScript / TypeScript
    "js": "javascript",
    "javascript": "javascript",
    "ts": "typescript",
    "typescript": "typescript",
    # Node
    "node": "node.js",
    "nodejs": "node.js",
    "node.js": "node.js",
    # React / React Native / Next
    "reactjs": "react",
    "react.js": "react",
    "next.js": "next.js",
    "nextjs": "next.js",
    # Vue / Angular
    "vue.js": "vue",
    "vuejs": "vue",
    "angular.js": "angular",
    "angularjs": "angular",
    # .NET / C#
    "c sharp": "c#",
    "csharp": "c#",
    ".net": "c#",
    "dotnet": "c#",
    "dot net": "c#",
    "dotnetcore": "c#",
    ".net core": "c#",
    # ASP.NET
    "asp.net": "asp.net",
    "asp net": "asp.net",
    # Spring Boot
    "spring boot": "spring",
    "springboot": "spring",
    # Databases
    "postgres": "postgresql",
    "mysql": "mysql",
    "mssql": "sql server",
    "ms sql": "sql server",
    "sql server": "sql server",
    "oracle db": "oracle",
    "oracle database": "oracle",
    # PL/SQL
    "pl/sql": "pl/sql",
    "plsql": "pl/sql",
    "pl sql": "pl/sql",
    # Cloud
    "amazon web services": "aws",
    "google cloud": "gcp",
    "google cloud platform": "gcp",
    # Power BI / BI tools
    "powerbi": "power bi",
    "power bi": "power bi",
    "power query": "power query",
    # Container / Infra
    "k8s": "kubernetes",
    # Elasticsearch
    "elastic": "elasticsearch",
    "elk": "elasticsearch",
    # Search / APIs
    "rest api": "rest",
    "rest apis": "rest",
    "restful": "rest",
    # Ruby on Rails
    "ruby on rails": "ruby",
    "rails": "ruby",
    # React Native
    "react native": "react native",
}

# Broader set used for pre-filtering: tech keywords + tech role words.
# An offer that matches NONE of these is almost certainly non-tech.
# Deliberately excludes short/ambiguous words ("go", "sap") to avoid false positives.
TECH_JOB_INDICATORS = (set(TECH_KEYWORDS) - {"go", "sap"}) | {
    "golang",  # explicit Go language indicator
    "engineer", "engineering", "developer", "programmer", "software", "backend", "frontend",
    "fullstack", "full-stack", "full stack", "desarrollador", "programador", "ingeniero",
    "ingenieria", "devsecops", "data scientist", "data engineer", "analytics engineer",
    "ml engineer", "sre", "qa engineer", "cloud engineer", "tech lead", "platform engineer",
    "devops engineer", "mobile developer", "ios developer", "android developer",
    "firmware", "embedded", "arquitecto", "architect", "cyber", "security engineer", "infosec",
    "it specialist", "it engineer", "systems administrator", "administrador de sistemas",
}

# Skills that indicate genuine data/ML domain expertise in a profile.
# Used by the data-domain mismatch filter: if an offer is normalized_role="data"
# but the profile has NONE of these, an APLICA result is demoted to QUIZÁ.
# Generic skills like Python, SQL, Docker are excluded — they appear in many domains.
DATA_SPECIFIC_SKILLS: frozenset[str] = frozenset({
    "pandas", "numpy", "scipy", "scikit-learn", "scikit",
    "tensorflow", "pytorch", "keras", "mlflow", "xgboost", "lightgbm",
    "spark", "pyspark", "airflow", "dbt", "hadoop", "hive",
    "tableau", "power bi", "powerbi", "looker", "superset",
    "jupyter", "data engineering", "machine learning", "deep learning",
    "nlp", "computer vision", "feature engineering",
    # Additional data/BI/warehouse tools (frequently added as custom techs)
    "ssis", "ssrs", "sas", "dax", "power query", "powerquery",
    "qlik", "qlikview", "qliksense", "metabase", "redash",
    "snowflake", "databricks", "redshift", "bigquery", "dbt cloud",
    "azure synapse", "azure data factory", "aws glue",
    "data lake", "data warehouse", "data lakehouse",
    "plotly", "matplotlib", "seaborn", "streamlit",
})

ROLE_HINTS = {
    "backend": ["backend", "back-end", "python", "java", "spring", "django", "fastapi", "node", "api"],
    "frontend": ["frontend", "front-end", "react", "angular", "vue", "javascript", "typescript", "css"],
    "fullstack": ["fullstack", "full-stack", "full stack"],
    "data": ["data", "etl", "analytics", "bi", "machine learning", "airflow", "spark"],
    "devops": ["devops", "platform", "sre", "cloud", "terraform", "kubernetes", "docker"],
    "mobile": ["mobile", "android", "ios", "swift", "kotlin", "flutter", "react native"],
}

LANGUAGE_LEVELS = {
    "basico": 1,
    "a1": 1,
    "a2": 2,
    "intermedio": 3,
    "b1": 3,
    "b2": 4,
    "avanzado": 5,
    "c1": 5,
    "c2": 6,
    "nativo": 6,
}

WORK_MODE_REMOTE = {"remote", "remoto", "teletrabajo"}
WORK_MODE_HYBRID = {"hybrid", "hibrido", "híbrido", "mixto"}
WORK_MODE_ONSITE = {"onsite", "office", "presencial"}


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip().lower()
    replacements = {
        "á": "a",
        "é": "e",
        "í": "i",
        "ó": "o",
        "ú": "u",
        "ü": "u",
        "ñ": "n",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return re.sub(r"\s+", " ", text)


def _dedupe_keep_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for raw in values:
        item = str(raw or "").strip()
        key = _normalize_text(item)
        if not item or not key or key in seen:
            continue
        seen.add(key)
        result.append(item)
    return result


def _strip_html(text: str) -> str:
    """Decode HTML entities and remove all tags so Claude never sees raw HTML."""
    text = html_module.unescape(str(text or ""))
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s{2,}", " ", text).strip()


def _truncate_description(description: str, max_chars: int = 2600) -> str:
    text = _strip_html(description)
    if len(text) <= max_chars:
        return text
    head = text[:1600].rstrip()
    tail = text[-900:].lstrip()
    return f"{head}\n...\n{tail}"


def _build_offer_analysis_hash(offer: dict) -> str:
    payload = {
        "titulo": offer.get("titulo", ""),
        "empresa": offer.get("empresa", ""),
        "ubicacion": offer.get("ubicacion", ""),
        "descripcion": offer.get("descripcion", ""),
        "salario": offer.get("salario", ""),
        "url": offer.get("redirect_url") or offer.get("url") or "",
    }
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _build_idiomas_str(profile: dict) -> str:
    idiomas = profile.get("idiomas") or []
    if idiomas:
        parts = []
        for lang in idiomas:
            idioma = lang.get("idioma", "").strip()
            nivel = lang.get("nivel", "").strip()
            if idioma:
                parts.append(f"{idioma} ({nivel})" if nivel else idioma)
        if parts:
            return ", ".join(parts)
    english = (profile.get("english") or "").strip()
    return f"Ingles ({english})" if english else "No especificado"


def _prepare_offer_for_prompt(offer: dict) -> dict:
    return {
        "id": offer["id"],
        "adzuna_id": offer.get("adzuna_id", ""),
        "titulo": offer.get("titulo", ""),
        "empresa": offer.get("empresa", ""),
        "ubicacion": offer.get("ubicacion", ""),
        "salario": "" if offer.get("salario") == "Salario no especificado" else offer.get("salario", ""),
        "descripcion": _truncate_description(offer.get("descripcion", "")),
    }


def _extract_json_payload(raw_response: str) -> Any:
    cleaned = (raw_response or "").strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```", 2)[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()
    return json.loads(cleaned)


def _sanitize_string_list(values: Any, limit: int = 8) -> list[str]:
    if not isinstance(values, list):
        return []
    normalized = []
    for item in values[:limit]:
        text = str(item or "").strip()
        if text:
            normalized.append(text)
    return _dedupe_keep_order(normalized)


def _sanitize_skill_year_requirements(values: Any, limit: int = 8) -> list[dict]:
    if not isinstance(values, list):
        return []
    normalized: list[dict] = []
    seen: set[tuple[str, int]] = set()
    for item in values[:limit]:
        if not isinstance(item, dict):
            continue
        skill = str(item.get("skill") or "").strip()
        years = item.get("years")
        if not skill:
            continue
        try:
            years_int = int(years)
        except (TypeError, ValueError):
            continue
        if years_int < 0:
            continue
        key = (_normalize_text(skill), years_int)
        if key in seen:
            continue
        seen.add(key)
        normalized.append(
            {
                "skill": skill,
                "years": years_int,
                "required": bool(item.get("required", True)),
            }
        )
    return normalized


def _sanitize_signals(raw: dict) -> dict:
    signals = {
        "normalized_role": str(raw.get("normalized_role") or "").strip() or None,
        "seniority_level": str(raw.get("seniority_level") or "").strip() or None,
        "required_skills": _sanitize_string_list(raw.get("required_skills"), 10),
        "preferred_skills": _sanitize_string_list(raw.get("preferred_skills"), 10),
        "required_languages": _sanitize_string_list(raw.get("required_languages"), 6),
        "work_mode": str(raw.get("work_mode") or "").strip() or None,
        "location_constraints": _sanitize_string_list(raw.get("location_constraints"), 6),
        "salary_signal": str(raw.get("salary_signal") or "").strip() or None,
        "responsibilities_summary": str(raw.get("responsibilities_summary") or "").strip() or None,
        "critical_requirements": _sanitize_string_list(raw.get("critical_requirements"), 8),
        "must_have_requirements": _sanitize_string_list(raw.get("must_have_requirements"), 8),
        "nice_to_have": _sanitize_string_list(raw.get("nice_to_have"), 8),
        "hard_constraints": _sanitize_string_list(raw.get("hard_constraints"), 8),
        "required_skill_years": _sanitize_skill_year_requirements(raw.get("required_skill_years"), 8),
        "red_flags": _sanitize_string_list(raw.get("red_flags"), 6),
        "requires_explicit_years": bool(raw.get("requires_explicit_years")) if raw.get("requires_explicit_years") is not None else False,
        "required_years_min": None,
    }
    years = raw.get("required_years_min")
    if isinstance(years, (int, float)) and years >= 0:
        signals["required_years_min"] = int(years)
    elif isinstance(years, str) and years.strip().isdigit():
        signals["required_years_min"] = int(years.strip())
    return signals


def _extract_known_skills(text: str) -> list[str]:
    normalized = _normalize_text(text)
    found = []
    for skill in TECH_KEYWORDS:
        pattern = re.escape(_normalize_text(skill))
        if re.search(rf"(?<!\w){pattern}(?!\w)", normalized):
            found.append(skill.title() if skill.islower() else skill)
    return _dedupe_keep_order(found)


def _is_tech_offer(offer: dict) -> bool:
    """Return True if the offer has at least one tech indicator in its title or description.

    Checks the title first (fast path), then falls back to a 600-char snippet of the
    stripped description. An offer that matches none of TECH_JOB_INDICATORS is almost
    certainly a non-tech role (operations, finance, sales, fleet management, etc.) and
    should be skipped before signal extraction and scoring.
    """
    title = _normalize_text(offer.get("titulo", ""))
    desc_snippet = _normalize_text(_strip_html(offer.get("descripcion", "")))[:600]
    combined = f"{title} {desc_snippet}"
    for kw in TECH_JOB_INDICATORS:
        kw_norm = _normalize_text(kw)
        if kw_norm and re.search(rf"(?<!\w){re.escape(kw_norm)}(?!\w)", combined):
            return True
    return False


def _infer_role(title: str, skills: list[str]) -> str | None:
    normalized = _normalize_text(f"{title} {' '.join(skills)}")
    for role, hints in ROLE_HINTS.items():
        if any(_normalize_text(hint) in normalized for hint in hints):
            return role
    return None


def _infer_seniority(text: str) -> str | None:
    normalized = _normalize_text(text)
    if any(token in normalized for token in ["staff", "principal", "lead", "arquitect", "senior"]):
        return "senior"
    if any(token in normalized for token in ["junior", "trainee", "intern", "beca", "practicas"]):
        return "junior"
    if any(token in normalized for token in ["mid", "middle", "intermediate"]):
        return "mid"
    return None


def _infer_years_required(text: str) -> tuple[bool, int | None]:
    normalized = _normalize_text(text)
    matches = re.findall(r"(\d+)\s*\+?\s*(?:anos|years)", normalized)
    if not matches:
        return False, None
    years = max(int(match) for match in matches)
    return True, years


def _extract_relevant_requirement_lines(text: str, patterns: list[str], limit: int = 6) -> list[str]:
    lines = []
    for raw_line in re.split(r"[\n\r•·\-]+", text or ""):
        line = " ".join(str(raw_line or "").strip().split())
        normalized = _normalize_text(line)
        if not line or len(line) < 8:
            continue
        if any(re.search(pattern, normalized) for pattern in patterns):
            lines.append(line)
    return _dedupe_keep_order(lines)[:limit]


def _extract_skill_year_requirements(text: str, skills: list[str]) -> list[dict]:
    normalized = _normalize_text(text)
    results: list[dict] = []
    for skill in skills:
        skill_norm = _normalize_text(skill)
        if not skill_norm:
            continue
        patterns = [
            rf"(\d+)\+?\s*(?:anos|years)[^.\n,;:]{{0,45}}(?:con|en|de experiencia en|trabajando con)?[^.\n,;:]{{0,20}}{re.escape(skill_norm)}",
            rf"{re.escape(skill_norm)}[^.\n,;:]{{0,35}}(\d+)\+?\s*(?:anos|years)",
        ]
        matches: list[int] = []
        for pattern in patterns:
            for match in re.finditer(pattern, normalized):
                try:
                    matches.append(int(match.group(1)))
                except (TypeError, ValueError, IndexError):
                    continue
        if matches:
            results.append(
                {
                    "skill": skill,
                    "years": max(matches),
                    "required": True,
                }
            )
    return results[:8]


def _infer_work_mode(text: str) -> str | None:
    normalized = _normalize_text(text)
    if any(token in normalized for token in ["hibrido", "hibrida", "híbrido", "híbrida", "hybrid", "mixto"]):
        return "hybrid"
    if any(token in normalized for token in ["100% remoto", "fully remote", "remote", "teletrabajo", "trabajo remoto"]):
        return "remote"
    if any(token in normalized for token in ["presencial", "onsite", "on-site", "en oficina"]):
        return "onsite"
    return None


def _heuristic_offer_signals(offer: dict) -> dict:
    title = offer.get("titulo", "")
    description = offer.get("descripcion", "")
    location = offer.get("ubicacion", "")
    combined = f"{title}\n{description}"
    required_skills = _extract_known_skills(combined)
    preferred_skills = []
    critical_requirements = []
    nice_to_have = []
    must_have_requirements = _extract_relevant_requirement_lines(
        combined,
        [
            r"imprescindible",
            r"\bmust\b",
            r"obligatorio",
            r"se requiere",
            r"required",
            r"requisito",
            r"experiencia con",
            r"experience with",
        ],
    )
    hard_constraints = _extract_relevant_requirement_lines(
        combined,
        [
            r"presencial",
            r"onsite",
            r"guardias",
            r"disponibilidad",
            r"viajar",
            r"viajes",
            r"visado",
            r"reubicacion",
            r"relocalizacion",
        ],
    )
    normalized = _normalize_text(combined)

    for skill in required_skills:
        norm_skill = _normalize_text(skill)
        if re.search(rf"(imprescindible|required|must|obligatorio|se requiere).{{0,30}}{re.escape(norm_skill)}|{re.escape(norm_skill)}.{{0,30}}(imprescindible|required|must|obligatorio|se requiere)", normalized):
            critical_requirements.append(skill)
        elif re.search(rf"(nice to have|plus|deseable|valorable).{{0,30}}{re.escape(norm_skill)}|{re.escape(norm_skill)}.{{0,30}}(nice to have|plus|deseable|valorable)", normalized):
            preferred_skills.append(skill)
            nice_to_have.append(skill)

    required_languages = []
    if "english" in normalized or "ingles" in normalized:
        required_languages.append("Ingles")
    if "frances" in normalized or "french" in normalized:
        required_languages.append("Frances")
    if "aleman" in normalized or "german" in normalized:
        required_languages.append("Aleman")

    requires_years, years_min = _infer_years_required(combined)
    required_skill_years = _extract_skill_year_requirements(combined, required_skills)
    return {
        "normalized_role": _infer_role(title, required_skills),
        "seniority_level": _infer_seniority(combined),
        "required_skills": [skill for skill in required_skills if skill not in preferred_skills][:10],
        "preferred_skills": preferred_skills[:10],
        "required_languages": required_languages,
        "work_mode": _infer_work_mode(combined),
        "location_constraints": _dedupe_keep_order([location]) if location else [],
        "salary_signal": offer.get("salario") if offer.get("salario") and offer.get("salario") != "Salario no especificado" else None,
        "responsibilities_summary": None,
        "critical_requirements": _dedupe_keep_order(critical_requirements)[:8],
        "must_have_requirements": must_have_requirements,
        "nice_to_have": _dedupe_keep_order(nice_to_have)[:8],
        "hard_constraints": hard_constraints,
        "required_skill_years": required_skill_years,
        "red_flags": [],
        "requires_explicit_years": requires_years,
        "required_years_min": years_min,
    }


def _build_extraction_prompt(offers: list[dict]) -> str:
    return f"""Eres un analista de ofertas tech en Espana.

Tu tarea es EXTRAER senales estructuradas desde la informacion real de cada oferta.
No decidas si el candidato encaja. No inventes datos no presentes en el texto.
Si una senal no aparece de forma razonable, devuelvela vacia o null.

Analiza con especial cuidado:
- skills requeridas vs deseables
- si la oferta pide anos concretos en una tecnologia especifica
- seniority y anos de experiencia
- idiomas exigidos explicitamente
- modalidad de trabajo
- restricciones de ubicacion
- condiciones duras como presencialidad, guardias, viajes o disponibilidad especial
- requisitos criticos o bloqueantes
- red flags relevantes

Devuelve UNICAMENTE un array JSON valido con este formato:
[
  {{
    "id": 1,
    "normalized_role": "backend",
    "seniority_level": "mid",
    "required_skills": ["Python", "Django"],
    "preferred_skills": ["Docker"],
    "required_languages": ["Ingles B2"],
    "work_mode": "hybrid",
    "location_constraints": ["Madrid"],
    "salary_signal": "Rango salarial claro o null",
    "responsibilities_summary": "Resumen muy breve de responsabilidades",
    "critical_requirements": ["Python", "3+ anos de experiencia"],
    "must_have_requirements": ["Experiencia demostrable con APIs REST"],
    "nice_to_have": ["Docker"],
    "hard_constraints": ["Presencial 4 dias en Madrid"],
    "required_skill_years": [{"skill": "Python", "years": 3, "required": true}],
    "red_flags": ["Presencial 5 dias"],
    "requires_explicit_years": true,
    "required_years_min": 3
  }}
]

Valores validos:
- normalized_role: backend, frontend, fullstack, data, devops, mobile, qa, product, unknown
- seniority_level: junior, mid, senior, lead, unknown
- work_mode: remote, hybrid, onsite, unknown

Ofertas:
{json.dumps([_prepare_offer_for_prompt(offer) for offer in offers], ensure_ascii=False, indent=2)}
"""


def _extract_offer_signals_with_ai(offers: list[dict], api_key: str, user_id: int | None = None) -> dict[int, dict]:
    if not offers:
        return {}
    client = anthropic.Anthropic(api_key=api_key)
    prompt = _build_extraction_prompt(offers)
    message = call_claude(lambda: client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    ))
    record_ai_api_cost(
        user_id=user_id,
        feature="match_signal_extraction",
        model="claude-haiku-4-5-20251001",
        usage=getattr(message, "usage", None),
        request_id=getattr(message, "id", None),
        metadata={"offers_in_batch": len(offers)},
    )
    payload = _extract_json_payload(message.content[0].text)
    if not isinstance(payload, list):
        raise ValueError("Claude no devolvio un array JSON de senales")
    results = {}
    for item in payload:
        if not isinstance(item, dict):
            continue
        offer_id = item.get("id")
        if isinstance(offer_id, int):
            results[offer_id] = _sanitize_signals(item)
    return results


def _get_job_offer_rows(db, offers: list[dict]) -> dict[str, JobOffer]:
    if not db:
        return {}
    adzuna_ids = [offer.get("adzuna_id") for offer in offers if offer.get("adzuna_id")]
    if not adzuna_ids:
        return {}
    rows = db.query(JobOffer).filter(JobOffer.adzuna_id.in_(adzuna_ids)).all()
    return {row.adzuna_id: row for row in rows}


def _load_cached_offer_signals(db, offers: list[dict]) -> tuple[dict[int, dict], list[dict]]:
    row_map = _get_job_offer_rows(db, offers)
    cached: dict[int, dict] = {}
    missing: list[dict] = []

    for offer in offers:
        adzuna_id = offer.get("adzuna_id")
        row = row_map.get(adzuna_id) if adzuna_id else None
        offer_hash = _build_offer_analysis_hash(offer)
        if (
            row
            and row.analysis_version == MATCH_ENGINE_VERSION
            and row.analysis_hash == offer_hash
            and row.offer_signals_json
        ):
            try:
                cached[offer["id"]] = json.loads(row.offer_signals_json)
                continue
            except json.JSONDecodeError:
                pass
        missing.append(offer)

    return cached, missing


def _persist_offer_signals(db, offers: list[dict], signals_by_id: dict[int, dict]):
    if not db or not offers:
        return
    row_map = _get_job_offer_rows(db, offers)
    touched = False
    for offer in offers:
        row = row_map.get(offer.get("adzuna_id"))
        signals = signals_by_id.get(offer["id"])
        if not row or not signals:
            continue
        row.analysis_version = MATCH_ENGINE_VERSION
        row.analysis_hash = _build_offer_analysis_hash(offer)
        row.offer_signals_json = json.dumps(signals, ensure_ascii=False)
        row.signals_updated_at = datetime.utcnow()
        touched = True
    if touched:
        db.commit()


def _extract_offer_signals(offers: list[dict], api_key: str, db=None, user_id: int | None = None) -> dict[int, dict]:
    cached_by_id: dict[int, dict] = {}
    uncached_offers = offers

    if db:
        cached_by_id, uncached_offers = _load_cached_offer_signals(db, offers)
        if cached_by_id:
            print(f"[MATCH_SIGNALS] {len(cached_by_id)} ofertas reutilizan senales cacheadas")

    resolved_by_id = dict(cached_by_id)
    offers_for_ai = uncached_offers[:MATCH_MAX_OFFERS_ANALYZED]
    offers_for_fallback = uncached_offers[MATCH_MAX_OFFERS_ANALYZED:]
    ai_results: dict[int, dict] = {}
    failed_ai_ids: set[int] = set()

    for start in range(0, len(offers_for_ai), MATCH_SIGNAL_BATCH_SIZE):
        batch = offers_for_ai[start:start + MATCH_SIGNAL_BATCH_SIZE]
        try:
            ai_results.update(_extract_offer_signals_with_ai(batch, api_key, user_id=user_id))
        except Exception as exc:
            print(f"[MATCH_SIGNALS] Error en extraccion AI por lote: {exc}")
            for offer in batch:
                failed_ai_ids.add(offer["id"])

    for offer in offers_for_ai:
        resolved_by_id[offer["id"]] = _sanitize_signals(ai_results.get(offer["id"], _heuristic_offer_signals(offer)))

    for offer in offers_for_fallback:
        resolved_by_id[offer["id"]] = _sanitize_signals(_heuristic_offer_signals(offer))

    if db and uncached_offers:
        try:
            _persist_offer_signals(db, uncached_offers, resolved_by_id)
        except Exception as exc:
            db.rollback()
            print(f"[MATCH_SIGNALS] Error guardando senales cacheadas: {exc}")

    if failed_ai_ids:
        print(f"[MATCH_SIGNALS] {len(failed_ai_ids)} ofertas cayeron a fallback heuristico")
    return resolved_by_id


def _parse_years(value: Any) -> float | None:
    if value is None:
        return None
    text = str(value).strip().lower()
    if not text:
        return None
    if text.endswith("+"):
        text = text[:-1]
    match = re.search(r"\d+(?:\.\d+)?", text)
    if not match:
        return None
    try:
        return float(match.group())
    except ValueError:
        return None


def _normalize_profile_modalities(profile: dict) -> set[str]:
    values = set()
    for raw in profile.get("modalidad") or []:
        normalized = _normalize_text(raw)
        if normalized in WORK_MODE_REMOTE:
            values.add("remote")
        elif normalized in WORK_MODE_HYBRID:
            values.add("hybrid")
        elif normalized in WORK_MODE_ONSITE:
            values.add("onsite")
    return values


def _normalize_profile_languages(profile: dict) -> dict[str, int]:
    languages: dict[str, int] = {}
    for item in profile.get("idiomas") or []:
        idioma = _normalize_text(item.get("idioma"))
        nivel = LANGUAGE_LEVELS.get(_normalize_text(item.get("nivel")), 0)
        if idioma:
            languages[idioma] = max(languages.get(idioma, 0), nivel)
    english = _normalize_text(profile.get("english"))
    if english:
        languages["ingles"] = max(languages.get("ingles", 0), LANGUAGE_LEVELS.get(english, 0))
        languages["english"] = languages["ingles"]
    return languages


def _normalize_profile_locations(profile: dict) -> set[str]:
    values = set()
    for raw in profile.get("ubicaciones") or []:
        normalized = _normalize_text(raw)
        if normalized:
            values.add(normalized)
    return values


def _normalize_profile_stack(profile: dict) -> tuple[list[str], set[str]]:
    stack = _dedupe_keep_order([str(item).strip() for item in profile.get("stack") or [] if str(item).strip()])
    normalized: set[str] = set()
    for item in stack:
        n = _normalize_text(item)
        normalized.add(n)
        # Expand synonyms so that e.g. profile "Go" matches signals extracted as "Golang"
        if n in TECH_NAME_SYNONYMS:
            normalized.add(TECH_NAME_SYNONYMS[n])
    return stack, normalized


def _expand_language_requirement(language_text: str) -> tuple[str, int]:
    normalized = _normalize_text(language_text)
    required_level = 0
    for token, numeric in LANGUAGE_LEVELS.items():
        if token in normalized:
            required_level = max(required_level, numeric)
    if "ingles" in normalized or "english" in normalized:
        return "ingles", required_level or 3
    if "frances" in normalized or "french" in normalized:
        return "frances", required_level or 3
    if "aleman" in normalized or "german" in normalized:
        return "aleman", required_level or 3
    return normalized.split(" ")[0], required_level or 3


def _score_required_skills(profile_stack_norm: set[str], signals: dict) -> tuple[float, list[str], list[str], list[str]]:
    required = signals.get("required_skills") or []
    preferred = signals.get("preferred_skills") or []
    critical = signals.get("critical_requirements") or []
    matched: list[str] = []
    missing: list[str] = []
    blockers: list[str] = []

    if required:
        for skill in required:
            if _normalize_text(skill) in profile_stack_norm:
                matched.append(skill)
            else:
                missing.append(skill)
        ratio = len(matched) / max(len(required), 1)
        score = 40 * ratio
        for missing_skill in missing:
            normalized_missing = _normalize_text(missing_skill)
            if any(normalized_missing in _normalize_text(item) for item in critical):
                blockers.append(f"Falta skill critica: {missing_skill}")
        if len(required) >= 2 and not matched and critical:
            blockers.append("No cumples ninguna de las skills requeridas mas criticas")
        return score, matched, missing, blockers

    soft_matched = [skill for skill in preferred if _normalize_text(skill) in profile_stack_norm]
    soft_missing = [skill for skill in preferred if _normalize_text(skill) not in profile_stack_norm]
    score = 22 if soft_matched else 12 if profile_stack_norm else 0
    return score, soft_matched, soft_missing, blockers


def _score_role_alignment(profile_stack_norm: set[str], signals: dict, offer: dict) -> tuple[float, str | None]:
    role = _normalize_text(signals.get("normalized_role") or "") or _normalize_text(offer.get("titulo", ""))
    if not role:
        return 0, None
    stack_blob = " ".join(profile_stack_norm)
    for role_key, hints in ROLE_HINTS.items():
        if role_key in role:
            if any(_normalize_text(hint) in stack_blob for hint in hints):
                return 15, f"Rol alineado con {role_key}"
            return 5, f"Rol detectado: {role_key}"
    return 6 if profile_stack_norm else 0, None


def _score_seniority(profile_years: float | None, signals: dict) -> tuple[float, list[str], list[str]]:
    blockers: list[str] = []
    notes: list[str] = []
    required_years = signals.get("required_years_min")
    seniority = _normalize_text(signals.get("seniority_level") or "")

    if required_years is not None and profile_years is not None:
        gap = required_years - profile_years
        if gap <= 0:
            notes.append(f"Experiencia compatible ({required_years}+ anos requeridos)")
            return 15, notes, blockers
        if gap <= 1:
            notes.append(f"Experiencia algo justa frente a {required_years}+ anos")
            return 9, notes, blockers
        blockers.append(f"La oferta pide {required_years}+ anos y tu perfil se queda corto")
        return 2, notes, blockers

    if seniority in {"senior", "lead"} and profile_years is not None:
        if profile_years >= 5:
            notes.append("Seniority compatible con la oferta")
            return 15, notes, blockers
        if profile_years >= 3:
            notes.append("Seniority exigente pero cercano a tu experiencia")
            return 8, notes, blockers
        blockers.append("La oferta parece senior y tu experiencia actual es claramente menor")
        return 2, notes, blockers

    if seniority == "mid" and profile_years is not None:
        return (14 if profile_years >= 2 else 8), notes, blockers
    if seniority == "junior":
        return 15, notes, blockers
    # No explicit seniority or years: reward experienced profiles slightly
    if profile_years is not None and profile_years >= 4:
        notes.append("Experiencia solida para una oferta sin requisito de seniority explicito")
        return 11, notes, blockers
    return 8, notes, blockers


def _score_skill_depth(profile_stack_norm: set[str], profile_years: float | None, signals: dict) -> tuple[float, list[str], list[str]]:
    notes: list[str] = []
    blockers: list[str] = []
    requirements = signals.get("required_skill_years") or []
    if not requirements:
        return 0, notes, blockers

    matched_depth = 0
    for requirement in requirements[:4]:
        skill = str(requirement.get("skill") or "").strip()
        years = requirement.get("years")
        if not skill or not isinstance(years, int):
            continue

        skill_norm = _normalize_text(skill)
        if skill_norm not in profile_stack_norm:
            blockers.append(f"La oferta menciona {years}+ anos con {skill} y no aparece en tu stack")
            continue

        if profile_years is None:
            notes.append(f"Piden {years}+ anos con {skill}; conviene justificarlo mejor en el CV")
            matched_depth += 0.5
            continue

        gap = years - profile_years
        if gap <= 0:
            notes.append(f"Tu experiencia global puede sostener el requisito de {years}+ anos con {skill}")
            matched_depth += 1
        elif gap <= 1:
            notes.append(f"El requisito de {years}+ anos con {skill} puede quedarte algo justo")
            matched_depth += 0.5
        else:
            blockers.append(f"La oferta pide {years}+ anos con {skill} y tu experiencia declarada parece corta")

    score = min(10, matched_depth * 5)
    return score, _dedupe_keep_order(notes)[:3], _dedupe_keep_order(blockers)[:3]


def _score_constraint_signals(signals: dict) -> tuple[float, list[str]]:
    notes: list[str] = []
    hard_constraints = signals.get("hard_constraints") or []
    if hard_constraints:
        notes.append(f"Condicion a revisar: {hard_constraints[0]}")
    must_have = signals.get("must_have_requirements") or []
    if must_have:
        notes.append(f"Buscan explicitamente: {must_have[0]}")
    return (2 if must_have else 0), _dedupe_keep_order(notes)[:2]


def _score_languages(profile_languages: dict[str, int], signals: dict) -> tuple[float, list[str], list[str]]:
    blockers: list[str] = []
    notes: list[str] = []
    required_languages = signals.get("required_languages") or []
    if not required_languages:
        return 10, notes, blockers

    matched = 0
    for language_text in required_languages:
        language_key, minimum_level = _expand_language_requirement(language_text)
        current = max(profile_languages.get(language_key, 0), profile_languages.get(language_key.replace("ingles", "english"), 0))
        if current >= minimum_level:
            matched += 1
            notes.append(f"Cumples idioma requerido: {language_text}")
        else:
            blockers.append(f"Idioma requerido no cubierto: {language_text}")

    ratio = matched / max(len(required_languages), 1)
    return 10 * ratio, notes, blockers


def _score_work_mode(profile_modalities: set[str], profile_locations: set[str], signals: dict) -> tuple[float, list[str], list[str]]:
    blockers: list[str] = []
    notes: list[str] = []
    work_mode = _normalize_text(signals.get("work_mode") or "")
    location_constraints = {_normalize_text(item) for item in signals.get("location_constraints") or [] if item}

    if not work_mode or work_mode == "unknown":
        return 5, notes, blockers

    canonical_mode = "remote" if work_mode in WORK_MODE_REMOTE else "hybrid" if work_mode in WORK_MODE_HYBRID else "onsite" if work_mode in WORK_MODE_ONSITE else work_mode
    if not profile_modalities:
        return 8, notes, blockers

    if canonical_mode in profile_modalities:
        notes.append(f"Modalidad alineada: {canonical_mode}")
        return 8, notes, blockers

    if canonical_mode == "onsite":
        if not location_constraints or any(any(pref in loc or loc in pref for loc in location_constraints) for pref in profile_locations):
            notes.append("Modalidad presencial asumible por ubicacion")
            return 4, notes, blockers
        blockers.append("La oferta es presencial y no coincide con tu modalidad/ubicacion preferida")
        return 0, notes, blockers

    if canonical_mode == "hybrid" and "remote" in profile_modalities:
        notes.append("Oferta hibrida compatible de forma parcial")
        return 4, notes, blockers

    return 1, notes, blockers


def _score_location(profile_locations: set[str], signals: dict, offer: dict) -> tuple[float, list[str], list[str]]:
    blockers: list[str] = []
    notes: list[str] = []
    # Una oferta remota no se penaliza ni se bloquea por ubicación: el trabajo
    # remoto no depende de la ciudad del candidato.
    if _normalize_text(signals.get("work_mode") or "") in WORK_MODE_REMOTE:
        notes.append("Oferta remota: la ubicacion no es un bloqueante")
        return 7, notes, blockers
    constraints = {_normalize_text(item) for item in signals.get("location_constraints") or [] if item}
    offer_location = _normalize_text(offer.get("ubicacion", ""))
    if offer_location:
        constraints.add(offer_location)

    if not constraints or not profile_locations:
        return 6, notes, blockers

    for preferred in profile_locations:
        if any(preferred in constraint or constraint in preferred for constraint in constraints):
            notes.append("Ubicacion alineada con tus preferencias")
            return 8, notes, blockers

    if "toda espana" in profile_locations or "espana" in profile_locations:
        return 7, notes, blockers

    blockers.append("La ubicacion parece incompatible con tus preferencias")
    return 0, notes, blockers


def _score_minor_signals(profile_stack_norm: set[str], signals: dict) -> tuple[float, list[str]]:
    notes: list[str] = []
    preferred = signals.get("preferred_skills") or []
    if preferred:
        matched_preferred = [skill for skill in preferred if _normalize_text(skill) in profile_stack_norm]
        if matched_preferred:
            notes.append(f"Tambien cubres deseables: {', '.join(matched_preferred[:2])}")
            return 4, notes
        return 1, notes
    if signals.get("salary_signal"):
        return 2, notes
    return 0, notes


_RESULT_LABEL = {"APLICA": "APLICA", "QUIZÁ": "QUIZÁ", "NO_ENCAJA": "NO ENCAJA"}


def _compose_decision_reason(result: str, strengths: list[str], gaps: list[str], blockers: list[str]) -> str:
    label = _RESULT_LABEL.get(result, result)
    if blockers:
        return f"{label}: hay incompatibilidades importantes ({'; '.join(blockers[:2])})."
    # Para NO_ENCAJA nunca usamos un marco positivo ("encajas en lo esencial"):
    # sería contradictorio cuando no hay coincidencia real de skills.
    if result == "NO_ENCAJA":
        if gaps:
            return f"{label}: faltan requisitos clave ({'; '.join(gaps[:2])})."
        return f"{label}: coincidencia insuficiente con tu perfil."
    if strengths and not gaps:
        return f"{label}: cumples bien los requisitos principales y no se ven carencias criticas."
    if strengths and gaps:
        return f"{label}: encajas en lo esencial, pero quedan gaps a revisar ({'; '.join(gaps[:2])})."
    if gaps:
        return f"{label}: el titulo puede parecer alineado, pero faltan senales clave ({'; '.join(gaps[:2])})."
    return f"{label}: informacion limitada o encaje parcial."


def _has_visible_salary(offer: dict) -> bool:
    salary = str(offer.get("salario") or "").strip()
    if not salary:
        return False
    return _normalize_text(salary) not in {"salario no especificado", "no especificado"}


def _compute_offer_quality_score(offer: dict) -> tuple[float, list[str]]:
    score = 0.0
    notes: list[str] = []

    source_type = _normalize_text(offer.get("source_type"))
    if source_type == "official_api":
        score += 7.5
        notes.append("fuente oficial")
    elif source_type == "public_ats":
        score += 5.5
        notes.append("fuente directa")
    elif source_type == "career_page":
        score += 4.0
        notes.append("web de empresa")

    freshness_state = _normalize_text(offer.get("freshness_state"))
    freshness_bonus = {
        "verified_recently": 6.0,
        "verification_due": 3.0,
        "verification_pending": 0.5,
        "stale_verification": -3.5,
        "stale_listing": -5.5,
        "inactive": -14.0,
    }.get(freshness_state, 0.0)
    score += freshness_bonus
    if freshness_state == "verified_recently":
        notes.append("verificada recientemente")
    elif freshness_state == "stale_listing":
        notes.append("listado antiguo")
    elif freshness_state == "inactive":
        notes.append("inactiva")

    try:
        confidence = float(offer.get("source_confidence") or 0)
    except (TypeError, ValueError):
        confidence = 0.0
    score += max(0.0, confidence) * 12.0
    if confidence >= 0.85:
        notes.append("alta confianza")

    if offer.get("verified_recently"):
        score += 1.5
    if _has_visible_salary(offer):
        score += 2.0
        notes.append("salario visible")
    if offer.get("url") or offer.get("redirect_url") or offer.get("canonical_url"):
        score += 1.0

    return round(score, 2), _dedupe_keep_order(notes)[:3]


def _compute_ranking_score(
    match_score: int,
    required_skill_coverage: float,
    blocker_count: int,
    offer: dict,
) -> tuple[float, float, list[str]]:
    quality_score, quality_notes = _compute_offer_quality_score(offer)
    ranking_score = (
        float(match_score) * 1.25
        + float(required_skill_coverage or 0) * 18.0
        - float(blocker_count or 0) * 7.5
        + quality_score
    )
    return round(ranking_score, 2), quality_score, quality_notes


def _evaluate_offer_match(profile: dict, offer: dict, signals: dict) -> dict:
    _, profile_stack_norm = _normalize_profile_stack(profile)
    profile_years = _parse_years(profile.get("experience"))
    profile_languages = _normalize_profile_languages(profile)
    profile_modalities = _normalize_profile_modalities(profile)
    profile_locations = _normalize_profile_locations(profile)

    strengths: list[str] = []
    gaps: list[str] = []
    blockers: list[str] = []

    skills_score, matched_skills, missing_skills, skill_blockers = _score_required_skills(profile_stack_norm, signals)
    blockers.extend(skill_blockers)
    if matched_skills:
        strengths.append(f"Stack relevante cubierto: {', '.join(matched_skills[:3])}")
    if missing_skills:
        gaps.append(f"Te faltan skills clave: {', '.join(missing_skills[:3])}")

    role_score, role_note = _score_role_alignment(profile_stack_norm, signals, offer)
    if role_note and role_score >= 10:
        strengths.append(role_note)
    elif role_note:
        gaps.append(role_note)

    seniority_score, seniority_notes, seniority_blockers = _score_seniority(profile_years, signals)
    strengths.extend(seniority_notes[:1])
    blockers.extend(seniority_blockers)

    skill_depth_score, skill_depth_notes, skill_depth_blockers = _score_skill_depth(profile_stack_norm, profile_years, signals)
    strengths.extend(skill_depth_notes[:1])
    blockers.extend(skill_depth_blockers)

    language_score, language_notes, language_blockers = _score_languages(profile_languages, signals)
    strengths.extend(language_notes[:1])
    blockers.extend(language_blockers)

    mode_score, mode_notes, mode_blockers = _score_work_mode(profile_modalities, profile_locations, signals)
    strengths.extend(mode_notes[:1])
    blockers.extend(mode_blockers)

    location_score, location_notes, location_blockers = _score_location(profile_locations, signals, offer)
    strengths.extend(location_notes[:1])
    blockers.extend(location_blockers)

    minor_score, minor_notes = _score_minor_signals(profile_stack_norm, signals)
    strengths.extend(minor_notes[:1])

    constraint_score, constraint_notes = _score_constraint_signals(signals)
    gaps.extend(constraint_notes[:2])

    score = skills_score + role_score + seniority_score + skill_depth_score + language_score + mode_score + location_score + minor_score + constraint_score
    score = max(0, min(100, round(score)))

    if blockers:
        score = min(score, 44)
        result = "NO_ENCAJA"
    elif score >= 73:
        result = "APLICA"
    elif score >= 52:
        result = "QUIZÁ"
    else:
        result = "NO_ENCAJA"

    if result == "APLICA" and not matched_skills and signals.get("required_skills"):
        result = "QUIZÁ"
        score = min(score, 74)
        gaps.append("La descripcion no confirma suficiente cobertura de skills obligatorias")

    # Ghost-QUIZÁ suppression: score reached QUIZÁ threshold but no tech skill evidence at all.
    # This catches non-tech offers (operations, finance, sales) that drift into QUIZÁ territory
    # purely via role/seniority/language partial scores when the signals extractor found nothing.
    if (
        result == "QUIZÁ"
        and not matched_skills
        and not missing_skills
        and not signals.get("required_skills")
        and not signals.get("preferred_skills")
    ):
        result = "NO_ENCAJA"
        score = min(score, 49)
        gaps.append("Sin evidencia de skills tecnologicas en la oferta")
        print(f"[MATCH_FILTER] Ghost-QUIZA suprimido: '{offer.get('titulo', '')}' (score={score})")

    # Zero-match suppression: QUIZÁ but profile matches 0 out of 2+ required skills.
    # Prevents domain-mismatched offers (e.g., Data Science offer for a Go/Rust profile)
    # from appearing as QUIZÁ purely via seniority/language/location partial scores.
    # Guard: only fires when required_skills are real (Claude extracted them), not the soft path.
    if (
        result == "QUIZÁ"
        and not matched_skills
        and len(missing_skills) >= 2
        and signals.get("required_skills")
        and not blockers
    ):
        result = "NO_ENCAJA"
        score = min(score, 49)
        gaps.append("No cumples ninguna de las skills requeridas principales")
        print(f"[MATCH_FILTER] Zero-match QUIZA suprimido: '{offer.get('titulo', '')}' (score={score})")

    # Data-domain mismatch: APLICA on a data/ML offer but profile has no data-specific tools.
    # Catches cases like Cybersecurity or QA engineers scoring APLICA on DS roles purely via
    # generic skills (Python + SQL), when they lack any genuine data tooling (pandas, TF, etc.).
    # Guard: only demotes APLICA, not QUIZÁ — a generic Python profile at QUIZÁ for DS is fine.
    if (
        result == "APLICA"
        and _normalize_text(signals.get("normalized_role") or "") == "data"
        and not any(d in profile_stack_norm for d in DATA_SPECIFIC_SKILLS)
    ):
        result = "QUIZÁ"
        score = min(score, 69)
        gaps.append("Oferta de dominio Data/ML pero tu stack no incluye herramientas especializadas de datos")
        print(f"[MATCH_FILTER] Data-domain mismatch: '{offer.get('titulo', '')}' degradado a QUIZA (score={score})")

    strengths = _dedupe_keep_order(strengths)[:4]
    gaps = _dedupe_keep_order(gaps)[:4]
    blockers = _dedupe_keep_order(blockers)[:3]
    decision_reason = _compose_decision_reason(result, strengths, gaps, blockers)
    required_skill_coverage = len(matched_skills) / max(len(signals.get("required_skills") or []), 1) if (signals.get("required_skills") or []) else 0
    blocker_count = len(blockers)
    ranking_score, quality_score, quality_notes = _compute_ranking_score(
        score,
        required_skill_coverage,
        blocker_count,
        offer,
    )

    return {
        "id": offer["id"],
        "resultado": result,
        "puntuacion": score,
        "match_score": score,
        "ranking_score": ranking_score,
        "quality_score": quality_score,
        "quality_notes": quality_notes,
        "motivo": decision_reason,
        "decision_reason": decision_reason,
        "skills_match": matched_skills[:5],
        "skills_missing": missing_skills[:3],
        "strengths": strengths,
        "gaps": gaps,
        "blockers": blockers,
        "critical_gaps": blockers,
        "offer_requirements": {
            "critical": (signals.get("critical_requirements") or [])[:5],
            "must_have": (signals.get("must_have_requirements") or [])[:5],
            "nice_to_have": (signals.get("nice_to_have") or [])[:5],
            "hard_constraints": (signals.get("hard_constraints") or [])[:5],
            "required_skill_years": (signals.get("required_skill_years") or [])[:5],
        },
        "signals_summary": {
            "normalized_role": signals.get("normalized_role"),
            "seniority_level": signals.get("seniority_level"),
            "work_mode": signals.get("work_mode"),
            "required_years_min": signals.get("required_years_min"),
            "required_skill_years": (signals.get("required_skill_years") or [])[:3],
        },
        "_required_skill_coverage": required_skill_coverage,
        "_blocker_count": blocker_count,
    }


def _sort_by_fit(results: list[dict]) -> list[dict]:
    order = {"APLICA": 0, "QUIZÁ": 1, "NO_ENCAJA": 2}
    return sorted(
        results,
        key=lambda item: (
            order.get(item.get("resultado", "NO_ENCAJA"), 2),
            -(item.get("ranking_score") or 0),
            -(item.get("puntuacion") or 0),
            item.get("_blocker_count", 0),
            -(item.get("_required_skill_coverage") or 0),
            -(item.get("quality_score") or 0),
        ),
    )


def diversify_by_company(offers: list, max_per_company: int = 3) -> list:
    """Cap how many offers per company appear at the top, preserving order.

    Deterministic (no AI). Offers beyond the cap for a company are appended at
    the end instead of dropped, so nothing relevant is lost — diversity is
    preferred but the result set never shrinks. Shared by the agent and the
    classic match flow so one employer cannot flood either view.
    """
    counts: dict[str, int] = {}
    primary: list = []
    overflow: list = []
    for offer in offers:
        company = str(offer.get("empresa") or "").strip().lower()
        if not company:
            primary.append(offer)
            continue
        seen = counts.get(company, 0)
        if seen < max_per_company:
            counts[company] = seen + 1
            primary.append(offer)
        else:
            overflow.append(offer)
    return primary + overflow


def diversify_keep_tiers(offers: list, max_per_company: int = 4) -> list:
    """Cap offers per company WITHIN each result tier (APLICA > QUIZÁ > NO_ENCAJA).

    Unlike diversify_by_company, this never moves a higher-tier match below a
    lower-tier one: it diversifies inside each tier and concatenates tiers in
    order. Used by the classic match view so one employer cannot flood the list
    while keeping the fit ranking meaningful.
    """
    order = {"APLICA": 0, "QUIZÁ": 1, "NO_ENCAJA": 2}
    tiers: dict[int, list] = {0: [], 1: [], 2: []}
    for offer in offers:
        tiers[order.get(offer.get("resultado", "NO_ENCAJA"), 2)].append(offer)
    out: list = []
    for key in (0, 1, 2):
        out.extend(diversify_by_company(tiers[key], max_per_company))
    return out


def match_profile_with_offers(
    profile: dict,
    offers: list,
    api_key: str,
    db=None,
    profile_hash: str = None,
    user_id: int | None = None,
) -> list:
    del profile_hash

    # Pre-filter: skip offers with no detectable tech relevance in title+description.
    # This removes ops/finance/sales roles from Greenhouse boards before they reach
    # the signal extractor and the scorer, avoiding ghost-QUIZÁ results.
    tech_offers = [o for o in offers if _is_tech_offer(o)]
    filtered_count = len(offers) - len(tech_offers)
    if filtered_count:
        print(f"[MATCH_FILTER] {filtered_count}/{len(offers)} ofertas descartadas (sin indicadores tech)")

    signals_by_id = _extract_offer_signals(tech_offers, api_key, db=db, user_id=user_id)
    results = []
    for offer in tech_offers:
        signals = signals_by_id.get(offer["id"], _heuristic_offer_signals(offer))
        results.append(_evaluate_offer_match(profile, offer, signals))

    ranked = _sort_by_fit(results)
    trimmed = ranked[:MATCH_MAX_OFFERS_RETURNED]
    for item in trimmed:
        item.pop("_required_skill_coverage", None)
        item.pop("_blocker_count", None)
    return trimmed


def generate_skills_gap(
    profile: dict,
    offers: list,
    results: list,
    api_key: str,
    user_id: int | None = None,
) -> dict | None:
    result_by_id = {result["id"]: result for result in results}
    low_match: list[dict] = []

    for offer in offers:
        result = result_by_id.get(offer.get("id") or offer.get("adzuna_id"))
        if result and result.get("resultado") in ("NO_ENCAJA", "QUIZÁ"):
            low_match.append({
                "titulo": offer.get("titulo", ""),
                "descripcion": _truncate_description(offer.get("descripcion", ""), 1200),
                "resultado": result["resultado"],
                "decision_reason": result.get("decision_reason", ""),
                "skills_missing": result.get("skills_missing", []),
                "gaps": result.get("gaps", []),
                "blockers": result.get("blockers", []),
            })

    if not low_match:
        print("[SKILLS_GAP] No hay suficientes ofertas de bajo encaje")
        return None

    print(f"[SKILLS_GAP] Analizando {len(low_match)} ofertas de bajo encaje")
    client = anthropic.Anthropic(api_key=api_key)
    prompt = f"""Eres un orientador de carrera tech en Espana.

Analiza las ofertas con bajo encaje del candidato y detecta patrones comunes de mejora.
No inventes skills: usa solo senales que aparezcan en las ofertas.

Perfil:
- Experiencia: {profile.get("experience", "No indicado")}
- Stack: {", ".join(profile.get("stack", []))}
- Idiomas: {_build_idiomas_str(profile)}

Ofertas con bajo encaje:
{json.dumps(low_match[:15], ensure_ascii=False, indent=2)}

Devuelve UNICAMENTE un JSON valido con este formato:
{{
  "title": "Tu plan de mejora",
  "summary": "2-3 frases orientadas a accion",
  "recommended_skills": [
    {{
      "name": "TypeScript",
      "reason": "Aparece con frecuencia como requisito o gap en varias ofertas",
      "category": "tecnica",
      "demand_count": 4
    }}
  ]
}}
"""

    try:
        message = call_claude(lambda: client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1600,
            messages=[{"role": "user", "content": prompt}],
        ))
        record_ai_api_cost(
            user_id=user_id,
            feature="skills_gap",
            model="claude-haiku-4-5-20251001",
            usage=getattr(message, "usage", None),
            request_id=getattr(message, "id", None),
            metadata={"offers_considered": len(low_match[:15])},
        )
        parsed = _extract_json_payload(message.content[0].text)
        if not isinstance(parsed, dict):
            return None

        skills = []
        for item in parsed.get("recommended_skills", [])[:5]:
            if not isinstance(item, dict):
                continue
            demand_count = item.get("demand_count", 0)
            if not isinstance(demand_count, int):
                try:
                    demand_count = int(demand_count)
                except Exception:
                    demand_count = 0
            skills.append({
                "name": str(item.get("name", "Skill")).strip() or "Skill",
                "reason": str(item.get("reason", "")).strip(),
                "category": item.get("category") if item.get("category") in ("tecnica", "idioma", "experiencia", "modalidad") else "tecnica",
                "demand_count": max(0, demand_count),
            })

        if not skills:
            return None

        print(f"[SKILLS_GAP] Generadas {len(skills)} recomendaciones")
        return {
            "title": str(parsed.get("title", "Tu plan de mejora")).strip() or "Tu plan de mejora",
            "summary": str(parsed.get("summary", "")).strip(),
            "recommended_skills": skills,
        }
    except Exception as exc:
        print(f"[SKILLS_GAP] Error no critico: {exc}")
        return None
