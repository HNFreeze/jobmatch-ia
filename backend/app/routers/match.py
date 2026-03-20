# -*- coding: utf-8 -*-
import json
import os
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.services.matching_service import match_profile_with_offers
from app.services.adzuna_service import fetch_offers_from_adzuna

router = APIRouter()

OFFERS_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "mock_offers.json"


class ProfileRequest(BaseModel):
    experience: str
    stack: list[str]
    english: str


@router.post("/api/match")
async def match_offers(profile: ProfileRequest):
    api_key = os.getenv("CLAUDE_API_KEY")
    if not api_key:
        return JSONResponse(
            status_code=500,
            content={"detail": "CLAUDE_API_KEY no configurada"},
            media_type="application/json; charset=utf-8"
        )

    # Intenta obtener ofertas reales de Adzuna
    print(f"[MATCH] Intentando Adzuna con skills: {profile.stack}")
    offers = await fetch_offers_from_adzuna(profile.stack)
    print(f"[MATCH] Adzuna devolvio: {len(offers) if offers else 0} ofertas")

    # Fallback a mock_offers.json si Adzuna falla
    if not offers:
        print("USANDO MOCK FALLBACK")
        with open(OFFERS_PATH, encoding="utf-8") as f:
            offers = json.load(f)

    try:
        results = match_profile_with_offers(profile.model_dump(), offers, api_key)
    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg or "rate" in error_msg.lower():
            return JSONResponse(
                status_code=429,
                content={"detail": "Cuota de Claude API agotada. Espera unos minutos o revisa tu plan."},
                media_type="application/json; charset=utf-8"
            )
        return JSONResponse(
            status_code=502,
            content={"detail": f"Error al contactar con Claude API: {error_msg}"},
            media_type="application/json; charset=utf-8"
        )

    # Enriquecer resultados con datos de la oferta
    offers_by_id = {o["id"]: o for o in offers}
    enriched = []
    for r in results:
        offer = offers_by_id.get(r["id"], {})
        enriched.append({**offer, **r})

    return JSONResponse(
        content=enriched,
        media_type="application/json; charset=utf-8"
    )
