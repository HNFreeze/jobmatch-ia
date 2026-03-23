# -*- coding: utf-8 -*-
import re
import unicodedata
from datetime import datetime, timedelta
from typing import Iterable
from urllib.parse import quote_plus, urlparse

import httpx
from sqlalchemy.orm import Session

from app.models.company_logo import CompanyData

IGNORED_DOMAINS = {
    "adzuna.es", "adzuna.com", "linkedin.com", "www.linkedin.com",
    "indeed.com", "www.indeed.com", "es.indeed.com", "glassdoor.com",
    "www.glassdoor.com", "infojobs.net", "www.infojobs.net",
    "jooble.org", "www.jooble.org", "jobrapido.com", "www.jobrapido.com",
    "talent.com", "www.talent.com", "bebee.com", "www.bebee.com",
    "monster.com", "www.monster.com",
}

LEGAL_TOKENS = {
    "sa", "sl", "slu", "slne", "srl", "sro", "llc", "ltd", "limited",
    "inc", "corp", "corporation", "gmbh", "plc", "oy", "ab", "bv",
    "sas", "spa", "co", "company",
}

GENERIC_TOKENS = {
    "group", "grupo", "holding", "holdings", "solutions", "solution",
    "services", "service", "systems", "software", "digital", "global",
    "international", "partners", "consulting", "consultoria",
    "consultores", "recruitment", "analytics", "technology",
    "technologies", "tech", "job", "jobs",
}

COMMON_TLDS = ("com", "es", "io", "ai", "tech", "dev", "co", "net", "org")
REFRESH_FOUND_AFTER = timedelta(days=30)
REFRESH_MISS_AFTER = timedelta(days=7)
REVIEW_REFRESH_AFTER = timedelta(days=30)


def normalize_company_name(name: str | None) -> str:
    if not name:
        return ""
    normalized = unicodedata.normalize("NFD", name)
    without_marks = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    cleaned = re.sub(r"[^a-zA-Z0-9]+", " ", without_marks.lower())
    return re.sub(r"\s+", " ", cleaned).strip()


def _is_ignored_domain(domain: str) -> bool:
    if domain in IGNORED_DOMAINS:
        return True
    return any(domain.endswith(f".{blocked}") for blocked in IGNORED_DOMAINS)


def _extract_company_domain(url: str | None) -> str | None:
    if not url:
        return None
    try:
        parsed = urlparse(url)
    except Exception:
        return None
    host = (parsed.hostname or "").lower().strip()
    if not host:
        return None
    if host.startswith("www."):
        host = host[4:]
    if _is_ignored_domain(host):
        return None
    if re.fullmatch(r"\d+\.\d+\.\d+\.\d+", host):
        return None
    return host


def _meaningful_tokens(name: str) -> list[str]:
    tokens = [token for token in normalize_company_name(name).split() if token and token not in LEGAL_TOKENS]
    if not tokens:
        return []
    meaningful = [token for token in tokens if token not in GENERIC_TOKENS]
    return meaningful or tokens


def _guess_domains(name: str) -> list[str]:
    tokens = _meaningful_tokens(name)
    if not tokens:
        return []

    slugs: list[str] = []

    def add_slug(value: str) -> None:
        value = re.sub(r"[^a-z0-9-]", "", value.lower()).strip("-")
        if value and value not in slugs:
            slugs.append(value)

    add_slug("".join(tokens))
    add_slug("-".join(tokens))
    add_slug(tokens[0])
    if len(tokens) >= 2:
        add_slug("".join(tokens[:2]))
        add_slug("-".join(tokens[:2]))
    if len(tokens) >= 3:
        add_slug("".join(tokens[:3]))

    domains: list[str] = []
    for slug in slugs[:6]:
        for tld in COMMON_TLDS:
            candidate = f"{slug}.{tld}"
            if candidate not in domains:
                domains.append(candidate)
    return domains[:18]


def _domain_seems_live(domain: str, client: httpx.Client, checked: dict[str, bool]) -> bool:
    if domain in checked:
        return checked[domain]

    headers = {"User-Agent": "JobMatchIA/1.0 (+logo-fetch)"}
    result = False
    for base_url in (f"https://{domain}", f"http://{domain}"):
        try:
            response = client.get(base_url, headers=headers)
            if response.status_code < 500 or response.status_code in {401, 403, 405}:
                result = True
                break
        except Exception:
            continue

    checked[domain] = result
    return result


def _build_logo_candidates(domain: str, allow_google: bool) -> list[tuple[str, str]]:
    candidates: list[tuple[str, str]] = []
    if allow_google:
        candidates.append((f"https://www.google.com/s2/favicons?sz=128&domain_url={domain}", "google_s2"))
    candidates.extend([
        (f"https://{domain}/favicon.ico", "site_favicon"),
        (f"https://{domain}/apple-touch-icon.png", "apple_touch_icon"),
        (f"https://logo.clearbit.com/{domain}", "clearbit"),
    ])
    return candidates


def _logo_response_is_valid(response: httpx.Response) -> bool:
    content_type = (response.headers.get("content-type") or "").lower()
    if response.status_code != 200:
        return False
    if not content_type.startswith("image/"):
        return False
    if "xml" in content_type:
        return False
    return True


def _build_google_site_search(site: str, query: str) -> str:
    return f"https://www.google.com/search?q={quote_plus(f'site:{site} {query}')}"


def _build_review_links(name: str, resolved_domain: str | None) -> dict[str, str | None]:
    query = name.strip()
    trustpilot_url = None
    if resolved_domain:
        trustpilot_url = f"https://www.trustpilot.com/review/{resolved_domain}"
    else:
        trustpilot_url = _build_google_site_search("www.trustpilot.com/review", query)

    return {
        "glassdoor_url": _build_google_site_search("www.glassdoor.com", f'"{query}" reviews'),
        "kununu_url": _build_google_site_search("www.kununu.com", f'"{query}"'),
        "trustpilot_url": trustpilot_url,
        "review_status": "linked",
    }


def _review_links_changed(row: CompanyData | None, review_links: dict[str, str | None]) -> bool:
    if row is None:
        return True
    return any([
        row.glassdoor_url != review_links["glassdoor_url"],
        row.kununu_url != review_links["kununu_url"],
        row.trustpilot_url != review_links["trustpilot_url"],
        row.review_status != review_links["review_status"],
    ])


def _should_refresh_reviews(row: CompanyData | None) -> bool:
    if row is None:
        return True
    if not row.review_checked_at:
        return True
    return (datetime.utcnow() - row.review_checked_at) >= REVIEW_REFRESH_AFTER


def _serialize_review_sources(record: CompanyData | None) -> list[dict]:
    if not record:
        return []

    sources = []
    mapping = [
        ("glassdoor", "Glassdoor", record.glassdoor_url),
        ("kununu", "Kununu", record.kununu_url),
        ("trustpilot", "Trustpilot", record.trustpilot_url),
    ]
    for key, label, url in mapping:
        if url:
            sources.append({
                "key": key,
                "label": label,
                "url": url,
            })
    return sources


def _should_refresh(row: CompanyData | None) -> bool:
    if row is None:
        return True
    if not row.last_attempt_at:
        return True

    age = datetime.utcnow() - row.last_attempt_at
    if row.status == "found":
        return age >= REFRESH_FOUND_AFTER
    return age >= REFRESH_MISS_AFTER


def _merge_company_resolution(row: CompanyData, resolved: CompanyData) -> None:
    row.company_name_original = resolved.company_name_original
    if resolved.resolved_domain:
        row.resolved_domain = resolved.resolved_domain

    if resolved.status == "found":
        row.logo_url = resolved.logo_url
        row.status = resolved.status
        row.source = resolved.source
    elif row.status != "found":
        row.logo_url = resolved.logo_url
        row.status = resolved.status
        row.source = resolved.source

    row.last_attempt_at = datetime.utcnow()
    row.updated_at = datetime.utcnow()


def _apply_review_links(row: CompanyData, company_name: str) -> None:
    review_links = _build_review_links(company_name, row.resolved_domain)
    row.glassdoor_url = review_links["glassdoor_url"]
    row.kununu_url = review_links["kununu_url"]
    row.trustpilot_url = review_links["trustpilot_url"]
    row.review_status = review_links["review_status"] or "unavailable"
    row.review_checked_at = datetime.utcnow()
    row.updated_at = datetime.utcnow()


def _resolve_company_record(name: str, urls: Iterable[str], client: httpx.Client) -> CompanyData:
    record = CompanyData(
        company_name_original=name[:300],
        company_name_normalized=normalize_company_name(name),
        last_attempt_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    checked_domains: dict[str, bool] = {}
    extracted_domain = None
    for url in urls:
        extracted_domain = _extract_company_domain(url)
        if extracted_domain:
            break

    domains_to_try: list[tuple[str, bool]] = []
    if extracted_domain:
        domains_to_try.append((extracted_domain, True))
    for guessed_domain in _guess_domains(name):
        if guessed_domain != extracted_domain:
            domains_to_try.append((guessed_domain, False))

    best_candidate_url = None
    best_source = None
    resolved_domain = None
    last_error = None

    for domain, trusted_domain in domains_to_try:
        if not trusted_domain and not _domain_seems_live(domain, client, checked_domains):
            continue

        for candidate_url, source in _build_logo_candidates(domain, allow_google=trusted_domain):
            try:
                response = client.get(candidate_url, headers={"User-Agent": "JobMatchIA/1.0 (+logo-fetch)"})
                if _logo_response_is_valid(response):
                    best_candidate_url = candidate_url
                    best_source = source
                    resolved_domain = domain
                    break
            except Exception as exc:
                last_error = exc
        if best_candidate_url:
            break

        if trusted_domain or _domain_seems_live(domain, client, checked_domains):
            best_candidate_url = f"https://www.google.com/s2/favicons?sz=128&domain_url={domain}"
            best_source = "google_s2"
            resolved_domain = domain
            break

    record.resolved_domain = resolved_domain or extracted_domain

    if best_candidate_url:
        record.status = "found"
        record.logo_url = best_candidate_url
        record.source = best_source
    else:
        record.source = "site_favicon"
        record.status = "failed" if last_error else "not_found"

    review_links = _build_review_links(name, record.resolved_domain)
    record.glassdoor_url = review_links["glassdoor_url"]
    record.kununu_url = review_links["kununu_url"]
    record.trustpilot_url = review_links["trustpilot_url"]
    record.review_status = review_links["review_status"] or "unavailable"
    record.review_checked_at = datetime.utcnow()

    return record


def _serialize_company_data(record: CompanyData | None) -> dict | None:
    if not record:
        return None

    return {
        "name": record.company_name_original,
        "logo_url": record.logo_url if record.status == "found" else None,
        "logo_status": record.status,
        "logo_domain": record.resolved_domain,
        "review_status": record.review_status or "unavailable",
        "review_sources": _serialize_review_sources(record),
    }


def get_or_create_company_data(db: Session, company_name: str, offer_url: str = None) -> dict | None:
    if not company_name:
        return None

    norm_name = normalize_company_name(company_name)
    if not norm_name:
        return None

    row = db.query(CompanyData).filter(CompanyData.company_name_normalized == norm_name).first()
    resolved = None
    if _should_refresh(row):
        urls = [offer_url] if offer_url else []
        with httpx.Client(timeout=3.0, follow_redirects=True) as client:
            resolved = _resolve_company_record(company_name, urls, client)

        if row:
            _merge_company_resolution(row, resolved)
            _apply_review_links(row, company_name)
        else:
            db.add(resolved)
            row = resolved

        try:
            db.commit()
            db.refresh(row)
        except Exception:
            db.rollback()
            return _serialize_company_data(resolved or row)
    elif _should_refresh_reviews(row):
        _apply_review_links(row, company_name)
        try:
            db.commit()
            db.refresh(row)
        except Exception:
            db.rollback()

    return _serialize_company_data(row)


def _apply_company_data(record: CompanyData | None, item: dict) -> dict:
    item["company_logo_url"] = record.logo_url if record and record.status == "found" else None
    item["company_logo_status"] = record.status if record else "not_found"
    item["company_logo_domain"] = record.resolved_domain if record else None
    item["company_review_status"] = record.review_status if record else "unavailable"
    item["company_review_sources"] = _serialize_review_sources(record)
    return item


def enrich_items_with_company_data(db: Session, items: list[dict]) -> list[dict]:
    if not db or not items:
        return items

    grouped: dict[str, dict] = {}
    for item in items:
        company_name = (item.get("empresa") or "").strip()
        normalized_name = normalize_company_name(company_name)
        if not normalized_name:
            _apply_company_data(None, item)
            continue

        entry = grouped.setdefault(
            normalized_name,
            {"name": company_name, "urls": [], "items": []},
        )
        entry["items"].append(item)
        for key in ("redirect_url", "url"):
            value = item.get(key)
            if value and value not in entry["urls"]:
                entry["urls"].append(value)

    if not grouped:
        return items

    normalized_names = list(grouped.keys())
    existing_rows = db.query(CompanyData).filter(
        CompanyData.company_name_normalized.in_(normalized_names)
    ).all()
    rows_by_name = {row.company_name_normalized: row for row in existing_rows}

    refresh_names = [
        name for name in normalized_names
        if _should_refresh(rows_by_name.get(name))
    ]
    review_refresh_names = [
        name for name in normalized_names
        if name not in refresh_names and _should_refresh_reviews(rows_by_name.get(name))
    ]

    transient_rows: dict[str, CompanyData] = {}
    new_rows: list[CompanyData] = []
    with httpx.Client(timeout=3.0, follow_redirects=True) as client:
        for normalized_name in refresh_names:
            payload = grouped[normalized_name]
            resolved = _resolve_company_record(payload["name"], payload["urls"], client)
            transient_rows[normalized_name] = resolved

            if normalized_name in rows_by_name:
                row = rows_by_name[normalized_name]
                _merge_company_resolution(row, resolved)
                _apply_review_links(row, payload["name"])
            else:
                new_rows.append(resolved)

    for normalized_name in review_refresh_names:
        row = rows_by_name.get(normalized_name)
        if row:
            _apply_review_links(row, grouped[normalized_name]["name"])

    if new_rows or refresh_names or review_refresh_names:
        try:
            if new_rows:
                db.add_all(new_rows)
            db.commit()
        except Exception:
            db.rollback()
            rows_by_name.update(transient_rows)

        refreshed_rows = db.query(CompanyData).filter(
            CompanyData.company_name_normalized.in_(normalized_names)
        ).all()
        rows_by_name = {row.company_name_normalized: row for row in refreshed_rows}
        rows_by_name.update({
            normalized_name: row
            for normalized_name, row in transient_rows.items()
            if normalized_name not in rows_by_name
        })

    for normalized_name, payload in grouped.items():
        row = rows_by_name.get(normalized_name)
        for item in payload["items"]:
            _apply_company_data(row, item)

    return items
