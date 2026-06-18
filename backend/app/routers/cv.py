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
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query, Request, UploadFile, File
from fastapi.responses import JSONResponse, Response

from app.database import get_session_local
from app.models.cv_analysis import CVAnalysis
from app.models.cv_ats_result import CVAtsResult
from app.models.cv_edit_session import CVEditSession
from app.models.cv_improvement import CVImprovement
from app.models.cv_offer_variant import CVOfferVariant
from app.routers.user import get_current_user_record
from app.services.ai_quota_service import consume_ai_quota
from app.services.company_data_service import enrich_items_with_company_data as enrich_items_with_company_logos
from app.services.cv_pdf_service import generate_cv_pdf, generate_cv_pdf_from_json
from app.services.job_search_service import fetch_offers_for_search
from app.services.cv_service import (
    analyze_cv_with_ai,
    build_adzuna_search_params,
    build_edit_context_for_prompt,
    build_matching_profile,
    extract_text_from_pdf,
    hash_cv_text,
    improve_cv_full,
    improve_cv_with_ai,
    optimize_cv_json_for_offer,
    read_and_validate_content,
    validate_cv_upload,
)
from app.services.matching_service import MATCH_ENGINE_VERSION, generate_skills_gap, match_profile_with_offers
from app.services.rate_limit_service import RateLimitRule, enforce_rate_limits
from app.services.security_service import get_client_ip

router = APIRouter()

_ALLOWED_CV_TEMPLATES = {"professional_modern", "ats_minimal"}


def _extract_selected_template(cv_json: Optional[dict]) -> Optional[str]:
    if not isinstance(cv_json, dict):
        return None
    template = ((cv_json.get("meta") or {}).get("selected_template") or "").strip()
    return template if template in _ALLOWED_CV_TEMPLATES else None


def _resolve_cv_template(
    requested_template: Optional[str],
    edited_json: Optional[dict] = None,
    structured_json: Optional[dict] = None,
) -> str:
    if requested_template in _ALLOWED_CV_TEMPLATES:
        return requested_template
    return (
        _extract_selected_template(edited_json)
        or _extract_selected_template(structured_json)
        or "professional_modern"
    )


def _extract_fit_one_page(cv_json: Optional[dict]) -> Optional[bool]:
    if not isinstance(cv_json, dict):
        return None
    value = (cv_json.get("meta") or {}).get("fit_one_page")
    if value is None:
        return None
    return bool(value)


def _resolve_fit_one_page(
    requested_fit_one_page: Optional[bool],
    edited_json: Optional[dict] = None,
    structured_json: Optional[dict] = None,
) -> bool:
    if requested_fit_one_page is not None:
        return bool(requested_fit_one_page)
    return bool(
        _extract_fit_one_page(edited_json)
        or _extract_fit_one_page(structured_json)
    )


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


def _deserialize_json(raw_value: Optional[str], fallback):
    try:
        return json.loads(raw_value or "")
    except Exception:
        return fallback


def _get_cv_improvement_or_404(db, improvement_id: int, user_id: int):
    improvement = (
        db.query(CVImprovement)
        .filter(CVImprovement.id == improvement_id, CVImprovement.user_id == user_id)
        .first()
    )
    if not improvement:
        raise HTTPException(status_code=404, detail="CV mejorado no encontrado")
    return improvement


def _get_latest_edit_session(db, improvement_id: int, user_id: int):
    return (
        db.query(CVEditSession)
        .filter(
            CVEditSession.improvement_id == improvement_id,
            CVEditSession.user_id == user_id,
        )
        .order_by(CVEditSession.updated_at.desc())
        .first()
    )


def _build_offer_snapshot(raw_offer: Optional[dict]) -> dict:
    offer = raw_offer if isinstance(raw_offer, dict) else {}
    snapshot = {
        "adzuna_id": str(offer.get("adzuna_id") or "").strip(),
        "titulo": str(offer.get("titulo") or "").strip(),
        "empresa": str(offer.get("empresa") or "").strip(),
        "ubicacion": str(offer.get("ubicacion") or "").strip(),
        "resultado": str(offer.get("resultado") or "").strip(),
        "url": str(offer.get("url") or offer.get("redirect_url") or "").strip(),
    }
    if offer.get("puntuacion") is not None:
        snapshot["puntuacion"] = offer.get("puntuacion")
    if offer.get("descripcion"):
        snapshot["descripcion"] = str(offer.get("descripcion"))[:1200]
    for list_key in ("skills_match", "strengths", "gaps", "blockers"):
        values = offer.get(list_key)
        if isinstance(values, list) and values:
            snapshot[list_key] = values[:8]
    offer_requirements = offer.get("offer_requirements")
    if isinstance(offer_requirements, dict) and offer_requirements:
        snapshot["offer_requirements"] = offer_requirements
    signals_summary = offer.get("signals_summary")
    if isinstance(signals_summary, dict) and signals_summary:
        snapshot["signals_summary"] = signals_summary
    return {k: v for k, v in snapshot.items() if v not in (None, "", [], {})}


def _build_variant_name(name: Optional[str], offer_snapshot: Optional[dict], fallback_index: int = 1) -> str:
    cleaned = (name or "").strip()
    if cleaned:
        return cleaned[:255]

    offer_snapshot = offer_snapshot or {}
    title = str(offer_snapshot.get("titulo") or "").strip()
    company = str(offer_snapshot.get("empresa") or "").strip()
    if title and company:
        return f"{title} · {company}"[:255]
    if title or company:
        return (title or company)[:255]
    return f"Variante {fallback_index}"


def _serialize_variant_summary(variant: CVOfferVariant, include_offer_snapshot: bool = False) -> dict:
    payload = {
        "id": variant.id,
        "name": variant.name,
        "offer_adzuna_id": variant.offer_adzuna_id,
        "offer_title": variant.offer_title,
        "offer_company": variant.offer_company,
        "offer_url": variant.offer_url,
        "created_at": variant.created_at.isoformat() if variant.created_at else None,
        "updated_at": variant.updated_at.isoformat() if variant.updated_at else None,
    }
    if include_offer_snapshot:
        payload["offer_snapshot"] = _deserialize_json(variant.offer_snapshot_json, {}) or {}
    return payload


def _get_variant_or_404(db, improvement_id: int, user_id: int, variant_id: int) -> CVOfferVariant:
    variant = (
        db.query(CVOfferVariant)
        .filter(
            CVOfferVariant.id == variant_id,
            CVOfferVariant.improvement_id == improvement_id,
            CVOfferVariant.user_id == user_id,
        )
        .first()
    )
    if not variant:
        raise HTTPException(status_code=404, detail="Variante de CV no encontrada")
    return variant


def _load_edit_payload(db, improvement: CVImprovement, user_id: int, variant_id: Optional[int] = None) -> dict:
    if variant_id is not None:
        variant = _get_variant_or_404(db, improvement.id, user_id, variant_id)
        return {
            "kind": "variant",
            "record": variant,
            "cv_json": _deserialize_json(variant.edited_cv_json, None),
            "action_log": _deserialize_json(variant.action_log_json, []),
            "updated_at": variant.updated_at.isoformat() if variant.updated_at else None,
            "variant": _serialize_variant_summary(variant, include_offer_snapshot=True),
        }

    edit_session = _get_latest_edit_session(db, improvement.id, user_id)
    if edit_session:
        edited_json = _deserialize_json(edit_session.edited_cv_json, None)
        if edited_json is not None:
            return {
                "kind": "edit_session",
                "record": edit_session,
                "cv_json": edited_json,
                "action_log": _deserialize_json(edit_session.action_log_json, []),
                "updated_at": edit_session.updated_at.isoformat() if edit_session.updated_at else None,
                "variant": None,
            }

    if improvement.cv_structured_json:
        structured_json = _deserialize_json(improvement.cv_structured_json, None)
        if structured_json is not None:
            return {
                "kind": "ai_generated",
                "record": improvement,
                "cv_json": structured_json,
                "action_log": [],
                "updated_at": improvement.created_at.isoformat() if improvement.created_at else None,
                "variant": None,
            }

    return {
        "kind": "legacy",
        "record": None,
        "cv_json": None,
        "action_log": [],
        "updated_at": None,
        "variant": None,
    }


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

        enforce_rate_limits(db, [
            RateLimitRule(
                action="cv_analyze_user",
                bucket_key=f"user:{user.id}",
                limit=5,
                window_seconds=3600,
                detail="Has analizado demasiados CVs en la última hora. Espera antes de volver a intentarlo.",
            ),
        ])

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
        offers = await fetch_offers_for_search(
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
                -(x.get("ranking_score") or 0),
                -(x.get("puntuacion") or 0),
                len(x.get("blockers") or []),
                -len(x.get("skills_match") or []),
                -(float(x.get("source_confidence") or 0)),
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

        enforce_rate_limits(db, [
            RateLimitRule(
                action="cv_improve_user",
                bucket_key=f"user:{user.id}",
                limit=5,
                window_seconds=3600,
                detail="Has realizado demasiadas mejoras de CV en la última hora. Espera antes de volver a intentarlo.",
            ),
        ])

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

        enforce_rate_limits(db, [
            RateLimitRule(
                action="cv_improve_full_user",
                bucket_key=f"user:{user.id}",
                limit=3,
                window_seconds=3600,
                detail="Has realizado demasiadas mejoras completas de CV en la última hora. Espera antes de volver a intentarlo.",
            ),
        ])

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
    template: Optional[str] = Query(None),
    fit_one_page: Optional[bool] = Query(None),
    variant_id: Optional[int] = Query(None, ge=1),
    user=Depends(get_current_user_record),
):
    """Genera y devuelve el PDF del CV mejorado."""
    SessionLocal = get_session_local()
    db = SessionLocal() if SessionLocal is not None else None
    try:
        if not db:
            raise HTTPException(status_code=500, detail="Base de datos no disponible")

        record = _get_cv_improvement_or_404(db, improvement_id, user.id)

        candidate_name = getattr(user, "nombre", "") or getattr(user, "alias", "") or ""

        pdf_bytes: bytes
        edit_payload = _load_edit_payload(db, record, user.id, variant_id=variant_id)
        cv_json = edit_payload.get("cv_json")
        if cv_json:
            try:
                structured_json = cv_json if edit_payload.get("kind") == "ai_generated" else None
                edited_json = cv_json if edit_payload.get("kind") != "ai_generated" else None
                resolved_template = _resolve_cv_template(
                    template,
                    edited_json=edited_json,
                    structured_json=structured_json,
                )
                resolved_fit_one_page = _resolve_fit_one_page(
                    fit_one_page,
                    edited_json=edited_json,
                    structured_json=structured_json,
                )
                pdf_bytes = generate_cv_pdf_from_json(
                    cv_json,
                    candidate_name,
                    resolved_template,
                    resolved_fit_one_page,
                )
            except Exception:
                pdf_bytes = generate_cv_pdf(record.improved_cv_text, candidate_name)
        else:
            pdf_bytes = generate_cv_pdf(record.improved_cv_text, candidate_name)

        filename = (
            f"cv_mejorado_{improvement_id}_variante_{variant_id}.pdf"
            if variant_id is not None
            else f"cv_mejorado_{improvement_id}.pdf"
        )
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

        improvement_ids = [record.id for record in records]
        variants_by_improvement: dict[int, list[dict]] = {improvement_id: [] for improvement_id in improvement_ids}
        if improvement_ids:
            variant_rows = (
                db.query(CVOfferVariant)
                .filter(
                    CVOfferVariant.user_id == user.id,
                    CVOfferVariant.improvement_id.in_(improvement_ids),
                )
                .order_by(CVOfferVariant.updated_at.desc())
                .all()
            )
            for variant in variant_rows:
                variants_by_improvement.setdefault(variant.improvement_id, []).append(
                    _serialize_variant_summary(variant)
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
                "variant_count": len(variants_by_improvement.get(r.id, [])),
                "variants": variants_by_improvement.get(r.id, []),
            })

        return JSONResponse(
            content={"improvements": items},
            media_type="application/json; charset=utf-8",
        )
    finally:
        if db:
            db.close()


@router.get("/api/cv/improvement/{improvement_id}/variants")
def list_cv_variants(
    improvement_id: int = Path(..., ge=1),
    user=Depends(get_current_user_record),
):
    SessionLocal = get_session_local()
    db = SessionLocal() if SessionLocal is not None else None
    try:
        if not db:
            raise HTTPException(status_code=500, detail="Base de datos no disponible")

        _get_cv_improvement_or_404(db, improvement_id, user.id)
        variants = (
            db.query(CVOfferVariant)
            .filter(
                CVOfferVariant.improvement_id == improvement_id,
                CVOfferVariant.user_id == user.id,
            )
            .order_by(CVOfferVariant.updated_at.desc())
            .all()
        )
        return JSONResponse(
            content={"variants": [_serialize_variant_summary(variant) for variant in variants]},
            media_type="application/json; charset=utf-8",
        )
    finally:
        if db:
            db.close()


@router.post("/api/cv/improvement/{improvement_id}/variants")
def create_cv_variant(
    improvement_id: int = Path(..., ge=1),
    body: Dict[str, Any] = Body(default={}),
    user=Depends(get_current_user_record),
):
    SessionLocal = get_session_local()
    db = SessionLocal() if SessionLocal is not None else None
    try:
        if not db:
            raise HTTPException(status_code=500, detail="Base de datos no disponible")

        improvement = _get_cv_improvement_or_404(db, improvement_id, user.id)
        base_payload = _load_edit_payload(db, improvement, user.id)
        base_cv_json = base_payload.get("cv_json")
        if not isinstance(base_cv_json, dict):
            raise HTTPException(status_code=422, detail="Este CV no tiene una versión editable para crear variantes")

        offer_snapshot = _build_offer_snapshot(body.get("offer"))
        existing_count = (
            db.query(CVOfferVariant)
            .filter(
                CVOfferVariant.improvement_id == improvement_id,
                CVOfferVariant.user_id == user.id,
            )
            .count()
        )
        variant_name = _build_variant_name(body.get("name"), offer_snapshot, fallback_index=existing_count + 1)

        existing_variant = None
        offer_adzuna_id = str(offer_snapshot.get("adzuna_id") or "").strip()
        if offer_adzuna_id:
            existing_variant = (
                db.query(CVOfferVariant)
                .filter(
                    CVOfferVariant.improvement_id == improvement_id,
                    CVOfferVariant.user_id == user.id,
                    CVOfferVariant.offer_adzuna_id == offer_adzuna_id,
                )
                .order_by(CVOfferVariant.updated_at.desc())
                .first()
            )

        if existing_variant:
            if body.get("name"):
                existing_variant.name = variant_name
            if offer_snapshot:
                existing_variant.offer_title = offer_snapshot.get("titulo") or existing_variant.offer_title
                existing_variant.offer_company = offer_snapshot.get("empresa") or existing_variant.offer_company
                existing_variant.offer_url = offer_snapshot.get("url") or existing_variant.offer_url
                existing_variant.offer_snapshot_json = json.dumps(offer_snapshot, ensure_ascii=False)
            db.commit()
            db.refresh(existing_variant)
            return JSONResponse(
                content={
                    "created": False,
                    "variant": _serialize_variant_summary(existing_variant, include_offer_snapshot=True),
                    "cv_json": _deserialize_json(existing_variant.edited_cv_json, None),
                    "action_log": _deserialize_json(existing_variant.action_log_json, []),
                },
                media_type="application/json; charset=utf-8",
            )

        variant_cv_json = json.loads(json.dumps(base_cv_json, ensure_ascii=False))
        meta = dict(variant_cv_json.get("meta") or {})
        meta["variant_name"] = variant_name
        if offer_snapshot:
            meta["target_offer"] = offer_snapshot
        variant_cv_json["meta"] = meta

        now = datetime.utcnow()
        initial_action_log = [
            {
                "type": "variant_created",
                "name": variant_name,
                "offer_adzuna_id": offer_adzuna_id or None,
                "ts": int(now.timestamp() * 1000),
            }
        ]
        variant = CVOfferVariant(
            user_id=user.id,
            improvement_id=improvement_id,
            name=variant_name,
            offer_adzuna_id=offer_adzuna_id or None,
            offer_title=offer_snapshot.get("titulo") or None,
            offer_company=offer_snapshot.get("empresa") or None,
            offer_url=offer_snapshot.get("url") or None,
            offer_snapshot_json=json.dumps(offer_snapshot, ensure_ascii=False) if offer_snapshot else None,
            edited_cv_json=json.dumps(variant_cv_json, ensure_ascii=False),
            action_log_json=json.dumps(initial_action_log, ensure_ascii=False),
            created_at=now,
            updated_at=now,
        )
        db.add(variant)
        db.commit()
        db.refresh(variant)

        return JSONResponse(
            content={
                "created": True,
                "variant": _serialize_variant_summary(variant, include_offer_snapshot=True),
                "cv_json": variant_cv_json,
                "action_log": initial_action_log,
            },
            media_type="application/json; charset=utf-8",
        )
    finally:
        if db:
            db.close()


@router.post("/api/cv/improvement/{improvement_id}/optimize-for-offer")
async def optimize_cv_for_offer(
    improvement_id: int = Path(..., ge=1),
    variant_id: int = Query(..., ge=1),
    user=Depends(get_current_user_record),
):
    api_key = os.getenv("CLAUDE_API_KEY")
    if not api_key:
        return JSONResponse(
            status_code=500,
            content={"detail": "CLAUDE_API_KEY no configurada"},
            media_type="application/json; charset=utf-8",
        )

    SessionLocal = get_session_local()
    db = SessionLocal() if SessionLocal is not None else None
    try:
        if not db:
            raise HTTPException(status_code=500, detail="Base de datos no disponible")

        _get_cv_improvement_or_404(db, improvement_id, user.id)
        variant = _get_variant_or_404(db, improvement_id, user.id, variant_id)
        offer_snapshot = _deserialize_json(variant.offer_snapshot_json, {}) or {}
        if not offer_snapshot:
            raise HTTPException(status_code=422, detail="Esta variante no tiene una oferta objetivo asociada")

        current_cv_json = _deserialize_json(variant.edited_cv_json, None)
        if not isinstance(current_cv_json, dict):
            raise HTTPException(status_code=422, detail="Esta variante no tiene un CV editable valido")

        quota = consume_ai_quota(db, user, "cv_improve")
        optimized_result, _usage = await optimize_cv_json_for_offer(
            current_cv_json,
            offer_snapshot,
            api_key,
            user_id=user.id,
        )

        optimized_cv_json = optimized_result.get("cv_structured_json") or current_cv_json
        action_log = _deserialize_json(variant.action_log_json, []) or []
        action_log.append({
            "type": "offer_optimize_ai",
            "offer_title": offer_snapshot.get("titulo") or variant.offer_title,
            "changes_applied": (optimized_result.get("changes_applied") or [])[:5],
            "ts": int(datetime.utcnow().timestamp() * 1000),
        })

        variant.edited_cv_json = json.dumps(optimized_cv_json, ensure_ascii=False)
        variant.action_log_json = json.dumps(action_log, ensure_ascii=False)
        variant.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(variant)

        return JSONResponse(
            content={
                "optimized": True,
                "quota": quota,
                "focus_summary": optimized_result.get("focus_summary") or "",
                "changes_applied": optimized_result.get("changes_applied") or [],
                "variant": _serialize_variant_summary(variant, include_offer_snapshot=True),
                "cv_json": optimized_cv_json,
                "action_log": action_log,
            },
            media_type="application/json; charset=utf-8",
        )
    finally:
        if db:
            db.close()


@router.delete("/api/cv/improvement/{improvement_id}/variants/{variant_id}")
def delete_cv_variant(
    improvement_id: int = Path(..., ge=1),
    variant_id: int = Path(..., ge=1),
    user=Depends(get_current_user_record),
):
    SessionLocal = get_session_local()
    db = SessionLocal() if SessionLocal is not None else None
    try:
        if not db:
            raise HTTPException(status_code=500, detail="Base de datos no disponible")

        _get_cv_improvement_or_404(db, improvement_id, user.id)
        variant = _get_variant_or_404(db, improvement_id, user.id, variant_id)
        db.delete(variant)
        db.commit()
        return JSONResponse(
            content={"deleted": True, "variant_id": variant_id},
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

        offers = await fetch_offers_for_search(
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
            -(x.get("ranking_score") or 0),
            -(x.get("puntuacion") or 0),
            -(float(x.get("source_confidence") or 0)),
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
    variant_id: Optional[int] = Query(None, ge=1),
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

        improvement = _get_cv_improvement_or_404(db, improvement_id, user.id)
        payload = _load_edit_payload(db, improvement, user.id, variant_id=variant_id)
        if payload.get("kind") == "legacy":
            return JSONResponse(
                content={
                    "source": "legacy",
                    "variant_id": variant_id,
                    "variant": payload.get("variant"),
                    "cv_json": None,
                    "action_log": [],
                },
                media_type="application/json; charset=utf-8",
            )

        return JSONResponse(
            content={
                "source": payload.get("kind"),
                "session_id": payload.get("record").id if payload.get("kind") == "edit_session" else None,
                "variant_id": payload.get("record").id if payload.get("kind") == "variant" else None,
                "variant": payload.get("variant"),
                "cv_json": payload.get("cv_json"),
                "action_log": payload.get("action_log"),
                "updated_at": payload.get("updated_at"),
            },
            media_type="application/json; charset=utf-8",
        )
    finally:
        if db:
            db.close()


@router.put("/api/cv/improvement/{improvement_id}/edit")
def save_cv_edit(
    improvement_id: int = Path(..., ge=1),
    body: Dict[str, Any] = Body(...),
    variant_id: Optional[int] = Query(None, ge=1),
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

        _get_cv_improvement_or_404(db, improvement_id, user.id)

        edited_cv_json = body.get("edited_cv_json")
        action_log = body.get("action_log", [])

        if not edited_cv_json or not isinstance(edited_cv_json, dict):
            raise HTTPException(status_code=422, detail="edited_cv_json debe ser un objeto JSON")

        edited_cv_str = json.dumps(edited_cv_json, ensure_ascii=False)
        action_log_str = json.dumps(action_log if isinstance(action_log, list) else [], ensure_ascii=False)
        now = datetime.utcnow()

        if variant_id is not None:
            variant = _get_variant_or_404(db, improvement_id, user.id, variant_id)
            variant.edited_cv_json = edited_cv_str
            variant.action_log_json = action_log_str
            variant.name = _build_variant_name(
                ((edited_cv_json.get("meta") or {}).get("variant_name") or variant.name),
                _deserialize_json(variant.offer_snapshot_json, {}),
            )
            variant.updated_at = now
            db.commit()
            return JSONResponse(
                content={"session_id": None, "variant_id": variant.id, "saved": True},
                media_type="application/json; charset=utf-8",
            )

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
            content={"session_id": session_id, "variant_id": None, "saved": True},
            media_type="application/json; charset=utf-8",
        )
    finally:
        if db:
            db.close()


@router.post("/api/cv/improvement/{improvement_id}/pdf")
def generate_pdf_from_edit(
    improvement_id: int = Path(..., ge=1),
    template: Optional[str] = Query(None),
    fit_one_page: Optional[bool] = Query(None),
    variant_id: Optional[int] = Query(None, ge=1),
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

        improvement = _get_cv_improvement_or_404(db, improvement_id, user.id)

        candidate_name = getattr(user, "nombre", "") or getattr(user, "alias", "") or ""

        pdf_bytes: bytes
        edit_payload = _load_edit_payload(db, improvement, user.id, variant_id=variant_id)
        cv_json = edit_payload.get("cv_json")
        if cv_json:
            try:
                structured_json = cv_json if edit_payload.get("kind") == "ai_generated" else None
                edited_json = cv_json if edit_payload.get("kind") != "ai_generated" else None
                resolved_template = _resolve_cv_template(
                    template,
                    edited_json=edited_json,
                    structured_json=structured_json,
                )
                resolved_fit_one_page = _resolve_fit_one_page(
                    fit_one_page,
                    edited_json=edited_json,
                    structured_json=structured_json,
                )
                pdf_bytes = generate_cv_pdf_from_json(
                    cv_json,
                    candidate_name,
                    resolved_template,
                    resolved_fit_one_page,
                )
            except Exception:
                pdf_bytes = generate_cv_pdf(improvement.improved_cv_text, candidate_name)
        else:
            pdf_bytes = generate_cv_pdf(improvement.improved_cv_text, candidate_name)

        filename = (
            f"cv_mejorado_{improvement_id}_variante_{variant_id}.pdf"
            if variant_id is not None
            else f"cv_mejorado_{improvement_id}.pdf"
        )
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    finally:
        if db:
            db.close()
