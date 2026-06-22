"""Servicio de búsqueda de ofertas: combina las fuentes oficiales (ATS) con los agregadores (Adzuna, JSearch) y ordena por relevancia al perfil."""
import asyncio
import os

from app.services.adzuna_service import fetch_offers_from_adzuna
from app.services.job_index_service import build_offer_dedupe_key, get_recent_db_offers, save_offers_to_db
from app.services.job_verification_service import refresh_stale_job_offers
from app.services.jsearch_service import fetch_offers_from_jsearch
from app.services.official_sources_service import fetch_offers_from_public_sources


def _enrich_with_aggregators() -> bool:
    """Si los agregadores (Adzuna ES + JSearch) se consultan SIEMPRE para enriquecer
    la búsqueda. Traen ofertas reales del mercado, por rol y de muchas empresas
    (la variedad que los pocos boards de empresa no dan). Desactivable por entorno."""
    return os.getenv("SEARCH_ENRICH_AGGREGATORS", "true").strip().lower() != "false"


def _relevance(offer: dict, skills_norm: list[str]) -> int:
    """Cuánto coincide la oferta con las skills buscadas (título pesa más que descripción).
    Permite priorizar ofertas realmente del rol, vengan de la fuente que vengan."""
    if not skills_norm:
        return 0
    title = (offer.get("titulo") or "").lower()
    desc = (offer.get("descripcion") or "").lower()
    score = 0
    for skill in skills_norm:
        if skill in title:
            score += 3
        elif skill in desc:
            score += 1
    return score


def _dedupe_and_sort_offers(offers: list[dict], skills: list[str] | None = None) -> list[dict]:
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
    skills_norm = [s.lower().strip() for s in (skills or []) if s and s.strip()]
    # Ordena por RELEVANCIA al rol primero (para que las ofertas que de verdad
    # encajan lleguen al analizador), luego por confianza de fuente y frescura.
    return sorted(
        deduped.values(),
        key=lambda item: (
            -_relevance(item, skills_norm),
            -(float(item.get("source_confidence") or 0)),
            str(item.get("fecha_publicacion") or ""),
            str(item.get("titulo") or ""),
        ),
    )


async def fetch_offers_for_search(
    skills: list[str],
    locations: list[str] | None = None,
    db=None,
    live: bool = True,
) -> list[dict] | None:
    """Obtiene ofertas para una búsqueda.

    Con ``live=True`` (por defecto) consulta fuentes oficiales (ATS) y agregadores
    (Adzuna/JSearch) en vivo además del índice en BD. Con ``live=False`` usa solo
    el índice ya cacheado en BD — mucho más rápido y sin latencia externa, ideal
    para flujos pesados como el análisis de CV (evita timeouts/502 en hosting con
    pocos recursos).
    """
    if db and live:
        try:
            await refresh_stale_job_offers(db)
        except Exception:
            pass

    # Para el flujo cacheado (live=False) ampliamos la ventana de recencia: así
    # devuelve ofertas del índice aunque la ingesta automática no se haya ejecutado
    # hace poco (p. ej. en hosting gratuito que se duerme).
    cached_hours = 24 if live else int(os.getenv("SEARCH_CACHED_HOURS", "720"))
    cached_offers = get_recent_db_offers(db, skills, hours=cached_hours) if db else []
    official_offers: list[dict] = []
    aggregator_offers: list[dict] = []

    if live:
        official_offers = await fetch_offers_from_public_sources(skills, locations=locations) or []
        # Enriquecer con agregadores de mercado (Adzuna ES + JSearch) en paralelo.
        if _enrich_with_aggregators():
            adzuna_task = fetch_offers_from_adzuna(skills, locations=locations, db=None, fallback_query=None)
            jsearch_task = fetch_offers_from_jsearch(skills, locations=locations, results_per_skill=10)
            adz, js = await asyncio.gather(adzuna_task, jsearch_task, return_exceptions=True)
            if not isinstance(adz, Exception) and adz:
                aggregator_offers.extend(adz)
            if not isinstance(js, Exception) and js:
                aggregator_offers.extend(js)

        if db:
            if official_offers:
                save_offers_to_db(db, official_offers, skills)
            if aggregator_offers:
                save_offers_to_db(db, aggregator_offers, skills)

    merged = _dedupe_and_sort_offers([*cached_offers, *official_offers, *aggregator_offers], skills=skills)
    if not merged:
        return None

    # Tope de seguridad: limita el coste del matching/IA y el uso de memoria.
    max_offers = int(os.getenv("SEARCH_MAX_OFFERS", "40"))
    if max_offers > 0:
        merged = merged[:max_offers]

    for index, offer in enumerate(merged, 1):
        offer["id"] = index
    return merged
