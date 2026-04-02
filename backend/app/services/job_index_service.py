import json
import re
import unicodedata
from datetime import datetime, timedelta


SPAIN_LOCATION_HINTS = {
    "spain",
    "espana",
    "madrid",
    "barcelona",
    "valencia",
    "sevilla",
    "malaga",
    "bilbao",
    "alicante",
    "zaragoza",
    "murcia",
    "granada",
    "palma",
    "vigo",
    "valladolid",
    "coruna",
    "a coruna",
    "gijon",
    "oviedo",
    "pamplona",
    "santander",
    "donostia",
    "san sebastian",
    "las palmas",
    "tenerife",
    "espana remoto",
    "remote spain",
    "remoto espana",
}


def normalize_text(value: str | None) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.lower().strip()
    return re.sub(r"\s+", " ", text)


def extract_skills(text: str, user_stack: list[str]) -> list[str]:
    text_lower = normalize_text(text)
    return [skill for skill in user_stack if normalize_text(skill) in text_lower]


def is_spain_location(location: str | None, description: str | None = None) -> bool:
    haystack = normalize_text(f"{location or ''} {description or ''}")
    return any(hint in haystack for hint in SPAIN_LOCATION_HINTS)


def matches_requested_locations(
    offer_location: str | None,
    requested_locations: list[str] | None,
    description: str | None = None,
) -> bool:
    if not requested_locations:
        return is_spain_location(offer_location, description)

    normalized_requested = [normalize_text(item) for item in requested_locations if item]
    haystack = normalize_text(f"{offer_location or ''} {description or ''}")
    if any(loc in {"toda espana", "espana", "españa"} for loc in normalized_requested):
        return is_spain_location(offer_location, description)
    return any(loc and loc in haystack for loc in normalized_requested)


def build_offer_dedupe_key(offer: dict) -> str:
    canonical_url = normalize_text(offer.get("canonical_url") or offer.get("redirect_url") or offer.get("url"))
    if canonical_url:
        return f"url::{canonical_url}"

    title = normalize_text(offer.get("titulo"))
    company = normalize_text(offer.get("canonical_company") or offer.get("empresa"))
    location = normalize_text(offer.get("ubicacion"))
    return f"offer::{title}|{company}|{location}"


def build_source_offer_id(source_name: str, source_job_id: str | None, fallback_url: str | None, title: str, company: str) -> str:
    normalized_source = normalize_text(source_name).replace(" ", "_") or "source"
    if source_job_id:
        return f"{normalized_source}:{source_job_id}"
    fallback = normalize_text(fallback_url) or normalize_text(f"{title}|{company}") or "unknown"
    return f"{normalized_source}:{fallback}"


def parse_datetime(value) -> datetime | None:
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return None


def compute_source_confidence(offer: dict) -> float:
    source_type = str(offer.get("source_type") or "aggregator").strip().lower()
    base_scores = {
        "official_api": 0.97,
        "public_ats": 0.92,
        "career_page": 0.88,
        "aggregator": 0.58,
    }
    score = base_scores.get(source_type, 0.5)

    if offer.get("redirect_url") or offer.get("canonical_url"):
        score += 0.02
    if offer.get("salario") and offer.get("salario") != "Salario no especificado":
        score += 0.02
    if offer.get("descripcion"):
        score += 0.01
    if is_spain_location(offer.get("ubicacion"), offer.get("descripcion")):
        score += 0.01

    fecha_publicacion = str(offer.get("fecha_publicacion") or "").strip()
    if fecha_publicacion:
        try:
            published = datetime.fromisoformat(fecha_publicacion.replace("Z", "+00:00"))
            age_days = (datetime.utcnow() - published.replace(tzinfo=None)).days
            if age_days <= 14:
                score += 0.02
        except Exception:
            pass

    return round(max(0.2, min(score, 0.99)), 2)


def compute_effective_source_confidence(offer: dict, *, now: datetime | None = None) -> float:
    if offer.get("is_active") is False:
        return 0.0

    now = now or datetime.utcnow()
    score = float(offer.get("base_source_confidence") or offer.get("source_confidence") or 0.58)

    last_verified_at = parse_datetime(offer.get("last_verified_at"))
    if last_verified_at is None:
        score -= 0.04
    else:
        verification_age_hours = max(0.0, (now - last_verified_at).total_seconds() / 3600)
        if verification_age_hours <= 24:
            score += 0.01
        elif verification_age_hours > 168:
            score -= 0.12
        elif verification_age_hours > 72:
            score -= 0.06
        elif verification_age_hours > 24:
            score -= 0.02

    last_seen_at = parse_datetime(offer.get("last_seen_at"))
    if last_seen_at is not None:
        seen_age_hours = max(0.0, (now - last_seen_at).total_seconds() / 3600)
        if seen_age_hours > 168:
            score -= 0.06
        elif seen_age_hours > 72:
            score -= 0.03

    published_at = parse_datetime(offer.get("fecha_publicacion"))
    if published_at is not None:
        published_age_days = max(0.0, (now - published_at).total_seconds() / 86400)
        if published_age_days > 60:
            score -= 0.05
        elif published_age_days > 30:
            score -= 0.03

    return round(max(0.2, min(score, 0.99)), 2)


def annotate_offer_freshness(offer: dict, *, now: datetime | None = None) -> dict:
    now = now or datetime.utcnow()
    annotated = dict(offer)
    last_verified_at = parse_datetime(annotated.get("last_verified_at"))
    last_seen_at = parse_datetime(annotated.get("last_seen_at"))

    freshness_state = "verification_pending"
    if annotated.get("is_active") is False:
        freshness_state = "inactive"
    elif last_verified_at is not None:
        verification_age_hours = max(0.0, (now - last_verified_at).total_seconds() / 3600)
        if verification_age_hours <= 24:
            freshness_state = "verified_recently"
        elif verification_age_hours <= 72:
            freshness_state = "verification_due"
        else:
            freshness_state = "stale_verification"

    if freshness_state != "inactive" and last_seen_at is not None:
        seen_age_hours = max(0.0, (now - last_seen_at).total_seconds() / 3600)
        if seen_age_hours > 168:
            freshness_state = "stale_listing"

    annotated["verified_recently"] = freshness_state == "verified_recently"
    annotated["freshness_state"] = freshness_state
    annotated["source_confidence"] = compute_effective_source_confidence(annotated, now=now)
    if last_verified_at is not None:
        annotated["last_verified_at"] = last_verified_at.isoformat()
    if last_seen_at is not None:
        annotated["last_seen_at"] = last_seen_at.isoformat()
    first_seen_at = parse_datetime(annotated.get("first_seen_at"))
    if first_seen_at is not None:
        annotated["first_seen_at"] = first_seen_at.isoformat()
    return annotated


def normalize_offer_record(
    source_name: str,
    source_type: str,
    raw_offer: dict,
    *,
    company_fallback: str | None = None,
    source_job_id: str | None = None,
    canonical_url: str | None = None,
) -> dict:
    now = datetime.utcnow()
    now_iso = now.isoformat()
    title = str(raw_offer.get("titulo") or raw_offer.get("title") or raw_offer.get("text") or "").strip()
    company = str(raw_offer.get("empresa") or raw_offer.get("company") or company_fallback or "").strip()
    location = str(raw_offer.get("ubicacion") or raw_offer.get("location") or "").strip()
    description = str(
        raw_offer.get("descripcion")
        or raw_offer.get("descriptionPlain")
        or raw_offer.get("description")
        or raw_offer.get("content")
        or ""
    ).strip()
    redirect_url = str(
        raw_offer.get("redirect_url")
        or raw_offer.get("applyUrl")
        or raw_offer.get("jobUrl")
        or raw_offer.get("absolute_url")
        or raw_offer.get("hostedUrl")
        or canonical_url
        or ""
    ).strip()
    canonical_company = str(raw_offer.get("canonical_company") or company or "").strip()
    canonical_url_value = str(canonical_url or redirect_url or raw_offer.get("url") or "").strip()
    external_id = str(
        source_job_id
        or raw_offer.get("source_job_id")
        or raw_offer.get("id")
        or raw_offer.get("internal_job_id")
        or raw_offer.get("adzuna_id")
        or ""
    ).strip()

    offer = {
        "id": raw_offer.get("id"),
        "adzuna_id": build_source_offer_id(source_name, external_id or None, canonical_url_value or None, title, canonical_company),
        "titulo": title or "Oferta sin titulo",
        "empresa": canonical_company or company or source_name.title(),
        "ubicacion": location or "Ubicacion no indicada",
        "descripcion": description,
        "salario": str(raw_offer.get("salario") or raw_offer.get("salary") or "Salario no especificado").strip() or "Salario no especificado",
        "fecha_publicacion": str(
            raw_offer.get("fecha_publicacion")
            or raw_offer.get("publishedAt")
            or raw_offer.get("updatedDate")
            or raw_offer.get("updated_at")
            or raw_offer.get("published")
            or raw_offer.get("created")
            or ""
        ).strip(),
        "redirect_url": redirect_url,
        "url": redirect_url,
        "canonical_url": canonical_url_value,
        "canonical_company": canonical_company or company,
        "source_name": source_name,
        "source_type": source_type,
        "source_job_id": external_id or None,
        "source_metadata": raw_offer.get("source_metadata") or {},
        "raw_payload": raw_offer,
        "first_seen_at": raw_offer.get("first_seen_at") or now_iso,
        "last_seen_at": raw_offer.get("last_seen_at") or now_iso,
        "last_verified_at": raw_offer.get("last_verified_at") or now_iso,
        "is_active": raw_offer.get("is_active", True),
    }
    offer["base_source_confidence"] = compute_source_confidence(offer)
    offer["source_confidence"] = offer["base_source_confidence"]
    return annotate_offer_freshness(offer, now=now)


def serialize_job_offer_row(row) -> dict:
    offer = {
        "adzuna_id": row.adzuna_id,
        "id": None,
        "titulo": row.titulo or "",
        "empresa": row.empresa or "",
        "ubicacion": row.ubicacion or "",
        "descripcion": row.descripcion or "",
        "salario": row.salario or "Salario no especificado",
        "fecha_publicacion": row.fecha_publicacion or "",
        "redirect_url": row.url or "",
        "url": row.url or "",
        "canonical_url": row.canonical_url or row.url or "",
        "canonical_company": row.canonical_company or row.empresa or "",
        "source_name": row.source_name or "adzuna",
        "source_type": row.source_type or "aggregator",
        "source_job_id": row.source_job_id or row.adzuna_id,
        "base_source_confidence": float(row.source_confidence or 0.58),
        "source_confidence": float(row.source_confidence or 0.58),
        "source_metadata": json.loads(row.source_metadata_json) if row.source_metadata_json else {},
        "raw_payload": json.loads(row.raw_payload_json) if row.raw_payload_json else {},
        "first_seen_at": row.first_seen_at.isoformat() if row.first_seen_at else None,
        "last_seen_at": row.last_seen_at.isoformat() if row.last_seen_at else None,
        "last_verified_at": row.last_verified_at.isoformat() if row.last_verified_at else None,
        "is_active": bool(row.is_active),
    }
    return annotate_offer_freshness(offer)


def get_recent_db_offers(db, stack: list[str], *, hours: int = 24) -> list[dict]:
    from app.models.job_offer import JobOffer

    cutoff = datetime.utcnow() - timedelta(hours=hours)
    rows = (
        db.query(JobOffer)
        .filter(JobOffer.is_active.is_(True))
        .filter((JobOffer.last_seen_at >= cutoff) | (JobOffer.created_at >= cutoff))
        .all()
    )

    stack_lower = {normalize_text(skill) for skill in stack}
    relevant = []
    for row in rows:
        skills = json.loads(row.skills_detectadas) if row.skills_detectadas else []
        if stack_lower and not any(normalize_text(skill) in stack_lower for skill in skills):
            continue
        relevant.append(serialize_job_offer_row(row))
    return relevant


def save_offers_to_db(db, offers: list[dict], stack: list[str]):
    from app.models.job_offer import JobOffer

    offer_ids = [offer.get("adzuna_id") for offer in offers if offer.get("adzuna_id")]
    existing_rows = {}
    if offer_ids:
        existing_rows = {
            row.adzuna_id: row
            for row in db.query(JobOffer).filter(JobOffer.adzuna_id.in_(offer_ids)).all()
        }

    now = datetime.utcnow()
    touched = 0
    for offer in offers:
        offer_id = offer.get("adzuna_id")
        if not offer_id:
            continue

        text = f"{offer.get('descripcion', '')} {offer.get('titulo', '')}"
        skills = extract_skills(text, stack)
        row = existing_rows.get(offer_id)
        merged_source_metadata = offer.get("source_metadata") or {}
        if row and row.source_metadata_json:
            try:
                existing_metadata = json.loads(row.source_metadata_json) or {}
                if "verification" in existing_metadata and "verification" not in merged_source_metadata:
                    merged_source_metadata = {**merged_source_metadata, "verification": existing_metadata["verification"]}
            except Exception:
                pass
        source_metadata_json = json.dumps(merged_source_metadata, ensure_ascii=False)
        raw_payload_json = json.dumps(offer.get("raw_payload") or {}, ensure_ascii=False)
        canonical_url = offer.get("canonical_url") or offer.get("redirect_url") or ""
        canonical_company = offer.get("canonical_company") or offer.get("empresa") or ""
        source_confidence = float(
            offer.get("base_source_confidence")
            or offer.get("source_confidence")
            or compute_source_confidence(offer)
        )
        first_seen_at = parse_datetime(offer.get("first_seen_at")) or now
        last_seen_at = parse_datetime(offer.get("last_seen_at")) or now
        last_verified_at = parse_datetime(offer.get("last_verified_at")) or now

        if row:
            row.titulo = offer.get("titulo", "")
            row.empresa = offer.get("empresa", "")
            row.ubicacion = offer.get("ubicacion", "")
            row.descripcion = offer.get("descripcion", "")
            row.salario = offer.get("salario", "")
            row.fecha_publicacion = offer.get("fecha_publicacion", "")
            row.url = offer.get("redirect_url", "")
            row.skills_detectadas = json.dumps(skills, ensure_ascii=False)
            row.source_name = offer.get("source_name")
            row.source_type = offer.get("source_type")
            row.source_job_id = offer.get("source_job_id")
            row.source_confidence = source_confidence
            row.source_metadata_json = source_metadata_json
            row.raw_payload_json = raw_payload_json
            row.canonical_url = canonical_url
            row.canonical_company = canonical_company
            row.first_seen_at = row.first_seen_at or first_seen_at
            row.last_seen_at = last_seen_at
            row.last_verified_at = last_verified_at
            row.is_active = bool(offer.get("is_active", True))
        else:
            db.add(
                JobOffer(
                    adzuna_id=offer_id,
                    titulo=offer.get("titulo", ""),
                    empresa=offer.get("empresa", ""),
                    ubicacion=offer.get("ubicacion", ""),
                    descripcion=offer.get("descripcion", ""),
                    salario=offer.get("salario", ""),
                    fecha_publicacion=offer.get("fecha_publicacion", ""),
                    url=offer.get("redirect_url", ""),
                    skills_detectadas=json.dumps(skills, ensure_ascii=False),
                    source_name=offer.get("source_name"),
                    source_type=offer.get("source_type"),
                    source_job_id=offer.get("source_job_id"),
                    source_confidence=source_confidence,
                    source_metadata_json=source_metadata_json,
                    raw_payload_json=raw_payload_json,
                    canonical_url=canonical_url,
                    canonical_company=canonical_company,
                    first_seen_at=first_seen_at,
                    last_seen_at=last_seen_at,
                    last_verified_at=last_verified_at,
                    is_active=bool(offer.get("is_active", True)),
                )
            )
        touched += 1

    if touched:
        db.commit()
