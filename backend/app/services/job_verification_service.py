import json
import os
from datetime import datetime, timedelta

import httpx

from app.models.job_offer import JobOffer
from app.services.job_index_service import compute_source_confidence, normalize_text


INACTIVE_HINTS = (
    "job is no longer available",
    "position has been filled",
    "no longer accepting applications",
    "this position has been closed",
    "this job has expired",
    "esta oferta ya no esta disponible",
    "esta oferta ya no esta activa",
    "vacante cerrada",
    "puesto cubierto",
    "proceso finalizado",
    "oferta expirada",
    "esta vacante ya no se encuentra disponible",
)


def _verification_timeout_seconds() -> float:
    return float(os.getenv("JOB_VERIFICATION_TIMEOUT_SECONDS", "6") or "6")


def _verification_stale_hours() -> int:
    return int(os.getenv("JOB_VERIFICATION_STALE_HOURS", "24") or "24")


def _verification_max_batch() -> int:
    return int(os.getenv("JOB_VERIFICATION_MAX_BATCH", "4") or "4")


def needs_offer_verification(row, *, now: datetime | None = None, stale_hours: int | None = None) -> bool:
    now = now or datetime.utcnow()
    stale_hours = stale_hours or _verification_stale_hours()
    if not getattr(row, "is_active", True):
        return False
    if not (getattr(row, "canonical_url", None) or getattr(row, "url", None)):
        return False

    last_verified_at = getattr(row, "last_verified_at", None)
    if last_verified_at is None:
        return True
    return last_verified_at <= now - timedelta(hours=stale_hours)


def classify_offer_check_result(status_code: int | None, body_text: str | None = None) -> dict:
    normalized_body = normalize_text(body_text or "")
    if status_code in {404, 410, 451}:
        return {"status": "inactive", "reason": f"http_{status_code}"}
    if any(hint in normalized_body for hint in INACTIVE_HINTS):
        return {"status": "inactive", "reason": "closure_hint"}
    if status_code in {401, 403, 429}:
        return {"status": "unknown", "reason": f"http_{status_code}"}
    if status_code is None or status_code >= 500:
        return {"status": "unknown", "reason": "upstream_error"}
    if 200 <= status_code < 300:
        return {"status": "active", "reason": f"http_{status_code}"}
    return {"status": "unknown", "reason": f"http_{status_code}"}


async def _check_offer_url(client: httpx.AsyncClient, url: str) -> dict:
    try:
        response = await client.get(
            url,
            follow_redirects=True,
            headers={
                "User-Agent": "JobMatchIA/1.0 (+job-offer-verifier)",
                "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
            },
        )
        content_type = response.headers.get("content-type", "")
        body_text = ""
        if "text" in content_type or "html" in content_type or not content_type:
            body_text = response.text[:5000]
        classification = classify_offer_check_result(response.status_code, body_text)
        return {
            **classification,
            "http_status": response.status_code,
            "final_url": str(response.url),
        }
    except (httpx.TimeoutException, httpx.ConnectError):
        return {"status": "unknown", "reason": "timeout", "http_status": None, "final_url": url}
    except Exception:
        return {"status": "unknown", "reason": "request_error", "http_status": None, "final_url": url}


def _build_verification_metadata(existing_json: str | None, result: dict, checked_at: datetime) -> str:
    try:
        metadata = json.loads(existing_json or "") if existing_json else {}
    except Exception:
        metadata = {}

    metadata["verification"] = {
        "status": result.get("status"),
        "reason": result.get("reason"),
        "http_status": result.get("http_status"),
        "final_url": result.get("final_url"),
        "checked_at": checked_at.isoformat(),
    }
    return json.dumps(metadata, ensure_ascii=False)


async def refresh_stale_job_offers(db, *, max_offers: int | None = None) -> dict:
    if db is None:
        return {"checked": 0, "inactive": 0, "refreshed": 0}

    now = datetime.utcnow()
    batch_size = max_offers or _verification_max_batch()
    candidates = [
        row
        for row in db.query(JobOffer).all()
        if needs_offer_verification(row, now=now)
    ]
    candidates.sort(key=lambda row: getattr(row, "last_verified_at", None) or datetime.min)
    candidates = candidates[:batch_size]
    if not candidates:
        return {"checked": 0, "inactive": 0, "refreshed": 0}

    inactive = 0
    refreshed = 0
    timeout = httpx.Timeout(_verification_timeout_seconds())
    async with httpx.AsyncClient(timeout=timeout) as client:
        for row in candidates:
            url = row.canonical_url or row.url
            result = await _check_offer_url(client, url)
            row.last_verified_at = now
            row.source_metadata_json = _build_verification_metadata(row.source_metadata_json, result, now)

            base_offer = {
                "source_type": row.source_type,
                "redirect_url": row.url,
                "canonical_url": row.canonical_url,
                "salario": row.salario,
                "descripcion": row.descripcion,
                "ubicacion": row.ubicacion,
                "fecha_publicacion": row.fecha_publicacion,
            }
            base_confidence = compute_source_confidence(base_offer)

            if result["status"] == "inactive":
                row.is_active = False
                row.source_confidence = max(0.2, round(float(row.source_confidence or base_confidence) - 0.25, 2))
                inactive += 1
            elif result["status"] == "active":
                row.is_active = True
                row.source_confidence = max(float(row.source_confidence or 0), base_confidence)
                refreshed += 1
            else:
                row.is_active = True
                row.source_confidence = max(0.25, round(float(row.source_confidence or base_confidence) - 0.03, 2))

    db.commit()
    return {"checked": len(candidates), "inactive": inactive, "refreshed": refreshed}
