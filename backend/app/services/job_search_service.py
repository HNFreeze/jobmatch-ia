from app.services.adzuna_service import fetch_offers_from_adzuna
from app.services.job_index_service import build_offer_dedupe_key, get_recent_db_offers, save_offers_to_db
from app.services.official_sources_service import fetch_offers_from_public_sources
from app.services.job_verification_service import refresh_stale_job_offers


def _dedupe_and_sort_offers(offers: list[dict]) -> list[dict]:
    deduped = {}
    for offer in offers:
        key = build_offer_dedupe_key(offer)
        current = deduped.get(key)
        if not current:
            deduped[key] = offer
            continue

        current_score = float(current.get("source_confidence") or 0)
        new_score = float(offer.get("source_confidence") or 0)
        if new_score > current_score:
            deduped[key] = offer
    return sorted(
        deduped.values(),
        key=lambda item: (
            -(float(item.get("source_confidence") or 0)),
            str(item.get("fecha_publicacion") or ""),
            str(item.get("titulo") or ""),
        ),
    )


async def fetch_offers_for_search(
    skills: list[str],
    locations: list[str] | None = None,
    db=None,
) -> list[dict] | None:
    if db:
        try:
            await refresh_stale_job_offers(db)
        except Exception:
            pass

    cached_offers = get_recent_db_offers(db, skills) if db else []

    official_offers = await fetch_offers_from_public_sources(skills, locations=locations)
    if db and official_offers:
        save_offers_to_db(db, official_offers, skills)

    combined = _dedupe_and_sort_offers([*cached_offers, *official_offers])
    if len(combined) >= 10:
        for index, offer in enumerate(combined, 1):
            offer["id"] = index
        return combined

    fallback_offers = await fetch_offers_from_adzuna(skills, locations=locations, db=None)
    if db and fallback_offers:
        save_offers_to_db(db, fallback_offers, skills)

    merged = _dedupe_and_sort_offers([*combined, *(fallback_offers or [])])
    if not merged:
        return None

    for index, offer in enumerate(merged, 1):
        offer["id"] = index
    return merged
