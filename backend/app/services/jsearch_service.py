import logging
import os

import httpx

from app.services.job_index_service import normalize_offer_record

logger = logging.getLogger(__name__)


async def fetch_offers_from_jsearch(
    skills: list[str],
    locations: list[str] | None = None,
    results_per_skill: int = 10,
) -> list[dict]:
    api_key = os.getenv("JSEARCH_API_KEY", "").strip()
    if not api_key:
        logger.debug("JSearch disabled (JSEARCH_API_KEY not set)")
        return []

    if locations and "Toda España" not in locations:
        location_hint = locations[0]
    else:
        location_hint = "Spain"

    all_offers: list[dict] = []
    seen_keys: set[str] = set()
    headers = {
        "X-RapidAPI-Key": api_key,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        for skill in skills[:6]:
            query = f"{skill} {location_hint}"
            try:
                response = await client.get(
                    "https://jsearch.p.rapidapi.com/search",
                    headers=headers,
                    params={
                        "query": query,
                        "page": "1",
                        "num_pages": "1",
                        "country": "es",
                        "date_posted": "month",
                    },
                )
                response.raise_for_status()
                jobs = response.json().get("data") or []

                for job in jobs[:results_per_skill]:
                    job_id = str(job.get("job_id") or "")
                    apply_link = str(job.get("job_apply_link") or "")
                    key = job_id or apply_link
                    if not key or key in seen_keys:
                        continue
                    seen_keys.add(key)

                    salary = "Salario no especificado"
                    s_min = job.get("job_min_salary")
                    s_max = job.get("job_max_salary")
                    s_period = str(job.get("job_salary_period") or "año")
                    if s_min and s_max:
                        salary = f"{int(s_min):,} - {int(s_max):,}/{s_period}"
                    elif s_min:
                        salary = f"Desde {int(s_min):,}/{s_period}"
                    elif s_max:
                        salary = f"Hasta {int(s_max):,}/{s_period}"

                    city = str(job.get("job_city") or "")
                    state = str(job.get("job_state") or "")
                    ubicacion = ", ".join(filter(None, [city, state])) or "España"

                    raw = {
                        "titulo": str(job.get("job_title") or ""),
                        "empresa": str(job.get("employer_name") or ""),
                        "ubicacion": ubicacion,
                        "descripcion": str(job.get("job_description") or ""),
                        "salario": salary,
                        "fecha_publicacion": str(job.get("job_posted_at_datetime_utc") or ""),
                        "redirect_url": apply_link,
                        "source_metadata": {
                            "employment_type": job.get("job_employment_type"),
                            "is_remote": job.get("job_is_remote", False),
                            "publisher": job.get("job_publisher"),
                            "required_skills": job.get("job_required_skills") or [],
                            "search_skill": skill,
                        },
                    }
                    offer = normalize_offer_record(
                        "jsearch",
                        "aggregator",
                        raw,
                        source_job_id=job_id or apply_link,
                        canonical_url=apply_link,
                    )
                    all_offers.append(offer)

                logger.info("JSearch skill='%s': %d resultados", skill, len(jobs))
            except httpx.HTTPStatusError as exc:
                logger.warning("JSearch HTTP %s for skill='%s'", exc.response.status_code, skill)
            except Exception as exc:
                logger.warning("JSearch error for skill='%s': %s", skill, exc)

    logger.info("JSearch total: %d ofertas para skills=%s", len(all_offers), skills[:3])
    return all_offers
