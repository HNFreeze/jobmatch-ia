# -*- coding: utf-8 -*-
"""
Router para la funcionalidad "Buscar por CV".
Endpoints:
  POST /api/cv/analyze  — Sube un CV, extrae perfil y busca ofertas
  POST /api/cv/improve  — Sube un CV y devuelve sugerencias de mejora ATS
  GET  /api/cv/latest   — Devuelve el último análisis guardado del usuario
"""
import hashlib
import json
import os
from datetime import datetime

from fastapi import APIRouter, Depends, Request, UploadFile, File
from fastapi.responses import JSONResponse

from app.database import get_session_local
from app.models.cv_analysis import CVAnalysis
from app.routers.user import get_current_user_record
from app.services.adzuna_service import fetch_offers_from_adzuna
from app.services.ai_quota_service import consume_ai_quota
from app.services.company_data_service import enrich_items_with_company_data as enrich_items_with_company_logos
from app.services.cv_service import (
    analyze_cv_with_ai,
    build_adzuna_search_params,
    build_matching_profile,
    extract_text_from_pdf,
    improve_cv_with_ai,
    read_and_validate_content,
    validate_cv_upload,
)
from app.services.matching_service import MATCH_ENGINE_VERSION, generate_skills_gap, match_profile_with_offers
from app.services.security_service import get_client_ip

router = APIRouter()


def _compute_cv_profile_hash(cv_analysis_id: int, matching_profile: dict) -> str:
    payload = json.dumps(
        {
            "engine_version": MATCH_ENGINE_VERSION,
            "source": "cv",
            "cv_id": cv_analysis_id,
            "profile": matching_profile,
        },
        sort_keys=True,
        ensure_ascii=False,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def _mark_previous_as_not_latest(db, user_id: int) -> None:
    db.query(CVAnalysis).filter(
        CVAnalysis.user_id == user_id,
        CVAnalysis.is_latest.is_(True),
    ).update({"is_latest": False})


@router.post("/api/cv/analyze")
async def analyze_cv(
    request: Request,
    file: UploadFile = File(...),
    user=Depends(get_current_user_record),
):
    api_key = os.getenv("CLAUDE_API_KEY")
    if not api_key:
        return JSONResponse(
            status_code=500,
            content={"detail": "CLAUDE_API_KEY no configurada"},
            media_type="application/json; charset=utf-8",
        )

    # Validación de tipo antes de leer el cuerpo
    validate_cv_upload(file)
    content = await read_and_validate_content(file)

    SessionLocal = get_session_local()
    db = SessionLocal() if SessionLocal is not None else None
    try:
        if not db:
            return JSONResponse(
                status_code=500,
                content={"detail": "Base de datos no disponible"},
                media_type="application/json; charset=utf-8",
            )

        # Consumir cuota IA (lanza 429 si se agotó)
        consume_ai_quota(db, user, "cv_analysis")

        # 1. Extraer texto del PDF
        cv_text = extract_text_from_pdf(content)

        # 2. Analizar con IA → perfil estructurado
        structured_profile, ai_usage = await analyze_cv_with_ai(cv_text, api_key, user_id=user.id)

        # 3. Persistir análisis en BD
        _mark_previous_as_not_latest(db, user.id)
        sanitized_filename = (file.filename or "cv.pdf")[:255]
        cv_record = CVAnalysis(
            user_id=user.id,
            filename_original=sanitized_filename,
            file_size_bytes=len(content),
            content_type="application/pdf",
            structured_profile_json=json.dumps(structured_profile, ensure_ascii=False),
            is_latest=True,
            ai_model=getattr(ai_usage, "model", None) or "claude-haiku-4-5-20251001",
            input_tokens=getattr(ai_usage, "input_tokens", 0) or 0,
            output_tokens=getattr(ai_usage, "output_tokens", 0) or 0,
        )
        db.add(cv_record)
        db.commit()
        db.refresh(cv_record)

        # 4. Construir perfil de matching y búsqueda Adzuna
        matching_profile = build_matching_profile(structured_profile)
        search_skills, search_locations = build_adzuna_search_params(structured_profile)

        # 5. Obtener ofertas de Adzuna
        offers = await fetch_offers_from_adzuna(
            skills=search_skills,
            locations=search_locations if search_locations else None,
            db=db,
        )

        if not offers:
            return JSONResponse(
                status_code=503,
                content={
                    "detail": "No se pudo obtener ofertas de trabajo en este momento. El análisis del CV sí se guardó.",
                    "analysis_id": cv_record.id,
                    "structured_profile": structured_profile,
                    "offers": [],
                    "skills_gap": None,
                },
                media_type="application/json; charset=utf-8",
            )

        # 6. Matching con IA
        profile_hash = _compute_cv_profile_hash(cv_record.id, matching_profile)
        try:
            results = match_profile_with_offers(
                matching_profile,
                offers,
                api_key,
                db=db,
                profile_hash=profile_hash,
                user_id=user.id,
            )
        except Exception as e:
            err = str(e)
            if "429" in err or "rate" in err.lower():
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Cuota de Claude API agotada. Espera unos minutos."},
                    media_type="application/json; charset=utf-8",
                )
            return JSONResponse(
                status_code=502,
                content={"detail": f"Error al contactar con Claude API: {err}"},
                media_type="application/json; charset=utf-8",
            )

        # 7. Enriquecer con datos de empresa
        offers_by_id = {o["id"]: o for o in offers}
        enriched = []
        for result in results:
            offer = offers_by_id.get(result["id"], {})
            enriched.append({**offer, **result, "desde_cache": False})
        try:
            enriched = enrich_items_with_company_logos(db, enriched)
        except Exception as e:
            print(f"[CV_LOGO] Error enriqueciendo logos: {e}")

        # Ordenar por fit
        result_order = {"APLICA": 0, "QUIZÁ": 1, "NO_ENCAJA": 2}
        enriched.sort(
            key=lambda x: (
                result_order.get(x.get("resultado", "NO_ENCAJA"), 2),
                -(x.get("puntuacion") or 0),
                len(x.get("blockers") or []),
                -len(x.get("skills_match") or []),
            )
        )

        # 8. Skills gap
        skills_gap = None
        try:
            skills_gap = generate_skills_gap(
                matching_profile, offers, results, api_key, user_id=user.id
            )
        except Exception as e:
            print(f"[CV_SKILLS_GAP] Error no crítico: {e}")

        return JSONResponse(
            content={
                "analysis_id": cv_record.id,
                "structured_profile": structured_profile,
                "offers": enriched,
                "skills_gap": skills_gap,
            },
            media_type="application/json; charset=utf-8",
        )

    finally:
        if db:
            db.close()


@router.post("/api/cv/improve")
async def improve_cv(
    file: UploadFile = File(...),
    user=Depends(get_current_user_record),
):
    """Analiza el CV con IA y devuelve sugerencias de mejora orientadas a ATS."""
    api_key = os.getenv("CLAUDE_API_KEY")
    if not api_key:
        return JSONResponse(
            status_code=500,
            content={"detail": "CLAUDE_API_KEY no configurada"},
            media_type="application/json; charset=utf-8",
        )

    validate_cv_upload(file)
    content = await read_and_validate_content(file)

    SessionLocal = get_session_local()
    db = SessionLocal() if SessionLocal is not None else None
    try:
        if not db:
            return JSONResponse(
                status_code=500,
                content={"detail": "Base de datos no disponible"},
                media_type="application/json; charset=utf-8",
            )

        # Cuota independiente: máx 2 mejoras/día
        quota = consume_ai_quota(db, user, "cv_improve")

        cv_text = extract_text_from_pdf(content)
        improvement, ai_usage = await improve_cv_with_ai(cv_text, api_key, user_id=user.id)

        return JSONResponse(
            content={
                "improvement": improvement,
                "quota": {
                    "cv_improve_used": quota["cv_improve_count"],
                    "cv_improve_remaining": quota["cv_improve_remaining"],
                },
            },
            media_type="application/json; charset=utf-8",
        )
    finally:
        if db:
            db.close()


@router.get("/api/cv/latest")
def get_latest_cv_analysis(user=Depends(get_current_user_record)):
    """Devuelve el último análisis de CV guardado del usuario, sin relanzar la búsqueda."""
    SessionLocal = get_session_local()
    db = SessionLocal() if SessionLocal is not None else None
    try:
        if not db:
            return JSONResponse(
                status_code=500,
                content={"detail": "Base de datos no disponible"},
                media_type="application/json; charset=utf-8",
            )

        record = (
            db.query(CVAnalysis)
            .filter(CVAnalysis.user_id == user.id, CVAnalysis.is_latest.is_(True))
            .order_by(CVAnalysis.created_at.desc())
            .first()
        )

        if not record:
            return JSONResponse(
                content={"analysis": None},
                media_type="application/json; charset=utf-8",
            )

        try:
            profile = json.loads(record.structured_profile_json)
        except Exception:
            profile = {}

        return JSONResponse(
            content={
                "analysis": {
                    "id": record.id,
                    "filename_original": record.filename_original,
                    "file_size_bytes": record.file_size_bytes,
                    "structured_profile": profile,
                    "created_at": record.created_at.isoformat() if record.created_at else None,
                }
            },
            media_type="application/json; charset=utf-8",
        )
    finally:
        if db:
            db.close()
