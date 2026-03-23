# -*- coding: utf-8 -*-
import re
import unicodedata
from datetime import datetime
from typing import Iterable
from urllib.parse import urlparse

import httpx
from sqlalchemy.orm import Session

from app.models.company_logo import CompanyData  # uses the alias

IGNORED_DOMAINS = {
    "adzuna.es", "adzuna.com", "linkedin.com", "www.linkedin.com",
    "indeed.com", "www.indeed.com", "es.indeed.com", "glassdoor.com",
    "www.glassdoor.com", "infojobs.net", "www.infojobs.net",
    "jooble.org", "www.jooble.org", "jobrapido.com", "www.jobrapido.com",
    "talent.com", "www.talent.com", "bebee.com", "www.bebee.com",
    "monster.com", "www.monster.com",
}

def normalize_company_name(name: str | None) -> str:
    if not name: return ""
    normalized = unicodedata.normalize("NFD", name)
    without_marks = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    cleaned = re.sub(r"[^a-zA-Z0-9]+", " ", without_marks.lower())
    return re.sub(r"\s+", " ", cleaned).strip()

def build_logo_candidates(domain: str) -> list[tuple[str, str]]:
    return [
        (f"https://www.google.com/s2/favicons?sz=128&domain_url={domain}", "google_s2"),
        (f"https://{domain}/favicon.ico", "site_favicon"),
        (f"https://{domain}/apple-touch-icon.png", "apple_touch_icon"),
        (f"https://logo.clearbit.com/{domain}", "clearbit"),
    ]

def _is_ignored_domain(domain: str) -> bool:
    if domain in IGNORED_DOMAINS: return True
    return any(domain.endswith(f".{blocked}") for blocked in IGNORED_DOMAINS)

def _extract_company_domain(url: str | None) -> str | None:
    if not url: return None
    try: parsed = urlparse(url)
    except Exception: return None
    host = (parsed.hostname or "").lower().strip()
    if not host: return None
    if host.startswith("www."): host = host[4:]
    if _is_ignored_domain(host): return None
    if re.fullmatch(r"\d+\.\d+\.\d+\.\d+", host): return None
    return host

def _guess_domains(name: str) -> list[str]:
    cleaned = re.sub(r"[^a-zA-Z0-9]", "", name).lower()
    if not cleaned:
        return []
    return [f"{cleaned}.com", f"{cleaned}.es", f"{cleaned}.net", f"{cleaned}.org"]

def _resolve_company_record(name: str, urls: Iterable[str], client: httpx.Client) -> CompanyData:
    record = CompanyData(
        company_name_original=name[:300],
        company_name_normalized=normalize_company_name(name),
        last_attempt_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    domain = None
    for url in urls:
        domain = _extract_company_domain(url)
        if domain: break
    extracted_domain = domain

    guessed_domains = [domain] if domain else _guess_domains(name)
    best_candidate_url = None
    best_source = None
    last_error = None
    
    for d in guessed_domains:
        if best_candidate_url: break
        for candidate_url, source in build_logo_candidates(d):
            try:
                response = client.get(candidate_url)
                content_type = (response.headers.get("content-type") or "").lower()
                if response.status_code == 200 and content_type.startswith("image/") and "xml" not in content_type:
                    best_candidate_url = candidate_url
                    best_source = source
                    domain = d # Encontramos el dominio bueno
                    break
            except Exception as exc:
                last_error = exc

    record.resolved_domain = domain

    # Logo Logic
    if best_candidate_url:
        record.status = "found"
        record.logo_url = best_candidate_url
        record.source = best_source
    elif extracted_domain:
        # Pragmatic fallback: Google S2 favicon usually returns a usable brand icon
        # for a known company domain without requiring us to scrape the site.
        record.status = "found"
        record.logo_url = f"https://www.google.com/s2/favicons?sz=128&domain_url={extracted_domain}"
        record.source = "google_s2"
        record.resolved_domain = extracted_domain
    else:
        record.source = "site_favicon"
        record.status = "failed" if last_error else "not_found"

    return record

def get_or_create_company_data(db: Session, company_name: str, offer_url: str = None) -> dict | None:
    if not company_name: return None
    norm_name = normalize_company_name(company_name)
    if not norm_name: return None
    
    row = db.query(CompanyData).filter(CompanyData.company_name_normalized == norm_name).first()
    resolved = None
    if not row or (row.status == "not_found" and not row.resolved_domain):
        urls = [offer_url] if offer_url else []
        with httpx.Client(timeout=3.0, follow_redirects=True) as client:
            resolved = _resolve_company_record(company_name, urls, client)
            
        if row:
            row.company_name_original = resolved.company_name_original
            if resolved.resolved_domain: row.resolved_domain = resolved.resolved_domain
            row.logo_url = resolved.logo_url
            row.status = resolved.status
            row.source = resolved.source
            row.last_attempt_at = datetime.utcnow()
            row.updated_at = datetime.utcnow()
        else:
            db.add(resolved)
            row = resolved
        
        try:
            db.commit()
            db.refresh(row)
        except Exception:
            db.rollback()
            fallback = resolved or row
            return {
                "name": fallback.company_name_original,
                "logo_url": fallback.logo_url if fallback.status == "found" else None,
                "logo_status": fallback.status,
                "logo_domain": fallback.resolved_domain,
            }
            
    return {
        "name": row.company_name_original,
        "logo_url": row.logo_url if row.status == "found" else None,
        "logo_status": row.status,
        "logo_domain": row.resolved_domain,
    }

def _apply_company_data(record: CompanyData | None, item: dict) -> dict:
    item["company_logo_url"] = record.logo_url if record and record.status == "found" else None
    item["company_logo_status"] = record.status if record else "not_found"
    item["company_logo_domain"] = record.resolved_domain if record else None
    return item

def enrich_items_with_company_data(db: Session, items: list[dict]) -> list[dict]:
    if not db or not items: return items

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

    if not grouped: return items

    normalized_names = list(grouped.keys())
    existing_rows = db.query(CompanyData).filter(
        CompanyData.company_name_normalized.in_(normalized_names)
    ).all()
    rows_by_name = {row.company_name_normalized: row for row in existing_rows}

    missing_names = [name for name in normalized_names if name not in rows_by_name]
    retry_names = [
        name for name, row in rows_by_name.items()
        if row.status == "not_found" and not row.resolved_domain
    ]

    transient_rows: dict[str, CompanyData] = {}
    if missing_names or retry_names:
        new_rows: list[CompanyData] = []
        with httpx.Client(timeout=3.0, follow_redirects=True) as client:
            for normalized_name in missing_names:
                payload = grouped[normalized_name]
                resolved = _resolve_company_record(payload["name"], payload["urls"], client)
                transient_rows[normalized_name] = resolved
                new_rows.append(resolved)
            for normalized_name in retry_names:
                payload = grouped[normalized_name]
                resolved = _resolve_company_record(payload["name"], payload["urls"], client)
                transient_rows[normalized_name] = resolved
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
                if new_rows: db.add_all(new_rows)
                db.commit()
            except Exception:
                db.rollback()
                for normalized_name, resolved in transient_rows.items():
                    rows_by_name[normalized_name] = resolved

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
