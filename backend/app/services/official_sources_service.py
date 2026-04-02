import os
import re

import httpx

from app.services.job_index_service import matches_requested_locations, normalize_offer_record


def _parse_list_env(name: str) -> list[str]:
    raw = os.getenv(name, "")
    return [item.strip() for item in raw.split(",") if item.strip()]


def _strip_html(value: str | None) -> str:
    text = re.sub(r"<[^>]+>", " ", str(value or ""))
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _build_infojobs_auth() -> httpx.BasicAuth | None:
    client_id = os.getenv("INFOJOBS_CLIENT_ID", "").strip()
    client_secret = os.getenv("INFOJOBS_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        return None
    return httpx.BasicAuth(client_id, client_secret)


def _infojobs_location_label(job: dict) -> str:
    city = (job.get("city") or {}).get("value") if isinstance(job.get("city"), dict) else job.get("city")
    province = (job.get("province") or {}).get("value") if isinstance(job.get("province"), dict) else job.get("province")
    country = (job.get("country") or {}).get("value") if isinstance(job.get("country"), dict) else job.get("country")
    parts = [str(part).strip() for part in (city, province, country) if str(part or "").strip()]
    if not parts:
        return "Espana"
    return ", ".join(parts)


async def _fetch_infojobs_offers(
    client: httpx.AsyncClient,
    auth: httpx.BasicAuth,
    skills: list[str],
    locations: list[str] | None = None,
) -> list[dict]:
    max_results = int(os.getenv("INFOJOBS_MAX_RESULTS", "50") or "50")
    params: list[tuple[str, str | int]] = [
        ("maxResults", max_results),
        ("q", " ".join(skills[:5]) or "developer"),
    ]

    res = await client.get(
        "https://api.infojobs.net/api/9/offer",
        params=params,
        auth=auth,
        headers={"Accept": "application/json"},
    )
    res.raise_for_status()
    payload = res.json()

    items = payload.get("items") if isinstance(payload, dict) else payload
    offers = []
    for job in items or []:
        author = job.get("author") or {}
        contract_type = job.get("contractType") or {}
        teleworking = job.get("teleworking") or {}
        offers.append(
            normalize_offer_record(
                "infojobs",
                "official_api",
                {
                    "id": job.get("id"),
                    "titulo": job.get("title"),
                    "empresa": author.get("name") or "InfoJobs",
                    "ubicacion": _infojobs_location_label(job),
                    "descripcion": _strip_html(job.get("description") or job.get("requirementMin")),
                    "salario": job.get("salaryDescription") or "Salario no especificado",
                    "fecha_publicacion": job.get("updatedDate") or job.get("published"),
                    "redirect_url": job.get("link"),
                    "source_metadata": {
                        "category": (job.get("category") or {}).get("value") if isinstance(job.get("category"), dict) else job.get("category"),
                        "subcategory": (job.get("subcategory") or {}).get("value") if isinstance(job.get("subcategory"), dict) else job.get("subcategory"),
                        "contract_type": contract_type.get("value") if isinstance(contract_type, dict) else contract_type,
                        "teleworking": teleworking.get("value") if isinstance(teleworking, dict) else teleworking,
                        "experience_min": (job.get("experienceMin") or {}).get("value") if isinstance(job.get("experienceMin"), dict) else job.get("experienceMin"),
                        "study": (job.get("study") or {}).get("value") if isinstance(job.get("study"), dict) else job.get("study"),
                    },
                },
                company_fallback=author.get("name") or "InfoJobs",
                source_job_id=str(job.get("id") or ""),
                canonical_url=job.get("link"),
            )
        )
    return offers


async def _fetch_greenhouse_board(client: httpx.AsyncClient, board_token: str) -> list[dict]:
    board_res = await client.get(f"https://boards-api.greenhouse.io/v1/boards/{board_token}")
    board_res.raise_for_status()
    board_data = board_res.json()
    company_name = str(board_data.get("name") or board_token).strip()

    jobs_res = await client.get(
        f"https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs",
        params={"content": "true"},
    )
    jobs_res.raise_for_status()
    payload = jobs_res.json()
    offers = []
    for job in payload.get("jobs", []):
        offers.append(
            normalize_offer_record(
                "greenhouse",
                "public_ats",
                {
                    "id": job.get("id"),
                    "titulo": job.get("title"),
                    "ubicacion": (job.get("location") or {}).get("name", ""),
                    "descripcion": _strip_html(job.get("content")),
                    "fecha_publicacion": job.get("updated_at"),
                    "redirect_url": job.get("absolute_url"),
                    "source_metadata": {
                        "board_token": board_token,
                        "language": job.get("language"),
                        "departments": [item.get("name") for item in job.get("departments") or [] if item.get("name")],
                        "offices": [item.get("name") for item in job.get("offices") or [] if item.get("name")],
                    },
                },
                company_fallback=company_name,
                source_job_id=str(job.get("id") or ""),
                canonical_url=job.get("absolute_url"),
            )
        )
    return offers


async def _fetch_ashby_board(client: httpx.AsyncClient, board_name: str) -> list[dict]:
    res = await client.get(
        f"https://api.ashbyhq.com/posting-api/job-board/{board_name}",
        params={"includeCompensation": "true"},
    )
    res.raise_for_status()
    payload = res.json()

    offers = []
    for job in payload.get("jobs", []):
        compensation = job.get("compensation") or {}
        salary_summary = compensation.get("scrapeableCompensationSalarySummary") or compensation.get("compensationTierSummary")
        offers.append(
            normalize_offer_record(
                "ashby",
                "public_ats",
                {
                    "id": job.get("jobUrl") or job.get("applyUrl") or job.get("title"),
                    "titulo": job.get("title"),
                    "ubicacion": job.get("location"),
                    "descripcion": job.get("descriptionPlain") or _strip_html(job.get("descriptionHtml")),
                    "salario": salary_summary or "Salario no especificado",
                    "fecha_publicacion": job.get("publishedAt"),
                    "redirect_url": job.get("applyUrl") or job.get("jobUrl"),
                    "source_metadata": {
                        "board_name": board_name,
                        "department": job.get("department"),
                        "team": job.get("team"),
                        "workplace_type": job.get("workplaceType"),
                        "employment_type": job.get("employmentType"),
                        "is_remote": job.get("isRemote"),
                    },
                },
                company_fallback=board_name,
                source_job_id=str(job.get("jobUrl") or job.get("applyUrl") or job.get("title") or ""),
                canonical_url=job.get("jobUrl") or job.get("applyUrl"),
            )
        )
    return offers


async def _fetch_lever_site(client: httpx.AsyncClient, site_name: str, *, eu_instance: bool = False) -> list[dict]:
    base_url = "https://api.eu.lever.co/v0/postings" if eu_instance else "https://api.lever.co/v0/postings"
    res = await client.get(f"{base_url}/{site_name}", params={"mode": "json", "limit": 100})
    res.raise_for_status()
    payload = res.json()

    offers = []
    for job in payload:
        categories = job.get("categories") or {}
        salary_range = job.get("salaryRange") or {}
        salary_text = "Salario no especificado"
        if salary_range.get("min") or salary_range.get("max"):
            min_value = salary_range.get("min")
            max_value = salary_range.get("max")
            currency = salary_range.get("currency") or ""
            interval = salary_range.get("interval") or ""
            if min_value and max_value:
                salary_text = f"{min_value} - {max_value} {currency}/{interval}".strip()
            elif min_value:
                salary_text = f"Desde {min_value} {currency}/{interval}".strip()
            elif max_value:
                salary_text = f"Hasta {max_value} {currency}/{interval}".strip()

        offers.append(
            normalize_offer_record(
                "lever",
                "public_ats",
                {
                    "id": job.get("id"),
                    "titulo": job.get("text"),
                    "ubicacion": categories.get("location"),
                    "descripcion": job.get("descriptionPlain") or _strip_html(job.get("description")),
                    "salario": salary_text,
                    "redirect_url": job.get("hostedUrl") or job.get("applyUrl"),
                    "source_metadata": {
                        "site_name": site_name,
                        "team": categories.get("team"),
                        "department": categories.get("department"),
                        "commitment": categories.get("commitment"),
                        "country": job.get("country"),
                        "workplace_type": job.get("workplaceType"),
                    },
                },
                company_fallback=site_name,
                source_job_id=str(job.get("id") or ""),
                canonical_url=job.get("hostedUrl") or job.get("applyUrl"),
            )
        )
    return offers


async def fetch_offers_from_public_sources(
    skills: list[str],
    locations: list[str] | None = None,
) -> list[dict]:
    result = await fetch_offers_from_public_sources_with_details(skills, locations=locations)
    return result["offers"]


async def fetch_offers_from_public_sources_with_details(
    skills: list[str],
    locations: list[str] | None = None,
) -> dict:
    infojobs_auth = _build_infojobs_auth()
    greenhouse_boards = _parse_list_env("GREENHOUSE_BOARD_TOKENS")
    ashby_boards = _parse_list_env("ASHBY_JOB_BOARD_NAMES")
    lever_sites = _parse_list_env("LEVER_SITE_NAMES")
    lever_eu_sites = _parse_list_env("LEVER_EU_SITE_NAMES")

    if not any((infojobs_auth, greenhouse_boards, ashby_boards, lever_sites, lever_eu_sites)):
        return {"offers": [], "sources": []}

    offers = []
    source_logs = []
    async with httpx.AsyncClient(timeout=20.0) as client:
        if infojobs_auth:
            try:
                source_offers = await _fetch_infojobs_offers(client, infojobs_auth, skills, locations=locations)
                offers.extend(source_offers)
                source_logs.append({"source": "infojobs", "status": "ok", "fetched_count": len(source_offers)})
            except Exception as exc:
                source_logs.append({"source": "infojobs", "status": "error", "error": str(exc)[:240], "fetched_count": 0})

        for board_token in greenhouse_boards:
            try:
                source_offers = await _fetch_greenhouse_board(client, board_token)
                offers.extend(source_offers)
                source_logs.append({"source": f"greenhouse:{board_token}", "status": "ok", "fetched_count": len(source_offers)})
            except Exception as exc:
                source_logs.append({"source": f"greenhouse:{board_token}", "status": "error", "error": str(exc)[:240], "fetched_count": 0})
                continue

        for board_name in ashby_boards:
            try:
                source_offers = await _fetch_ashby_board(client, board_name)
                offers.extend(source_offers)
                source_logs.append({"source": f"ashby:{board_name}", "status": "ok", "fetched_count": len(source_offers)})
            except Exception as exc:
                source_logs.append({"source": f"ashby:{board_name}", "status": "error", "error": str(exc)[:240], "fetched_count": 0})
                continue

        for site_name in lever_sites:
            try:
                source_offers = await _fetch_lever_site(client, site_name, eu_instance=False)
                offers.extend(source_offers)
                source_logs.append({"source": f"lever:{site_name}", "status": "ok", "fetched_count": len(source_offers)})
            except Exception as exc:
                source_logs.append({"source": f"lever:{site_name}", "status": "error", "error": str(exc)[:240], "fetched_count": 0})
                continue

        for site_name in lever_eu_sites:
            try:
                source_offers = await _fetch_lever_site(client, site_name, eu_instance=True)
                offers.extend(source_offers)
                source_logs.append({"source": f"lever_eu:{site_name}", "status": "ok", "fetched_count": len(source_offers)})
            except Exception as exc:
                source_logs.append({"source": f"lever_eu:{site_name}", "status": "error", "error": str(exc)[:240], "fetched_count": 0})
                continue

    filtered = [
        offer
        for offer in offers
        if matches_requested_locations(
            offer.get("ubicacion"),
            locations,
            description=offer.get("descripcion"),
        )
    ]
    return {"offers": filtered, "sources": source_logs}
