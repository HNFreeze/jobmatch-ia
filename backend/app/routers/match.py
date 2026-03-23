# -*- coding: utf-8 -*-
import hashlib
import json
import os
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.database import get_session_local
from app.models.cache import SearchCache
from app.services.adzuna_service import fetch_offers_from_adzuna
from app.services.ai_quota_service import consume_ai_quota
from app.services.company_logo_service import enrich_items_with_company_logos
from app.services.matching_service import generate_skills_gap, match_profile_with_offers
from app.services.rate_limit_service import RateLimitRule, enforce_rate_limits
from app.services.security_service import get_client_ip
from app.routers.user import get_current_user_record

router = APIRouter()


class ProfileRequest(BaseModel):
    experience: str
    stack: list[str]
    english: str
    ubicaciones: list[str] = []
    modalidad: list[str] = []
    idiomas: list[dict] = []


def _compute_profile_hash(profile: dict) -> str:
    profile_str = json.dumps(profile, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(profile_str.encode()).hexdigest()


def _get_cache(db, perfil_hash: str):
    return db.query(SearchCache).filter(
        SearchCache.perfil_hash == perfil_hash,
        SearchCache.expires_at > datetime.utcnow()
    ).first()


def _save_cache(db, perfil_hash: str, offers: list, skills_gap: dict | None = None):
    payload = {"offers": offers, "skills_gap": skills_gap}
    json_str = json.dumps(payload, ensure_ascii=False)
    existing = db.query(SearchCache).filter(
        SearchCache.perfil_hash == perfil_hash
    ).first()
    if existing:
        existing.ofertas_json = json_str
        existing.created_at = datetime.utcnow()
        existing.expires_at = datetime.utcnow() + timedelta(hours=24)
    else:
        db.add(SearchCache(
            perfil_hash=perfil_hash,
            ofertas_json=json_str,
        ))
    db.commit()


@router.post("/api/match")
async def match_offers(
    profile: ProfileRequest,
    request: Request,
    user=Depends(get_current_user_record),
):
    api_key = os.getenv("CLAUDE_API_KEY")
    if not api_key:
        return JSONResponse(
            status_code=500,
            content={"detail": "CLAUDE_API_KEY no configurada"},
            media_type="application/json; charset=utf-8"
        )

    profile_dict = profile.model_dump()
    perfil_hash = _compute_profile_hash(profile_dict)
    client_ip = get_client_ip(request)

    SessionLocal = get_session_local()
    db = SessionLocal() if SessionLocal is not None else None

    try:
        if not db:
            return JSONResponse(
                status_code=500,
                content={"detail": "Base de datos no disponible"},
                media_type="application/json; charset=utf-8",
            )

        enforce_rate_limits(db, [
            RateLimitRule(
                action="match_ip",
                bucket_key=f"ip:{client_ip}",
                limit=40,
                window_seconds=3600,
                detail="Has realizado demasiados análisis desde esta IP. Inténtalo más tarde.",
            ),
            RateLimitRule(
                action="match_user",
                bucket_key=f"user:{user.id}",
                limit=20,
                window_seconds=3600,
                detail="Has realizado demasiados análisis en poco tiempo. Espera un poco antes de volver a intentarlo.",
            ),
        ])

        cached = _get_cache(db, perfil_hash)
        if cached:
            print(f"[CACHE] HIT — hash {perfil_hash[:8]}...")
            raw = json.loads(cached.ofertas_json)
            if isinstance(raw, list):
                offers_list = raw
                skills_gap_data = None
            else:
                offers_list = raw.get("offers", [])
                skills_gap_data = raw.get("skills_gap")
            try:
                offers_list = enrich_items_with_company_logos(db, offers_list)
            except Exception as e:
                print(f"[LOGO_CACHE] Error enriqueciendo cache: {e}")
            for item in offers_list:
                item["desde_cache"] = True
            return JSONResponse(
                content={"offers": offers_list, "skills_gap": skills_gap_data},
                media_type="application/json; charset=utf-8",
            )

        consume_ai_quota(db, user, "match")

        print(f"[MATCH] Intentando obtener ofertas para skills: {profile.stack}")
        offers = await fetch_offers_from_adzuna(
            profile.stack,
            locations=profile.ubicaciones or None,
            db=db,
        )
        print(f"[MATCH] Ofertas obtenidas: {len(offers) if offers else 0}")

        if not offers:
            return JSONResponse(
                status_code=503,
                content={"detail": "No se pudo conectar con la fuente de ofertas de trabajo. Por favor, intenta de nuevo en unos momentos."},
                media_type="application/json; charset=utf-8"
            )

        try:
            results = match_profile_with_offers(
                profile_dict,
                offers,
                api_key,
                db=db,
                profile_hash=perfil_hash,
            )
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

        offers_by_id = {o["id"]: o for o in offers}
        enriched = []
        for result in results:
            offer = offers_by_id.get(result["id"], {})
            enriched.append({**offer, **result, "desde_cache": False})
        try:
            enriched = enrich_items_with_company_logos(db, enriched)
        except Exception as e:
            print(f"[LOGO_CACHE] Error enriqueciendo ofertas: {e}")

        # ── Ordenar por fit real: APLICA > QUIZÁ > NO_ENCAJA, sub-orden por puntuación ──
        _RESULT_ORDER = {"APLICA": 0, "QUIZÁ": 1, "NO_ENCAJA": 2}
        enriched.sort(key=lambda x: (
            _RESULT_ORDER.get(x.get("resultado", "NO_ENCAJA"), 2),
            -(x.get("puntuacion") or 0)
        ))

        skills_gap_data = None
        try:
            skills_gap_data = generate_skills_gap(
                profile_dict, offers, results, api_key
            )
        except Exception as e:
            print(f"[SKILLS_GAP] Error no crítico: {e}")

        try:
            _save_cache(db, perfil_hash, enriched, skills_gap_data)
            print(f"[CACHE] MISS — guardado en BD, hash {perfil_hash[:8]}...")
        except Exception as e:
            print(f"[CACHE] Error al guardar en BD: {e}")

        return JSONResponse(
            content={"offers": enriched, "skills_gap": skills_gap_data},
            media_type="application/json; charset=utf-8",
        )
    finally:
        if db:
            db.close()
