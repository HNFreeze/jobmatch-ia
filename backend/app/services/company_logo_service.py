# -*- coding: utf-8 -*-
import re
import unicodedata
from datetime import datetime
from typing import Iterable
from urllib.parse import urlparse

import httpx

from app.models.company_logo import CompanyLogo

IGNORED_DOMAINS = {
    "adzuna.es",
    "adzuna.com",
    "linkedin.com",
    "www.linkedin.com",
    "indeed.com",
    "www.indeed.com",
    "es.indeed.com",
    "glassdoor.com",
    "www.glassdoor.com",
    "infojobs.net",
    "www.infojobs.net",
    "jooble.org",
    "www.jooble.org",
    "jobrapido.com",
    "www.jobrapido.com",
    "talent.com",
    "www.talent.com",
    "bebee.com",
    "www.bebee.com",
    "monster.com",
    "www.monster.com",
}


def normalize_company_name(name: str | None) -> str:
    if not name:
        return ""
    normalized = unicodedata.normalize("NFD", name)
    without_marks = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    cleaned = re.sub(r"[^a-zA-Z0-9]+", " ", without_marks.lower())
    return re.sub(r"\s+", " ", cleaned).strip()


def build_logo_candidates(domain: str) -> list[tuple[str, str]]:
    return [
        (f"https://{domain}/favicon.ico", "site_favicon"),
        (f"https://{domain}/apple-touch-icon.png", "apple_touch_icon"),
    ]


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


def _resolve_logo_record(name: str, urls: Iterable[str], client: httpx.Client) -> CompanyLogo:
    record = CompanyLogo(
        company_name_original=name[:300],
        company_name_normalized=normalize_company_name(name),
        last_attempt_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    domain = None
    for url in urls:
        domain = _extract_company_domain(url)
        if domain:
            break

    if not domain:
        record.status = "not_found"
        record.source = "offer_url_unavailable"
        return record

    record.resolved_domain = domain
    last_error = None

    for candidate_url, source in build_logo_candidates(domain):
        try:
            response = client.get(candidate_url)
            content_type = (response.headers.get("content-type") or "").lower()
            if response.status_code == 200 and content_type.startswith("image/"):
                record.status = "found"
                record.logo_url = candidate_url
                record.source = source
                return record
        except Exception as exc:
            last_error = exc

    record.source = "site_favicon"
    record.status = "failed" if last_error else "not_found"

    return record


def _apply_logo(record: CompanyLogo | None, item: dict) -> dict:
    item["company_logo_url"] = record.logo_url if record and record.status == "found" else None
    item["company_logo_status"] = record.status if record else "not_found"
    item["company_logo_domain"] = record.resolved_domain if record else None
    return item


def enrich_items_with_company_logos(db, items: list[dict]) -> list[dict]:
    if not db or not items:
        return items

    grouped: dict[str, dict] = {}
    for item in items:
        company_name = (item.get("empresa") or "").strip()
        normalized_name = normalize_company_name(company_name)
        if not normalized_name:
            item["company_logo_url"] = None
            item["company_logo_status"] = "not_found"
            item["company_logo_domain"] = None
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

    existing_rows = db.query(CompanyLogo).filter(
        CompanyLogo.company_name_normalized.in_(normalized_names)
    ).all()
    rows_by_name = {row.company_name_normalized: row for row in existing_rows}

    missing_names = [name for name in normalized_names if name not in rows_by_name]
    retry_names = [
        name
        for name, row in rows_by_name.items()
        if row.status == "not_found" and not row.resolved_domain and grouped[name]["urls"]
    ]

    if missing_names or retry_names:
        new_rows: list[CompanyLogo] = []
        with httpx.Client(timeout=3.0, follow_redirects=True) as client:
            for normalized_name in missing_names:
                payload = grouped[normalized_name]
                new_rows.append(_resolve_logo_record(payload["name"], payload["urls"], client))
            for normalized_name in retry_names:
                payload = grouped[normalized_name]
                resolved = _resolve_logo_record(payload["name"], payload["urls"], client)
                row = rows_by_name[normalized_name]
                row.company_name_original = resolved.company_name_original
                row.resolved_domain = resolved.resolved_domain
                row.logo_url = resolved.logo_url
                row.status = resolved.status
                row.source = resolved.source
                row.last_attempt_at = datetime.utcnow()
                row.updated_at = datetime.utcnow()

        if new_rows or retry_names:
            try:
                if new_rows:
                    db.add_all(new_rows)
                db.commit()
            except Exception:
                db.rollback()

            refreshed_rows = db.query(CompanyLogo).filter(
                CompanyLogo.company_name_normalized.in_(normalized_names)
            ).all()
            rows_by_name = {row.company_name_normalized: row for row in refreshed_rows}

    for normalized_name, payload in grouped.items():
        row = rows_by_name.get(normalized_name)
        for item in payload["items"]:
            _apply_logo(row, item)

    return items
