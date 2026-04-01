# -*- coding: utf-8 -*-
"""
Router para el módulo completo de CV.
Endpoints:
  POST /api/cv/analyze            — Buscar ofertas a partir del CV
  POST /api/cv/improve            — Mejora ATS simple (legado)
  POST /api/cv/improve-full       — Mejora ATS completa con texto mejorado y guardado en DB
  GET  /api/cv/download-pdf/{id}  — Genera y descarga PDF del CV mejorado
  GET  /api/cv/my-improvements    — Lista de CVs mejorados del usuario
  POST /api/cv/search-from-improvement/{id} — Busca ofertas desde CV mejorado guardado
  GET  /api/cv/latest             — Último análisis guardado
"""
import hashlib
import json
import os
from datetime import datetime, timedelta
from typing import Any, Dict

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query, Request, UploadFile, File
from fastapi.responses import JSONResponse, Response

from app.database import get_session_local
from app.models.cv_analysis import CVAnalysis
from app.models.cv_ats_result import CVAtsResult
from app.models.cv_edit_session import CVEditSession
from app.models.cv_improvement import CVImprovement
from app.routers.user import get_current_user_record
from app.services.adzuna_service import fetch_offers_from_adzuna
from app.services.ai_quota_service import consume_ai_quota
from app.services.company_data_service import enrich_items_with_company_data as enrich_items_with_company_logos
from app.services.cv_pdf_service import generate_cv_pdf, generate_cv_pdf_from_json
from app.services.cv_service import (
    analyze_cv_with_ai,
    build_adzuna_search_params,
    build_edit_context_for_prompt,
    build_matching_profile,
    extract_text_from_pdf,
    hash_cv_text,
    improve_cv_full,
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


@router.post("/api/cv/improve-full")
async def improve_cv_full_endpoint(
    file: UploadFile = File(...),
    user=Depends(get_current_user_record),
):
    """
    Mejora completa del CV:
    1. Analiza ATS con IA (con caché por hash)
    2. Genera texto completo del CV mejorado
    3. Guarda en cv_ats_results + cv_improvements
    Devuelve análisis + texto mejorado + IDs para PDF/búsqueda
    """
    api_key = os.getenv("CLAUDE_API_KEY")
    if not api_key:
        return JSONResponse(status_code=500, content={"detail": "CLAUDE_API_KEY no configurada"})

    validate_cv_upload(file)
    content = await read_and_validate_content(file)

    SessionLocal = get_session_local()
    db = SessionLocal() if SessionLocal is not None else None
    try:
        if not db:
            return JSONResponse(status_code=500, content={"detail": "Base de datos no disponible"})

        # Cuota: usa la misma acción cv_improve (máx 2/día, bypass para super admin)
        quota = consume_ai_quota(db, user, "cv_improve")

        cv_text = extract_text_from_pdf(content)
        cv_hash = hash_cv_text(cv_text)

        # ── Contexto de correcciones previas del usuario (<90 días) ──────────
        cutoff = datetime.utcnow() - timedelta(days=90)
        recent_edit = (
            db.query(CVEditSession)
            .filter(
                CVEditSession.user_id == user.id,
                CVEditSession.updated_at >= cutoff,
            )
            .order_by(CVEditSession.updated_at.desc())
            .first()
        )
        edit_context = ""
        if recent_edit:
            edit_context = build_edit_context_for_prompt(recent_edit.action_log_json)

        # ── Cache: ¿ya analizamos este CV hoy? ───────────────────────────────
        cached_ats = (
            db.query(CVAtsResult)
            .filter(CVAtsResult.user_id == user.id, CVAtsResult.cv_text_hash == cv_hash)
            .order_by(CVAtsResult.created_at.desc())
            .first()
        )

        # ── Llamada IA ───────────────────────────────────────────────────────
        full_result, _usage = await improve_cv_full(
            cv_text, api_key, user_id=user.id, edit_context=edit_context
        )

        # Guardar ATS result si no había caché idéntico
        if cached_ats is None:
            ats_record = CVAtsResult(
                user_id=user.id,
                cv_text_hash=cv_hash,
                original_cv_text=cv_text[:50000],
                ats_score_before=full_result["ats_score_before"],
                feedback_json=json.dumps({
                    "problems_detected": full_result["problems_detected"],
                    "key_improvements": full_result["key_improvements"],
                    "keywords_to_add": full_result["keywords_to_add"],
                }, ensure_ascii=False),
            )
            db.add(ats_record)
            db.flush()
            ats_result_id = ats_record.id
        else:
            ats_result_id = cached_ats.id

        # Guardar improvement (incluye cv_structured_json si lo generó la IA)
        meta = {
            "problems_detected": full_result["problems_detected"],
            "key_improvements": full_result["key_improvements"],
            "keywords_to_add": full_result["keywords_to_add"],
        }
        cv_structured = full_result.get("cv_structured_json")
        improvement_record = CVImprovement(
            user_id=user.id,
            ats_result_id=ats_result_id,
            improved_cv_text=full_result["improved_cv_text"],
            cv_structured_json=(
                json.dumps(cv_structured, ensure_ascii=False) if cv_structured else None
            ),
            ats_score_before=full_result["ats_score_before"],
            ats_score_after=full_result["ats_score_after"],
            meta_json=json.dumps(meta, ensure_ascii=False),
        )
        db.add(improvement_record)
        db.commit()
        db.refresh(improvement_record)

        return JSONResponse(
            content={
                "improvement_id": improvement_record.id,
                "ats_score_before": full_result["ats_score_before"],
                "ats_score_after": full_result["ats_score_after"],
                "problems_detected": full_result["problems_detected"],
                "key_improvements": full_result["key_improvements"],
                "keywords_to_add": full_result["keywords_to_add"],
                "improved_cv_text": full_result["improved_cv_text"],
                "cv_structured_json": cv_structured,
                "quota": {
                    "cv_improve_used": quota.get("cv_improve_count", 0),
                    "cv_improve_remaining": quota.get("cv_improve_remaining", 0),
                },
            },
            media_type="application/json; charset=utf-8",
        )
    finally:
        if db:
            db.close()


@router.get("/api/cv/download-pdf/{improvement_id}")
def download_cv_pdf(
    improvement_id: int = Path(..., ge=1),
    template: str = Query("professional_modern"),
    user=Depends(get_current_user_record),
):
    """Genera y devuelve el PDF del CV mejorado."""
    SessionLocal = get_session_local()
    db = SessionLocal() if SessionLocal is not None else None
    try:
        if not db:
            raise HTTPException(status_code=500, detail="Base de datos no disponible")

        record = (
            db.query(CVImprovement)
            .filter(CVImprovement.id == improvement_id, CVImprovement.user_id == user.id)
            .first()
        )
        if not record:
            raise HTTPException(status_code=404, detail="CV mejorado no encontrado")

        candidate_name = getattr(user, "nombre", "") or getattr(user, "alias", "") or ""

        # Fallback: edit_session → cv_structured_json → improved_cv_text (legacy)
        edit_session = (
            db.query(CVEditSession)
            .filter(
                CVEditSession.improvement_id == improvement_id,
                CVEditSession.user_id == user.id,
            )
            .order_by(CVEditSession.updated_at.desc())
            .first()
        )

        pdf_bytes: bytes
        if edit_session:
            try:
                edited_json = json.loads(edit_session.edited_cv_json)
                pdf_bytes = generate_cv_pdf_from_json(edited_json, candidate_name, template)
            except Exception:
                pdf_bytes = generate_cv_pdf(record.improved_cv_text, candidate_name)
        elif record.cv_structured_json:
            try:
                structured = json.loads(record.cv_structured_json)
                pdf_bytes = generate_cv_pdf_from_json(structured, candidate_name, template)
            except Exception:
                pdf_bytes = generate_cv_pdf(record.improved_cv_text, candidate_name)
        else:
            pdf_bytes = generate_cv_pdf(record.improved_cv_text, candidate_name)

        filename = f"cv_mejorado_{improvement_id}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    finally:
        if db:
            db.close()


@router.get("/api/cv/my-improvements")
def get_my_improvements(user=Depends(get_current_user_record)):
    """Lista de CVs mejorados del usuario (más reciente primero)."""
    SessionLocal = get_session_local()
    db = SessionLocal() if SessionLocal is not None else None
    try:
        if not db:
            return JSONResponse(status_code=500, content={"detail": "Base de datos no disponible"})

        records = (
            db.query(CVImprovement)
            .filter(CVImprovement.user_id == user.id)
            .order_by(CVImprovement.created_at.desc())
            .limit(20)
            .all()
        )

        items = []
        for r in records:
            meta = {}
            try:
                meta = json.loads(r.meta_json or "{}")
            except Exception:
                pass
            items.append({
                "id": r.id,
                "ats_score_before": r.ats_score_before,
                "ats_score_after": r.ats_score_after,
                "keywords_to_add": meta.get("keywords_to_add", [])[:5],
                "created_at": r.created_at.isoformat() if r.created_at else None,
            })

        return JSONResponse(
            content={"improvements": items},
            media_type="application/json; charset=utf-8",
        )
    finally:
        if db:
            db.close()


@router.post("/api/cv/search-from-improvement/{improvement_id}")
async def search_from_improvement(
    improvement_id: int = Path(..., ge=1),
    user=Depends(get_current_user_record),
):
    """Busca ofertas usando el texto del CV mejorado guardado en DB."""
    api_key = os.getenv("CLAUDE_API_KEY")
    if not api_key:
        return JSONResponse(status_code=500, content={"detail": "CLAUDE_API_KEY no configurada"})

    SessionLocal = get_session_local()
    db = SessionLocal() if SessionLocal is not None else None
    try:
        if not db:
            return JSONResponse(status_code=500, content={"detail": "Base de datos no disponible"})

        record = (
            db.query(CVImprovement)
            .filter(CVImprovement.id == improvement_id, CVImprovement.user_id == user.id)
            .first()
        )
        if not record:
            return JSONResponse(status_code=404, content={"detail": "CV mejorado no encontrado"})

        # Consumir cuota (búsqueda cuenta igual que análisis de CV)
        consume_ai_quota(db, user, "cv_analysis")

        # Analizar el CV mejorado para extraer perfil estructurado
        structured_profile, ai_usage = await analyze_cv_with_ai(
            record.improved_cv_text, api_key, user_id=user.id
        )

        matching_profile = build_matching_profile(structured_profile)
        search_skills, search_locations = build_adzuna_search_params(structured_profile)

        offers = await fetch_offers_from_adzuna(
            skills=search_skills,
            locations=search_locations if search_locations else None,
            db=db,
        )

        if not offers:
            return JSONResponse(
                content={"structured_profile": structured_profile, "offers": [], "skills_gap": None},
                media_type="application/json; charset=utf-8",
            )

        profile_hash = hashlib.sha256(
            json.dumps({"source": "cv_improved", "id": improvement_id, "profile": matching_profile},
                       sort_keys=True).encode()
        ).hexdigest()

        try:
            results = match_profile_with_offers(
                matching_profile, offers, api_key, db=db,
                profile_hash=profile_hash, user_id=user.id,
            )
        except Exception as e:
            err = str(e)
            if "429" in err:
                return JSONResponse(status_code=429, content={"detail": "Cuota Claude API agotada."})
            return JSONResponse(status_code=502, content={"detail": f"Error IA: {err}"})

        offers_by_id = {o["id"]: o for o in offers}
        enriched = []
        for result in results:
            offer = offers_by_id.get(result["id"], {})
            enriched.append({**offer, **result, "desde_cache": False})
        try:
            enriched = enrich_items_with_company_logos(db, enriched)
        except Exception:
            pass

        result_order = {"APLICA": 0, "QUIZÁ": 1, "NO_ENCAJA": 2}
        enriched.sort(key=lambda x: (
            result_order.get(x.get("resultado", "NO_ENCAJA"), 2),
            -(x.get("puntuacion") or 0),
        ))

        skills_gap = None
        try:
            skills_gap = generate_skills_gap(matching_profile, offers, results, api_key, user_id=user.id)
        except Exception:
            pass

        return JSONResponse(
            content={
                "improvement_id": improvement_id,
                "structured_profile": structured_profile,
                "offers": enriched,
                "skills_gap": skills_gap,
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


# ── Edición interactiva del CV mejorado ───────────────────────────────────────

@router.get("/api/cv/improvement/{improvement_id}/edit")
def get_cv_edit(
    improvement_id: int = Path(..., ge=1),
    user=Depends(get_current_user_record),
):
    """
    Devuelve el JSON editable del CV mejorado.
    Prioridad: edit_session → cv_structured_json → source=legacy (sin JSON).
    """
    SessionLocal = get_session_local()
    db = SessionLocal() if SessionLocal is not None else None
    try:
        if not db:
            raise HTTPException(status_code=500, detail="Base de datos no disponible")

        improvement = (
            db.query(CVImprovement)
            .filter(CVImprovement.id == improvement_id, CVImprovement.user_id == user.id)
            .first()
        )
        if not improvement:
            raise HTTPException(status_code=404, detail="CV mejorado no encontrado")

        # ¿Hay sesión de edición guardada?
        edit_session = (
            db.query(CVEditSession)
            .filter(
                CVEditSession.improvement_id == improvement_id,
                CVEditSession.user_id == user.id,
            )
            .order_by(CVEditSession.updated_at.desc())
            .first()
        )

        if edit_session:
            try:
                edited_json = json.loads(edit_session.edited_cv_json)
                action_log = json.loads(edit_session.action_log_json or "[]")
                return JSONResponse(
                    content={
                        "source": "edit_session",
                        "session_id": edit_session.id,
                        "cv_json": edited_json,
                        "action_log": action_log,
                        "updated_at": edit_session.updated_at.isoformat(),
                    },
                    media_type="application/json; charset=utf-8",
                )
            except Exception:
                pass

        # ¿Tiene JSON estructurado de la IA?
        if improvement.cv_structured_json:
            try:
                cv_json = json.loads(improvement.cv_structured_json)
                return JSONResponse(
                    content={
                        "source": "ai_generated",
                        "session_id": None,
                        "cv_json": cv_json,
                        "action_log": [],
                        "updated_at": improvement.created_at.isoformat() if improvement.created_at else None,
                    },
                    media_type="application/json; charset=utf-8",
                )
            except Exception:
                pass

        # Registro legacy sin JSON estructurado
        return JSONResponse(
            content={"source": "legacy", "cv_json": None, "action_log": []},
            media_type="application/json; charset=utf-8",
        )
    finally:
        if db:
            db.close()


@router.put("/api/cv/improvement/{improvement_id}/edit")
def save_cv_edit(
    improvement_id: int = Path(..., ge=1),
    body: Dict[str, Any] = Body(...),
    user=Depends(get_current_user_record),
):
    """
    Upsert de la sesión de edición del CV (crea o actualiza).
    Body: { "edited_cv_json": {...}, "action_log": [...] }
    """
    SessionLocal = get_session_local()
    db = SessionLocal() if SessionLocal is not None else None
    try:
        if not db:
            raise HTTPException(status_code=500, detail="Base de datos no disponible")

        improvement = (
            db.query(CVImprovement)
            .filter(CVImprovement.id == improvement_id, CVImprovement.user_id == user.id)
            .first()
        )
        if not improvement:
            raise HTTPException(status_code=404, detail="CV mejorado no encontrado")

        edited_cv_json = body.get("edited_cv_json")
        action_log = body.get("action_log", [])

        if not edited_cv_json or not isinstance(edited_cv_json, dict):
            raise HTTPException(status_code=422, detail="edited_cv_json debe ser un objeto JSON")

        edited_cv_str = json.dumps(edited_cv_json, ensure_ascii=False)
        action_log_str = json.dumps(action_log if isinstance(action_log, list) else [], ensure_ascii=False)

        # Upsert: busca la sesión más reciente para este usuario+improvement
        existing = (
            db.query(CVEditSession)
            .filter(
                CVEditSession.improvement_id == improvement_id,
                CVEditSession.user_id == user.id,
            )
            .order_by(CVEditSession.updated_at.desc())
            .first()
        )

        now = datetime.utcnow()
        if existing:
            existing.edited_cv_json = edited_cv_str
            existing.action_log_json = action_log_str
            existing.updated_at = now
            session_id = existing.id
        else:
            new_session = CVEditSession(
                user_id=user.id,
                improvement_id=improvement_id,
                edited_cv_json=edited_cv_str,
                action_log_json=action_log_str,
                created_at=now,
                updated_at=now,
            )
            db.add(new_session)
            db.flush()
            session_id = new_session.id

        db.commit()

        return JSONResponse(
            content={"session_id": session_id, "saved": True},
            media_type="application/json; charset=utf-8",
        )
    finally:
        if db:
            db.close()


@router.post("/api/cv/improvement/{improvement_id}/pdf")
def generate_pdf_from_edit(
    improvement_id: int = Path(..., ge=1),
    template: str = Query("professional_modern"),
    user=Depends(get_current_user_record),
):
    """
    Genera PDF desde la sesión de edición (o cv_structured_json si no hay sesión).
    Para uso del botón "Descargar PDF" del editor modal.
    """
    SessionLocal = get_session_local()
    db = SessionLocal() if SessionLocal is not None else None
    try:
        if not db:
            raise HTTPException(status_code=500, detail="Base de datos no disponible")

        improvement = (
            db.query(CVImprovement)
            .filter(CVImprovement.id == improvement_id, CVImprovement.user_id == user.id)
            .first()
        )
        if not improvement:
            raise HTTPException(status_code=404, detail="CV mejorado no encontrado")

        candidate_name = getattr(user, "nombre", "") or getattr(user, "alias", "") or ""

        # Prioridad: edit_session → cv_structured_json → improved_cv_text
        edit_session = (
            db.query(CVEditSession)
            .filter(
                CVEditSession.improvement_id == improvement_id,
                CVEditSession.user_id == user.id,
            )
            .order_by(CVEditSession.updated_at.desc())
            .first()
        )

        pdf_bytes: bytes
        if edit_session:
            try:
                edited_json = json.loads(edit_session.edited_cv_json)
                pdf_bytes = generate_cv_pdf_from_json(edited_json, candidate_name, template)
            except Exception:
                pdf_bytes = generate_cv_pdf(improvement.improved_cv_text, candidate_name)
        elif improvement.cv_structured_json:
            try:
                structured = json.loads(improvement.cv_structured_json)
                pdf_bytes = generate_cv_pdf_from_json(structured, candidate_name, template)
            except Exception:
                pdf_bytes = generate_cv_pdf(improvement.improved_cv_text, candidate_name)
        else:
            pdf_bytes = generate_cv_pdf(improvement.improved_cv_text, candidate_name)

        filename = f"cv_mejorado_{improvement_id}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    finally:
        if db:
            db.close()
