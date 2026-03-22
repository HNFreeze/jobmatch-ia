# -*- coding: utf-8 -*-
import os
import json
import httpx
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlencode

import tempfile
LOG_FILE = os.path.join(tempfile.gettempdir(), "adzuna_debug.log")

def log_debug(msg: str):
    """Escribe logs a archivo y console"""
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"{msg}\n")
    print(msg)


# ── Helpers para caché de ofertas en BD ──────────────────────────────────────

def _extract_skills(text: str, user_stack: list[str]) -> list[str]:
    """Detecta qué skills del usuario aparecen en el texto de la oferta."""
    text_lower = text.lower()
    return [s for s in user_stack if s.lower() in text_lower]


def _get_recent_db_offers(db, stack: list[str]) -> list[dict]:
    """
    Devuelve ofertas de BD creadas en las últimas 24h que contienen
    al menos una skill del stack del usuario.
    """
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
                "id": None,           # se asignará al re-indexar
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


def _save_offers_to_db(db, offers: list[dict], existing_ids: set[str], stack: list[str]):
    """Guarda en BD las ofertas nuevas (no presentes por adzuna_id)."""
    from app.models.job_offer import JobOffer
    saved = 0
    for offer in offers:
        adzuna_id = offer.get("adzuna_id", "")
        if not adzuna_id or adzuna_id in existing_ids:
            continue
        text = (offer.get("descripcion", "") + " " + offer.get("titulo", ""))
        skills = _extract_skills(text, stack)
        try:
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
            saved += 1
        except Exception as e:
            log_debug(f"[JOB_CACHE] Error guardando oferta {adzuna_id}: {e}")
    if saved:
        try:
            db.commit()
            log_debug(f"[JOB_CACHE] {saved} nuevas ofertas guardadas en BD")
        except Exception as e:
            db.rollback()
            log_debug(f"[JOB_CACHE] Error al hacer commit: {e}")


# ── Llamada a Adzuna API ──────────────────────────────────────────────────────

async def _query_adzuna(
    client: httpx.AsyncClient,
    app_id: str,
    app_key: str,
    query: str,
    location: Optional[str] = None,
) -> Optional[list]:
    """Hace una única llamada a Adzuna. location=None omite el filtro geográfico."""
    url = "https://api.adzuna.com/v1/api/jobs/es/search/1"
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
    log_debug(f" Adzuna query='{query}' location='{location or 'toda España'}' — {url}?{urlencode(params)}")
    try:
        response = await client.get(url, params=params, headers={"Content-Type": "application/json"})
        response.raise_for_status()
        data = response.json()
        count = len(data.get("results", []))
        log_debug(f" {count} resultados para query='{query}' location='{location or 'toda España'}'")
        return _map_adzuna_to_internal_format(data.get("results", []))
    except httpx.HTTPStatusError as e:
        log_debug(f" ERROR HTTP {e.response.status_code} para '{query}': {e.response.text[:200]}")
        return None
    except httpx.TimeoutException:
        log_debug(f" ERROR: Timeout para '{query}'")
        return None
    except Exception as e:
        log_debug(f" ERROR para '{query}': {str(e)}")
        return None


async def fetch_offers_from_adzuna(
    skills: list[str],
    locations: Optional[list[str]] = None,
    db=None,
) -> Optional[list]:
    """
    Obtiene ofertas para España.

    Estrategia:
      1. Si db disponible: busca en job_offers ofertas de las últimas 24h con skill overlap.
         - Si hay 10+: devuelve directo sin llamar a Adzuna.
         - Si hay <10: llama a Adzuna, guarda nuevas en BD, combina ambas.
      2. Sin db: comportamiento original (solo Adzuna).

    Fallback progresivo por query:
      1. Todas las skills juntas
      2. Solo la primera skill
      3. "developer"
    """
    log_debug(f"[ADZUNA] skills={skills} locations={locations}")

    # ── Comprobar caché de BD ────────────────────────────────────────────────
    db_offers: list[dict] = []
    existing_ids: set[str] = set()
    if db:
        db_offers = _get_recent_db_offers(db, skills)
        if len(db_offers) >= 10:
            log_debug(f"[JOB_CACHE] HIT — {len(db_offers)} ofertas de BD, saltando Adzuna")
            for i, offer in enumerate(db_offers, 1):
                offer["id"] = i
            return db_offers
        existing_ids = {o["adzuna_id"] for o in db_offers if o.get("adzuna_id")}
        log_debug(f"[JOB_CACHE] MISS — {len(db_offers)} en BD, llamando a Adzuna...")

    # ── Llamada a Adzuna ─────────────────────────────────────────────────────
    app_id = os.getenv("ADZUNA_APP_ID")
    app_key = os.getenv("ADZUNA_APP_KEY")
    if not app_id or not app_key:
        log_debug(" ERROR: credenciales Adzuna no configuradas")
        return None

    # Resolver ciudades efectivas
    if not locations:
        effective_locations: list[Optional[str]] = ["Madrid"]
    elif "Toda España" in locations:
        effective_locations = [None]  # sin filtro where
    else:
        effective_locations = locations  # type: ignore[assignment]

    # Queries en orden de especificidad
    queries: list[str] = []
    if skills:
        queries.append(" ".join(skills))
        if len(skills) > 1:
            queries.append(skills[0])
    queries.append("developer")

    seen: set[str] = set(existing_ids)   # pre-popular con IDs ya en BD
    adzuna_offers: list[dict] = []

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            for loc in effective_locations:
                loc_label = loc or "toda España"
                for query in queries:
                    offers = await _query_adzuna(client, app_id, app_key, query, loc)
                    if offers:
                        new_count = 0
                        for offer in offers:
                            adzuna_id = offer.get("adzuna_id", "")
                            key = adzuna_id or offer.get("redirect_url") or f"{offer['titulo']}|{offer['empresa']}"
                            if key not in seen:
                                seen.add(key)
                                adzuna_offers.append(offer)
                                new_count += 1
                        log_debug(f" +{new_count} nuevas ofertas de '{loc_label}' con query '{query}'")
                        break  # esta ciudad tiene resultados, pasar a la siguiente
                    log_debug(f" Sin resultados para '{query}' en '{loc_label}', probando siguiente...")

    except Exception as e:
        log_debug(f" ERROR inesperado: {str(e)}")
        return None

    # ── Guardar nuevas ofertas en BD ─────────────────────────────────────────
    if db and adzuna_offers:
        _save_offers_to_db(db, adzuna_offers, existing_ids, skills)

    # ── Combinar BD + Adzuna y re-indexar ────────────────────────────────────
    combined = db_offers + adzuna_offers
    if not combined:
        log_debug(" Todos los intentos agotados, devolviendo None")
        return None

    for i, offer in enumerate(combined, 1):
        offer["id"] = i

    log_debug(f" TOTAL combinado: {len(combined)} ofertas ({len(db_offers)} BD + {len(adzuna_offers)} Adzuna)")
    return combined


def _map_adzuna_to_internal_format(adzuna_results: list) -> list:
    """
    Mapea ofertas de Adzuna al formato interno.
    Incluye adzuna_id (el ID real de Adzuna) para caché y deduplicación.
    """
    mapped = []

    for idx, job in enumerate(adzuna_results, 1):
        # Extraer salario si está disponible
        salario = None
        if job.get("salary_min") and job.get("salary_max"):
            salary_min = int(job["salary_min"])
            salary_max = int(job["salary_max"])
            salario = f"{salary_min:,} - {salary_max:,}/año"
        elif job.get("salary_min"):
            salario = f"{int(job['salary_min']):,}/año"
        elif job.get("salary_max"):
            salario = f"Hasta {int(job['salary_max']):,}/año"

        # Limpiar descripción (Adzuna incluye HTML)
        description = job.get("description", "").replace("<br>", " ").replace("</p>", " ").replace("<p>", "").strip()

        offer = {
            "id": idx,
            "adzuna_id": str(job.get("id", "")),   # ID estable de Adzuna
            "titulo": job.get("title", "Sin título"),
            "empresa": job.get("company", {}).get("display_name", "Empresa desconocida") if isinstance(job.get("company"), dict) else job.get("company", "Empresa desconocida"),
            "ubicacion": job.get("location", {}).get("display_name", "Ubicación desconocida") if isinstance(job.get("location"), dict) else job.get("location", "Ubicación desconocida"),
            "descripcion": description,
            "salario": salario or "Salario no especificado",
            "fecha_publicacion": job.get("created", ""),
            "redirect_url": job.get("redirect_url", ""),
        }

        mapped.append(offer)

    return mapped
