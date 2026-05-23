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
from app.models.match_feedback import MatchFeedback
from app.services.ai_quota_service import consume_ai_quota
from app.services.company_data_service import enrich_items_with_company_data as enrich_items_with_company_logos
from app.services.job_search_service import fetch_offers_for_search
from app.services.matching_service import MATCH_ENGINE_VERSION, generate_skills_gap, match_profile_with_offers
from app.services.rate_limit_service import RateLimitRule, enforce_rate_limits
from app.services.security_service import get_client_ip
from app.routers.user import get_current_user_record

router = APIRouter()

APLICA_THRESHOLD = 73
QUIZA_THRESHOLD = 52


def _apply_feedback_boost(offers_list: list, feedback_map: dict) -> list:
    """Apply per-offer and company-level score adjustments based on user feedback.

    Direct hit (same adzuna_id rated up/down): ±6/−8 pts, result label recalculated.
    Company-level (other offers from a liked company): +3 pts, no result change.
    Cache is NOT affected — boosts are applied after loading from cache.
    """
    if not feedback_map:
        return offers_list

    # Build set of companies the user has liked (for company-level boost)
    liked_companies: set[str] = set()
    for offer in offers_list:
        oid = offer.get("adzuna_id") or offer.get("id", "")
        if feedback_map.get(oid) == "up":
            empresa = (offer.get("empresa") or "").strip().lower()
            if empresa:
                liked_companies.add(empresa)

    result_order = {"APLICA": 0, "QUIZÁ": 1, "NO_ENCAJA": 2}

    for offer in offers_list:
        oid = offer.get("adzuna_id") or offer.get("id", "")
        boost = 0

        if oid in feedback_map:
            # Direct offer feedback
            if feedback_map[oid] == "up":
                boost = 6
            elif feedback_map[oid] == "down":
                boost = -8
        elif liked_companies:
            # Company-level soft boost
            empresa = (offer.get("empresa") or "").strip().lower()
            if empresa and empresa in liked_companies:
                boost = 3

        if boost != 0:
            old_score = offer.get("puntuacion") or 0
            new_score = max(0, min(100, old_score + boost))
            offer["puntuacion"] = new_score
            offer["ranking_score"] = new_score
            # Recalculate result label
            if new_score >= APLICA_THRESHOLD:
                offer["resultado"] = "APLICA"
            elif new_score >= QUIZA_THRESHOLD:
                offer["resultado"] = "QUIZÁ"
            else:
                offer["resultado"] = "NO_ENCAJA"

    # Re-sort after feedback adjustments
    offers_list.sort(key=lambda x: (
        result_order.get(x.get("resultado", "NO_ENCAJA"), 2),
        -(x.get("ranking_score") or 0),
        -(x.get("puntuacion") or 0),
    ))
    return offers_list


class ProfileRequest(BaseModel):
    experience: str
    stack: list[str]
    english: str
    ubicaciones: list[str] = []
    modalidad: list[str] = []
    idiomas: list[dict] = []


def _compute_profile_hash(profile: dict) -> str:
    profile_str = json.dumps(
        {"engine_version": MATCH_ENGINE_VERSION, "profile": profile},
        sort_keys=True,
        ensure_ascii=False,
    )
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

        if not getattr(user, "is_super_admin", False):
            enforce_rate_limits(db, [
                RateLimitRule(
                    action="match_ip",
                    bucket_key=f"ip:{client_ip}",
                    limit=40,
                    window_seconds=3600,
                    detail="Has realizado demasiados analisis desde esta IP. Intentalo mas tarde.",
                ),
                RateLimitRule(
                    action="match_user",
                    bucket_key=f"user:{user.id}",
                    limit=20,
                    window_seconds=3600,
                    detail="Has realizado demasiados analisis en poco tiempo. Espera un poco antes de volver a intentarlo.",
                ),
            ])

        # Load user's feedback for personalized scoring (applied post-cache, non-cached result)
        feedback_map: dict[str, str] = {}
        try:
            feedback_rows = db.query(MatchFeedback).filter(
                MatchFeedback.user_id == user.id
            ).all()
            feedback_map = {row.adzuna_id: row.rating for row in feedback_rows}
        except Exception as e:
            print(f"[FEEDBACK] Error cargando historial: {e}")

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
            offers_list = _apply_feedback_boost(offers_list, feedback_map)
            return JSONResponse(
                content={"offers": offers_list, "skills_gap": skills_gap_data},
                media_type="application/json; charset=utf-8",
            )

        consume_ai_quota(db, user, "match")

        print(f"[MATCH] Intentando obtener ofertas para skills: {profile.stack}")
        offers = await fetch_offers_for_search(
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
                user_id=user.id,
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

        # Ordenar por fit real: APLICA > QUIZA > NO_ENCAJA, suborden por puntuacion
        result_order = {"APLICA": 0, "QUIZÁ": 1, "NO_ENCAJA": 2}
        enriched.sort(key=lambda x: (
            result_order.get(x.get("resultado", "NO_ENCAJA"), 2),
            -(x.get("ranking_score") or 0),
            -(x.get("puntuacion") or 0),
            len(x.get("blockers") or []),
            -len(x.get("skills_match") or []),
            -(float(x.get("source_confidence") or 0)),
        ))

        skills_gap_data = None
        try:
            skills_gap_data = generate_skills_gap(
                profile_dict, offers, results, api_key, user_id=user.id
            )
        except Exception as e:
            print(f"[SKILLS_GAP] Error no crítico: {e}")

        try:
            _save_cache(db, perfil_hash, enriched, skills_gap_data)
            print(f"[CACHE] MISS — guardado en BD, hash {perfil_hash[:8]}...")
        except Exception as e:
            print(f"[CACHE] Error al guardar en BD: {e}")

        enriched = _apply_feedback_boost(enriched, feedback_map)

        return JSONResponse(
            content={"offers": enriched, "skills_gap": skills_gap_data},
            media_type="application/json; charset=utf-8",
        )
    finally:
        if db:
            db.close()

# ── Load more ────────────────────────────────────────────────────────────────

class MoreOffersRequest(BaseModel):
    experience: str
    stack: list[str]
    english: str
    ubicaciones: list[str] = []
    modalidad: list[str] = []
    idiomas: list[dict] = []
    exclude_ids: list[str] = []   # adzuna_ids ya mostrados
    adzuna_page: int = 2          # página de Adzuna a pedir
    results_count: int = 0        # total de resultados ya cargados (para asignar IDs únicos)


@router.post("/api/match/more")
async def match_more_offers(
    body: MoreOffersRequest,
    user=Depends(get_current_user_record),
):
    from app.services.adzuna_service import fetch_adzuna_page
    from app.services.job_index_service import get_recent_db_offers, save_offers_to_db

    api_key = os.getenv("CLAUDE_API_KEY")
    if not api_key:
        return JSONResponse(status_code=500, content={"detail": "CLAUDE_API_KEY no configurada"}, media_type="application/json; charset=utf-8")

    SessionLocal = get_session_local()
    db = SessionLocal() if SessionLocal else None
    if not db:
        return JSONResponse(status_code=500, content={"detail": "Base de datos no disponible"}, media_type="application/json; charset=utf-8")

    try:
        consume_ai_quota(db, user, "match")

        exclude_set = {eid for eid in body.exclude_ids if eid}

        # 1. Sacar ofertas de DB que el usuario aún no ha visto
        all_db = get_recent_db_offers(db, body.stack)
        new_offers = [o for o in all_db if o.get("adzuna_id") not in exclude_set]

        # 2. Si hay menos de 20 en DB, traer la siguiente página de Adzuna
        if len(new_offers) < 20:
            adzuna_fresh = await fetch_adzuna_page(
                body.stack,
                body.ubicaciones or None,
                page=body.adzuna_page,
            )
            if adzuna_fresh:
                for offer in adzuna_fresh:
                    if offer.get("adzuna_id") not in exclude_set:
                        new_offers.append(offer)
                try:
                    save_offers_to_db(db, adzuna_fresh, body.stack)
                except Exception as exc:
                    print(f"[MATCH_MORE] Error guardando Adzuna en DB: {exc}")

        # 3. Tomar los primeros 20, asignar IDs continuando la numeración anterior
        batch = new_offers[:20]
        has_more = len(new_offers) > 20
        offset = body.results_count  # usa el conteo real enviado desde el frontend
        for i, offer in enumerate(batch, start=offset + 1):
            offer["id"] = i

        if not batch:
            return JSONResponse(
                content={"offers": [], "has_more": False, "next_adzuna_page": body.adzuna_page + 1},
                media_type="application/json; charset=utf-8",
            )

        # 4. Perfil para el motor de matching
        profile_dict = {
            "experience": body.experience,
            "stack": body.stack,
            "english": body.english,
            "ubicaciones": body.ubicaciones,
            "modalidad": body.modalidad,
            "idiomas": body.idiomas,
        }

        # 5. Analizar el batch
        try:
            results = match_profile_with_offers(
                profile_dict, batch, api_key, db=db, user_id=user.id
            )
        except Exception as e:
            error_msg = str(e)
            if "429" in error_msg or "rate" in error_msg.lower():
                return JSONResponse(status_code=429, content={"detail": "Cuota de Claude API agotada. Espera unos minutos."}, media_type="application/json; charset=utf-8")
            return JSONResponse(status_code=502, content={"detail": f"Error al contactar con Claude API: {error_msg}"}, media_type="application/json; charset=utf-8")

        # 6. Enriquecer con logos
        offers_by_id = {o["id"]: o for o in batch}
        enriched = [{**offers_by_id.get(r["id"], {}), **r, "desde_cache": False} for r in results]
        try:
            enriched = enrich_items_with_company_logos(db, enriched)
        except Exception:
            pass

        # 7. Ordenar igual que la búsqueda principal
        result_order = {"APLICA": 0, "QUIZÁ": 1, "NO_ENCAJA": 2}
        enriched.sort(key=lambda x: (
            result_order.get(x.get("resultado", "NO_ENCAJA"), 2),
            -(x.get("ranking_score") or 0),
            -(x.get("puntuacion") or 0),
            len(x.get("blockers") or []),
            -(float(x.get("source_confidence") or 0)),
        ))

        return JSONResponse(
            content={
                "offers": enriched,
                "has_more": has_more,
                "next_adzuna_page": body.adzuna_page + 1,
            },
            media_type="application/json; charset=utf-8",
        )
    finally:
        if db:
            db.close()


# -- Feedback endpoints -------------------------------------------------------

class FeedbackRequest(BaseModel):
    adzuna_id: str
    rating: str  # "up" | "down"
    offer_score: int | None = None
    offer_result: str | None = None  # APLICA | QUIZA | NO_ENCAJA


@router.post("/api/match/feedback")
def submit_match_feedback(
    body: FeedbackRequest,
    user=Depends(get_current_user_record),
):
    if body.rating not in ("up", "down"):
        return JSONResponse(status_code=422, content={"detail": "rating debe ser up o down"})
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(status_code=500, content={"detail": "Base de datos no disponible"})
    db = SessionLocal()
    try:
        existing = (
            db.query(MatchFeedback)
            .filter(MatchFeedback.user_id == user.id, MatchFeedback.adzuna_id == body.adzuna_id)
            .first()
        )
        if existing:
            existing.rating = body.rating
            existing.offer_score = body.offer_score
            existing.offer_result = body.offer_result
        else:
            db.add(MatchFeedback(
                user_id=user.id,
                adzuna_id=body.adzuna_id,
                rating=body.rating,
                offer_score=body.offer_score,
                offer_result=body.offer_result,
                created_at=datetime.utcnow(),
            ))
        db.commit()
        return JSONResponse(content={"detail": "Feedback guardado", "rating": body.rating})
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@router.get("/api/match/feedback")
def get_my_feedback(user=Depends(get_current_user_record)):
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(status_code=500, content={"detail": "Base de datos no disponible"})
    db = SessionLocal()
    try:
        rows = db.query(MatchFeedback).filter(MatchFeedback.user_id == user.id).all()
        return JSONResponse(content={"feedback": {row.adzuna_id: row.rating for row in rows}})
    finally:
        db.close()

# ── Market analysis endpoint ──────────────────────────────────────────────────

@router.get("/api/match/market-analysis")
def get_market_analysis(user=Depends(get_current_user_record)):
    """
    Analisis de mercado personalizado basado en las ofertas activas:
    - Que skills del usuario tienen alta demanda
    - Que skills NO tiene el usuario pero hay alta demanda
    - Conteo de ofertas por modalidad / ubicacion
    """
    from app.models.job_offer import JobOffer
    import json, re

    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(status_code=500, content={"detail": "DB no disponible"})
    db = SessionLocal()
    try:
        # Get user stack
        user_stack = []
        if hasattr(user, "stack") and user.stack:
            try:
                user_stack = json.loads(user.stack) if isinstance(user.stack, str) else user.stack
            except Exception:
                user_stack = []

        # Sample recent active offers (limit for performance)
        offers = (
            db.query(JobOffer)
            .filter(JobOffer.is_active.is_(True))
            .order_by(JobOffer.created_at.desc())
            .limit(2000)
            .all()
        )

        if not offers:
            return JSONResponse(content={"skills_demand": [], "skill_gaps": [], "modality_dist": {}, "location_dist": {}, "total_offers": 0})

        total = len(offers)

        # --- Skill demand analysis ---
        COMMON_TECHS = [
            "python", "javascript", "typescript", "react", "node.js", "java", "sql", "docker",
            "kubernetes", "aws", "gcp", "azure", "go", "rust", "c#", "php", "vue", "angular",
            "next.js", "fastapi", "django", "spring", "mongodb", "postgresql", "redis",
            "machine learning", "tensorflow", "pytorch", "pandas", "kafka", "elasticsearch",
            "terraform", "linux", "git", "ci/cd", "flutter", "swift", "kotlin", "react native",
        ]

        skill_counts = {}
        for tech in COMMON_TECHS:
            count = 0
            for offer in offers:
                text = ((offer.titulo or "") + " " + (offer.descripcion or "")).lower()
                if tech in text:
                    count += 1
            if count > 0:
                skill_counts[tech] = count

        # Sort by demand
        sorted_skills = sorted(skill_counts.items(), key=lambda x: x[1], reverse=True)

        # Skills user HAS that are in demand
        user_stack_lower = [s.lower() for s in user_stack]
        skills_demand = [
            {
                "skill": s.title(),
                "count": c,
                "pct": round(c / total * 100),
                "user_has": any(s in u or u in s for u in user_stack_lower),
            }
            for s, c in sorted_skills[:20]
        ]

        # Gap skills: high demand but user doesn't have them
        skill_gaps = [
            {"skill": item["skill"], "count": item["count"], "pct": item["pct"]}
            for item in skills_demand
            if not item["user_has"] and item["pct"] >= 5
        ][:6]

        # --- Modality distribution ---
        modality_dist = {"remoto": 0, "hibrido": 0, "presencial": 0, "no_especificado": 0}
        for offer in offers:
            signals = {}
            try:
                signals = json.loads(offer.signals_summary_json or "{}")
            except Exception:
                pass
            wm = (signals.get("work_mode") or "").lower()
            if "remote" in wm:
                modality_dist["remoto"] += 1
            elif "hybrid" in wm:
                modality_dist["hibrido"] += 1
            elif "onsite" in wm or "presencial" in wm:
                modality_dist["presencial"] += 1
            else:
                modality_dist["no_especificado"] += 1

        # --- Location distribution ---
        location_counts = {}
        for offer in offers:
            loc = (offer.ubicacion or "").strip()
            if loc and len(loc) < 40:
                # Normalize
                loc = loc.split(",")[0].strip()
                location_counts[loc] = location_counts.get(loc, 0) + 1

        top_locations = sorted(location_counts.items(), key=lambda x: x[1], reverse=True)[:8]

        return JSONResponse(content={
            "total_offers": total,
            "skills_demand": [s for s in skills_demand if s["pct"] >= 3],
            "skill_gaps": skill_gaps,
            "modality_dist": modality_dist,
            "top_locations": [{"location": l, "count": c} for l, c in top_locations],
        })
    finally:
        db.close()
