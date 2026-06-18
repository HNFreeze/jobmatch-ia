import asyncio
import logging
import os

from app.services.job_index_service import normalize_offer_record

logger = logging.getLogger(__name__)


def _is_enabled() -> bool:
    return os.getenv("JOBSPY_ENABLED", "false").lower() in ("1", "true", "yes")


def _scrape_sync(skills: list[str], locations: list[str], results_per_skill: int) -> list[dict]:
    from jobspy import scrape_jobs  # lazy import — only when enabled

    if not locations or "Toda España" in locations:
        location = "Spain"
    else:
        location = locations[0]

    all_offers: list[dict] = []
    seen_keys: set[str] = set()

    for skill in skills[:6]:
        try:
            df = scrape_jobs(
                site_name=["indeed"],
                search_term=skill,
                location=location,
                results_wanted=results_per_skill,
                country_indeed="Spain",
                hours_old=720,  # last 30 days
                verbose=False,
            )
            if df is None or df.empty:
                logger.debug("JobSpy/Indeed: no results for skill='%s'", skill)
                continue

            for _, row in df.iterrows():
                job_url = str(row.get("job_url") or "")
                title = str(row.get("title") or "")
                company = str(row.get("company") or "")
                key = job_url or f"{title}|{company}"
                if not key or key in seen_keys:
                    continue
                seen_keys.add(key)

                salary = "Salario no especificado"
                min_amt = row.get("min_amount")
                max_amt = row.get("max_amount")
                currency = str(row.get("currency") or "EUR")
                if min_amt and max_amt:
                    salary = f"{int(min_amt):,} - {int(max_amt):,} {currency}/año"
                elif min_amt:
                    salary = f"Desde {int(min_amt):,} {currency}/año"
                elif max_amt:
                    salary = f"Hasta {int(max_amt):,} {currency}/año"

                date_posted = row.get("date_posted")
                fecha = (
                    date_posted.isoformat()
                    if date_posted and hasattr(date_posted, "isoformat")
                    else str(date_posted or "")
                )

                raw = {
                    "titulo": title,
                    "empresa": company,
                    "ubicacion": str(row.get("location") or location),
                    "descripcion": str(row.get("description") or ""),
                    "salario": salary,
                    "fecha_publicacion": fecha,
                    "redirect_url": job_url,
                    "source_metadata": {
                        "job_type": str(row.get("job_type") or ""),
                        "is_remote": bool(row.get("is_remote", False)),
                        "site": "indeed",
                        "search_skill": skill,
                    },
                }
                offer = normalize_offer_record(
                    "jobspy_indeed",
                    "aggregator",
                    raw,
                    source_job_id=job_url,
                    canonical_url=job_url,
                )
                all_offers.append(offer)

            logger.info("JobSpy/Indeed skill='%s': %d ofertas", skill, len(all_offers))
        except Exception as exc:
            logger.warning("JobSpy error for skill='%s': %s", skill, exc)

    return all_offers


async def fetch_offers_from_jobspy(
    skills: list[str],
    locations: list[str] | None = None,
    results_per_skill: int = 20,
) -> list[dict]:
    if not _is_enabled():
        logger.debug("JobSpy disabled (JOBSPY_ENABLED not set)")
        return []

    try:
        offers = await asyncio.to_thread(_scrape_sync, skills, locations or [], results_per_skill)
        logger.info("JobSpy total: %d ofertas para skills=%s", len(offers), skills[:3])
        return offers
    except Exception as exc:
        logger.error("JobSpy fetch_offers error: %s", exc)
        return []
