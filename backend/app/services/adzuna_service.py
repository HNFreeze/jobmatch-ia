# -*- coding: utf-8 -*-
import json
import os
import tempfile
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlencode

import httpx
from app.services.job_index_service import normalize_offer_record

LOG_FILE = os.path.join(tempfile.gettempdir(), "adzuna_debug.log")


def log_debug(msg: str):
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"{msg}\n")
    print(msg)


def _extract_skills(text: str, user_stack: list[str]) -> list[str]:
    text_lower = (text or "").lower()
    return [s for s in user_stack if s.lower() in text_lower]


def _get_recent_db_offers(db, stack: list[str]) -> list[dict]:
    from app.models.job_offer import JobOffer

    cutoff = datetime.utcnow() - timedelta(hours=24)
    rows = db.query(JobOffer).filter(JobOffer.created_at >= cutoff).all()

    stack_lower = {s.lower() for s in stack}
    relevant = []
    for row in rows:
        skills = json.loads(row.skills_detectadas) if row.skills_detectadas else []
        if any(s.lower() in stack_lower for s in skills):
            relevant.append({
                "adzuna_id": row.adzuna_id,
                "id": None,
                "titulo": row.titulo or "",
                "empresa": row.empresa or "",
                "ubicacion": row.ubicacion or "",
                "descripcion": row.descripcion or "",
                "salario": row.salario or "Salario no especificado",
                "fecha_publicacion": row.fecha_publicacion or "",
                "redirect_url": row.url or "",
            })
    log_debug(f"[JOB_CACHE] {len(relevant)} ofertas relevantes en BD (de {len(rows)} recientes)")
    return relevant


def _save_offers_to_db(db, offers: list[dict], stack: list[str]):
    from app.models.job_offer import JobOffer

    adzuna_ids = [o.get("adzuna_id", "") for o in offers if o.get("adzuna_id")]
    existing_rows = {}
    if adzuna_ids:
        existing_rows = {
            row.adzuna_id: row
            for row in db.query(JobOffer).filter(JobOffer.adzuna_id.in_(adzuna_ids)).all()
        }

    touched = 0
    for offer in offers:
        adzuna_id = offer.get("adzuna_id", "")
        if not adzuna_id:
            continue

        text = f"{offer.get('descripcion', '')} {offer.get('titulo', '')}"
        skills = _extract_skills(text, stack)
        row = existing_rows.get(adzuna_id)

        try:
            if row:
                row.titulo = offer.get("titulo", "")
                row.empresa = offer.get("empresa", "")
                row.ubicacion = offer.get("ubicacion", "")
                row.descripcion = offer.get("descripcion", "")
                row.salario = offer.get("salario", "")
                row.fecha_publicacion = offer.get("fecha_publicacion", "")
                row.url = offer.get("redirect_url", "")
                row.skills_detectadas = json.dumps(skills, ensure_ascii=False)
                row.created_at = datetime.utcnow()
            else:
                db.add(JobOffer(
                    adzuna_id=adzuna_id,
                    titulo=offer.get("titulo", ""),
                    empresa=offer.get("empresa", ""),
                    ubicacion=offer.get("ubicacion", ""),
                    descripcion=offer.get("descripcion", ""),
                    salario=offer.get("salario", ""),
                    fecha_publicacion=offer.get("fecha_publicacion", ""),
                    url=offer.get("redirect_url", ""),
                    skills_detectadas=json.dumps(skills, ensure_ascii=False),
                ))
            touched += 1
        except Exception as e:
            log_debug(f"[JOB_CACHE] Error guardando oferta {adzuna_id}: {e}")

    if touched:
        try:
            db.commit()
            log_debug(f"[JOB_CACHE] {touched} ofertas insertadas/actualizadas en BD")
        except Exception as e:
            db.rollback()
            log_debug(f"[JOB_CACHE] Error al hacer commit: {e}")


async def _query_adzuna(
    client: httpx.AsyncClient,
    app_id: str,
    app_key: str,
    query: str,
    location: Optional[str] = None,
    page: int = 1,
) -> Optional[list]:
    url = f"https://api.adzuna.com/v1/api/jobs/es/search/{page}"
    params = {
        "app_id": app_id,
        "app_key": app_key,
        "results_per_page": 20,
        "what": query,
        "sort_by": "date",
        "max_days_old": 30,
    }
    if location:
        params["where"] = location

    log_debug(f"[ADZUNA] query='{query}' location='{location or 'toda Espana'}' -> {url}?{urlencode(params)}")
    try:
        response = await client.get(url, params=params, headers={"Content-Type": "application/json"})
        response.raise_for_status()
        data = response.json()
        count = len(data.get("results", []))
        log_debug(f"[ADZUNA] {count} resultados para '{query}' en '{location or 'toda Espana'}'")
        return _map_adzuna_to_internal_format(data.get("results", []))
    except httpx.HTTPStatusError as e:
        log_debug(f"[ADZUNA] ERROR HTTP {e.response.status_code} para '{query}': {e.response.text[:200]}")
        return None
    except httpx.TimeoutException:
        log_debug(f"[ADZUNA] ERROR timeout para '{query}'")
        return None
    except Exception as e:
        log_debug(f"[ADZUNA] ERROR inesperado para '{query}': {e}")
        return None


async def fetch_offers_from_adzuna(
    skills: list[str],
    locations: Optional[list[str]] = None,
    db=None,
    fallback_query: Optional[str] = "developer",
) -> Optional[list]:
    log_debug(f"[ADZUNA] skills={skills} locations={locations}")

    db_offers: list[dict] = []
    if db:
        db_offers = _get_recent_db_offers(db, skills)
        if len(db_offers) >= 10:
            log_debug(f"[JOB_CACHE] HIT con {len(db_offers)} ofertas, saltando Adzuna")
            for i, offer in enumerate(db_offers, 1):
                offer["id"] = i
            return db_offers
        log_debug(f"[JOB_CACHE] MISS con {len(db_offers)} ofertas, llamando a Adzuna")

    app_id = os.getenv("ADZUNA_APP_ID")
    app_key = os.getenv("ADZUNA_APP_KEY")
    if not app_id or not app_key:
        log_debug("[ADZUNA] ERROR: credenciales no configuradas")
        return None

    if not locations:
        effective_locations: list[Optional[str]] = ["Madrid"]
    elif "Toda España" in locations:
        effective_locations = [None]
    else:
        effective_locations = locations  # type: ignore[assignment]

    queries: list[str] = []
    if skills:
        queries.append(" ".join(skills))
        if len(skills) > 1:
            queries.append(skills[0])
    if fallback_query:
        queries.append(fallback_query)

    seen: set[str] = set()
    adzuna_offers: list[dict] = []

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            for location in effective_locations:
                location_label = location or "toda Espana"
                for query in queries:
                    offers = await _query_adzuna(client, app_id, app_key, query, location, page=1)
                    if not offers:
                        log_debug(f"[ADZUNA] sin resultados para '{query}' en '{location_label}', probando fallback")
                        continue

                    new_count = 0
                    for offer in offers:
                        key = offer.get("adzuna_id") or offer.get("redirect_url") or f"{offer.get('titulo', '')}|{offer.get('empresa', '')}"
                        if key in seen:
                            continue
                        seen.add(key)
                        adzuna_offers.append(offer)
                        new_count += 1
                    log_debug(f"[ADZUNA] +{new_count} ofertas nuevas para '{location_label}' con '{query}'")
                    break
    except Exception as e:
        log_debug(f"[ADZUNA] ERROR global inesperado: {e}")
        return None

    if db and adzuna_offers:
        _save_offers_to_db(db, adzuna_offers, skills)

    combined_map = {}
    for offer in db_offers:
        key = offer.get("adzuna_id") or offer.get("redirect_url") or f"{offer.get('titulo', '')}|{offer.get('empresa', '')}"
        combined_map[key] = offer
    for offer in adzuna_offers:
        key = offer.get("adzuna_id") or offer.get("redirect_url") or f"{offer.get('titulo', '')}|{offer.get('empresa', '')}"
        combined_map[key] = offer

    combined = list(combined_map.values())
    if not combined:
        log_debug("[ADZUNA] sin resultados finales")
        return None

    for i, offer in enumerate(combined, 1):
        offer["id"] = i

    log_debug(f"[ADZUNA] TOTAL combinado: {len(combined)} ofertas ({len(db_offers)} BD + {len(adzuna_offers)} Adzuna)")
    return combined


async def fetch_adzuna_page(
    skills: list[str],
    locations: Optional[list[str]] = None,
    page: int = 2,
) -> Optional[list]:
    """Obtiene una página específica de Adzuna para 'cargar más' (sin caché DB)."""
    app_id = os.getenv("ADZUNA_APP_ID")
    app_key = os.getenv("ADZUNA_APP_KEY")
    if not app_id or not app_key:
        return None

    if not locations:
        effective_locations: list[Optional[str]] = ["Madrid"]
    elif "Toda España" in locations or "Toda Espana" in locations:
        effective_locations = [None]
    else:
        effective_locations = locations  # type: ignore[assignment]

    queries: list[str] = []
    if skills:
        queries.append(" ".join(skills[:4]))
        if len(skills) > 1:
            queries.append(skills[0])
    queries.append("developer")

    seen: set[str] = set()
    offers: list[dict] = []

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            for location in effective_locations[:2]:
                for query in queries[:2]:
                    result = await _query_adzuna(client, app_id, app_key, query, location, page=page)
                    if not result:
                        continue
                    for offer in result:
                        key = (
                            offer.get("adzuna_id")
                            or offer.get("redirect_url")
                            or f"{offer.get('titulo', '')}|{offer.get('empresa', '')}"
                        )
                        if key in seen:
                            continue
                        seen.add(key)
                        offers.append(offer)
                    if offers:
                        break
                if offers:
                    break
    except Exception as exc:
        log_debug(f"[ADZUNA] fetch_adzuna_page error (page={page}): {exc}")
        return None

    log_debug(f"[ADZUNA] fetch_adzuna_page page={page} -> {len(offers)} ofertas")
    return offers or None


def _map_adzuna_to_internal_format(adzuna_results: list) -> list:
    mapped = []
    for idx, job in enumerate(adzuna_results, 1):
        salario = None
        if job.get("salary_min") and job.get("salary_max"):
            salary_min = int(job["salary_min"])
            salary_max = int(job["salary_max"])
            salario = f"{salary_min:,} - {salary_max:,}/ano"
        elif job.get("salary_min"):
            salario = f"{int(job['salary_min']):,}/ano"
        elif job.get("salary_max"):
            salario = f"Hasta {int(job['salary_max']):,}/ano"

        description = (
            job.get("description", "")
            .replace("<br>", " ")
            .replace("</p>", " ")
            .replace("<p>", "")
            .strip()
        )

        mapped_offer = normalize_offer_record(
            "adzuna",
            "aggregator",
            {
                "id": job.get("id"),
                "titulo": job.get("title", "Sin titulo"),
                "empresa": job.get("company", {}).get("display_name", "Empresa desconocida") if isinstance(job.get("company"), dict) else job.get("company", "Empresa desconocida"),
                "ubicacion": job.get("location", {}).get("display_name", "Ubicacion desconocida") if isinstance(job.get("location"), dict) else job.get("location", "Ubicacion desconocida"),
                "descripcion": description,
                "salario": salario or "Salario no especificado",
                "fecha_publicacion": job.get("created", ""),
                "redirect_url": job.get("redirect_url", ""),
                "source_metadata": {
                    "category": (job.get("category") or {}).get("label") if isinstance(job.get("category"), dict) else job.get("category"),
                    "contract_time": (job.get("contract_time") or {}).get("label") if isinstance(job.get("contract_time"), dict) else job.get("contract_time"),
                    "salary_min": job.get("salary_min"),
                    "salary_max": job.get("salary_max"),
                },
            },
            company_fallback="Empresa desconocida",
            source_job_id=str(job.get("id", "")),
            canonical_url=job.get("redirect_url", ""),
        )
        mapped_offer["id"] = idx
        mapped.append(mapped_offer)

    return mapped
