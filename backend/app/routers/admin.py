# -*- coding: utf-8 -*-
"""Router del panel de administración: métricas globales, gestión de usuarios y cuotas, costes de IA y control del índice de ofertas."""
import csv
import io
import os
from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import and_, case, func, inspect, literal, text
from sqlalchemy.orm import aliased

from app.database import get_session_local
from app.models.ai_daily_usage import AIDailyUsage
from app.models.ai_api_cost_event import AIAPICostEvent
from app.models.application import Application
from app.models.cache import SearchCache
from app.models.favorite import Favorite
from app.models.job_ingestion_run import JobIngestionRun
from app.models.job_offer import JobOffer
from app.models.rate_limit_bucket import RateLimitBucket
from app.models.search_history import SearchHistory
from app.models.user import User
from app.models.match_feedback import MatchFeedback
from app.routers.user import require_admin_user
from app.services.job_ingestion_service import (
    create_ingestion_run,
    has_running_ingestion,
    list_ingestion_runs,
    prepare_ingestion_payload,
    run_ingestion_task,
)
from app.services.official_sources_service import get_public_source_configuration_status

router = APIRouter()
ADMIN_DELETE_CONFIRMATION_CODE = os.getenv("ADMIN_DELETE_CONFIRMATION_CODE", "715345")
AI_COST_BASELINE_SPENT_USD = float(os.getenv("AI_COST_BASELINE_SPENT_USD", "0.96"))
AI_COST_BASELINE_REMAINING_USD = float(os.getenv("AI_COST_BASELINE_REMAINING_USD", "4.03"))

USER_SORT_FIELDS = {
    "created_at": User.created_at,
    "email": User.email,
    "email_verified": User.email_verified,
    "is_admin": User.is_admin,
    "is_blocked": User.is_blocked,
}


class UpdateQuotaRequest(BaseModel):
    daily_ai_quota: int = Field(..., ge=1, le=200)


class UpdateBlockRequest(BaseModel):
    is_blocked: bool


class ResetQuotaUsageRequest(BaseModel):
    confirm: bool = True


class DeleteAdminUserRequest(BaseModel):
    confirmation_code: str = Field(..., min_length=1, max_length=32)


class StartJobIngestionRequest(BaseModel):
    sources: list[str] | None = None
    skills: list[str] | None = None
    locations: list[str] | None = None


def _today_range():
    start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    return start, end


def _round_money(value: float | int | None) -> float:
    return round(float(value or 0), 4)


def _day_bounds(day):
    start = datetime.combine(day, datetime.min.time())
    end = start + timedelta(days=1)
    return start, end


def _empty_cost_estimate() -> dict:
    return {
        "baseline_spent_usd": _round_money(AI_COST_BASELINE_SPENT_USD),
        "baseline_remaining_usd": _round_money(AI_COST_BASELINE_REMAINING_USD),
        "estimated_spent_since_tracking_usd": 0.0,
        "estimated_spent_today_usd": 0.0,
        "combined_spent_usd": _round_money(AI_COST_BASELINE_SPENT_USD),
        "estimated_remaining_usd": _round_money(
            max((AI_COST_BASELINE_SPENT_USD + AI_COST_BASELINE_REMAINING_USD) - AI_COST_BASELINE_SPENT_USD, 0.0)
        ) if (AI_COST_BASELINE_SPENT_USD + AI_COST_BASELINE_REMAINING_USD) > 0 else None,
        "feature_breakdown": [],
        "daily_breakdown": [],
        "model_breakdown": [],
        "recent_events": [],
        "tracking_ready": False,
    }


@router.get("/api/admin/dashboard")
def get_admin_dashboard(_: User = Depends(require_admin_user)):
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(status_code=500, content={"detail": "Base de datos no disponible"})

    db = SessionLocal()
    try:
        day_start, day_end = _today_range()
        today = day_start.date()

        total_users = db.query(func.count(User.id)).scalar() or 0
        verified_users = db.query(func.count(User.id)).filter(User.email_verified.is_(True)).scalar() or 0
        users_today = (
            db.query(func.count(User.id))
            .filter(User.created_at >= day_start, User.created_at < day_end)
            .scalar()
            or 0
        )

        usage_totals = db.query(
            func.coalesce(func.sum(AIDailyUsage.match_count), 0),
            func.coalesce(func.sum(AIDailyUsage.cover_letter_count), 0),
        ).one()
        usage_today = db.query(
            func.coalesce(func.sum(AIDailyUsage.match_count), 0),
            func.coalesce(func.sum(AIDailyUsage.cover_letter_count), 0),
        ).filter(AIDailyUsage.usage_date == today).one()

        return JSONResponse(content={
            "total_users": int(total_users),
            "verified_users": int(verified_users),
            "users_registered_today": int(users_today),
            "total_analyses": int(usage_totals[0] or 0),
            "analyses_today": int(usage_today[0] or 0),
            "total_cover_letters": int(usage_totals[1] or 0),
            "cover_letters_today": int(usage_today[1] or 0),
        })
    finally:
        db.close()


@router.get("/api/admin/users")
def get_admin_users(
    _: User = Depends(require_admin_user),
    page: int = Query(1, ge=1, le=100000),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, max_length=120),
    sort_by: str = Query("created_at"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
):
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(status_code=500, content={"detail": "Base de datos no disponible"})

    db = SessionLocal()
    try:
        today = datetime.utcnow().date()
        usage_today = aliased(AIDailyUsage)

        base_query = db.query(
            User.id,
            User.email,
            User.is_admin,
            User.is_blocked,
            User.email_verified,
            User.created_at,
            User.daily_ai_quota,
            func.coalesce(usage_today.total_units, 0).label("quota_used_today"),
        ).outerjoin(
            usage_today,
            and_(usage_today.user_id == User.id, usage_today.usage_date == today),
        )

        if search:
            term = f"%{search.strip().lower()}%"
            base_query = base_query.filter(func.lower(User.email).like(term))

        if sort_by == "quota_used_today":
            sort_column = func.coalesce(usage_today.total_units, 0)
        else:
            sort_column = USER_SORT_FIELDS.get(sort_by, User.created_at)

        if sort_dir == "asc":
            ordered_query = base_query.order_by(sort_column.asc(), User.id.asc())
        else:
            ordered_query = base_query.order_by(sort_column.desc(), User.id.desc())

        total = ordered_query.order_by(None).count()
        rows = ordered_query.offset((page - 1) * limit).limit(limit).all()

        items = [{
            "id": row.id,
            "email": row.email,
            "is_admin": bool(row.is_admin),
            "is_blocked": bool(row.is_blocked),
            "email_verified": bool(row.email_verified),
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "quota_used_today": int(row.quota_used_today or 0),
            "daily_ai_quota": int(row.daily_ai_quota or 0),
        } for row in rows]

        return JSONResponse(content={
            "items": items,
            "page": page,
            "limit": limit,
            "total": total,
            "sort_by": sort_by if sort_by in {*USER_SORT_FIELDS.keys(), "quota_used_today"} else "created_at",
            "sort_dir": sort_dir,
        })
    finally:
        db.close()


@router.patch("/api/admin/users/{user_id}/quota")
def update_admin_user_quota(
    user_id: int,
    body: UpdateQuotaRequest,
    admin_user: User = Depends(require_admin_user),
):
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(status_code=500, content={"detail": "Base de datos no disponible"})

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        user.daily_ai_quota = body.daily_ai_quota
        db.commit()
        return JSONResponse(content={
            "detail": "Cuota diaria actualizada",
            "user_id": user.id,
            "daily_ai_quota": int(user.daily_ai_quota or 0),
            "updated_by": admin_user.email,
        })
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@router.patch("/api/admin/users/{user_id}/block")
def update_admin_user_block(
    user_id: int,
    body: UpdateBlockRequest,
    admin_user: User = Depends(require_admin_user),
):
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(status_code=500, content={"detail": "Base de datos no disponible"})

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        if user.id == admin_user.id and body.is_blocked:
            raise HTTPException(status_code=400, detail="No puedes bloquear tu propia cuenta de administrador")

        user.is_blocked = body.is_blocked
        user.blocked_at = datetime.utcnow() if body.is_blocked else None
        db.commit()

        return JSONResponse(content={
            "detail": "Estado de bloqueo actualizado",
            "user_id": user.id,
            "is_blocked": bool(user.is_blocked),
            "blocked_at": user.blocked_at.isoformat() if user.blocked_at else None,
            "updated_by": admin_user.email,
        })
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@router.post("/api/admin/users/{user_id}/quota/reset")
def reset_admin_user_quota_usage(
    user_id: int,
    body: ResetQuotaUsageRequest,
    admin_user: User = Depends(require_admin_user),
):
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(status_code=500, content={"detail": "Base de datos no disponible"})

    if not body.confirm:
        raise HTTPException(status_code=400, detail="Se requiere confirmacion explicita para resetear la cuota")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        today = datetime.utcnow().date()
        usage_row = db.query(AIDailyUsage).filter(
            AIDailyUsage.user_id == user.id,
            AIDailyUsage.usage_date == today,
        ).first()

        if usage_row:
            usage_row.match_count = 0
            usage_row.cover_letter_count = 0
            usage_row.total_units = 0
            usage_row.updated_at = datetime.utcnow()
        db.commit()

        return JSONResponse(content={
            "detail": "Uso diario reseteado correctamente",
            "user_id": user.id,
            "used_today": 0,
            "daily_ai_quota": int(user.daily_ai_quota or 0),
            "updated_by": admin_user.email,
        })
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@router.delete("/api/admin/users/{user_id}")
def delete_admin_user(
    user_id: int,
    body: DeleteAdminUserRequest,
    admin_user: User = Depends(require_admin_user),
):
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(status_code=500, content={"detail": "Base de datos no disponible"})

    if body.confirmation_code.strip() != ADMIN_DELETE_CONFIRMATION_CODE:
        raise HTTPException(status_code=403, detail="Clave de confirmacion incorrecta")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        if user.id == admin_user.id:
            raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta de administrador")

        # Limpia TODAS las tablas con FK a users.id antes de borrar al usuario.
        # Si se omite alguna, el DELETE final revienta por foreign key, hace
        # rollback y el usuario queda sin borrar (no podría re-registrarse).
        # Orden: primero las tablas que dependen de otras tablas hijas.
        child_tables = [
            "cv_offer_variants",
            "cv_edit_sessions",
            "cv_ats_results",
            "cv_analyses",
            "cv_improvements",
            "interview_sessions",
            "match_feedback",
            "agent_runs",
            "favoritos",
            "historial_busquedas",
            "ai_daily_usage",
            "email_verification_tokens",
            "applications",
            "notifications",
        ]
        for table_name in child_tables:
            db.execute(text(f"DELETE FROM {table_name} WHERE user_id = :uid"), {"uid": user.id})
        # job_ingestion_runs guarda histórico de ingestas: desvincula en vez de borrar.
        db.execute(
            text("UPDATE job_ingestion_runs SET triggered_by_user_id = NULL WHERE triggered_by_user_id = :uid"),
            {"uid": user.id},
        )
        db.query(RateLimitBucket).filter(RateLimitBucket.bucket_key == f"email:{user.email}").delete(synchronize_session=False)
        db.delete(user)
        db.commit()

        return JSONResponse(content={
            "detail": "Usuario eliminado correctamente",
            "user_id": user_id,
            "deleted_email": user.email,
            "deleted_by": admin_user.email,
        })
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@router.get("/api/admin/activity")
def get_admin_activity(
    _: User = Depends(require_admin_user),
    limit: int = Query(20, ge=1, le=100),
):
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(status_code=500, content={"detail": "Base de datos no disponible"})

    db = SessionLocal()
    try:
        search_rows = db.query(
            SearchHistory.created_at.label("created_at"),
            User.email.label("email"),
            SearchHistory.stack.label("stack"),
            SearchHistory.num_aplica.label("num_aplica"),
            SearchHistory.num_quiza.label("num_quiza"),
            SearchHistory.num_no_encaja.label("num_no_encaja"),
        ).join(User, User.id == SearchHistory.user_id).order_by(SearchHistory.created_at.desc()).limit(limit).all()

        application_rows = db.query(
            Application.created_at.label("created_at"),
            User.email.label("email"),
            Application.empresa.label("empresa"),
            Application.titulo.label("titulo"),
            Application.status.label("status"),
        ).join(User, User.id == Application.user_id).order_by(Application.created_at.desc()).limit(limit).all()

        user_rows = db.query(
            User.created_at.label("created_at"),
            User.email.label("email"),
            User.email_verified.label("email_verified"),
        ).order_by(User.created_at.desc()).limit(limit).all()

        events = []
        for row in search_rows:
            total_results = int((row.num_aplica or 0) + (row.num_quiza or 0) + (row.num_no_encaja or 0))
            events.append({
                "type": "analysis",
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "email": row.email,
                "summary": f"Analisis ejecutado con {total_results} resultados",
                "meta": {
                    "stack": row.stack,
                    "results": total_results,
                },
            })

        for row in application_rows:
            events.append({
                "type": "application",
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "email": row.email,
                "summary": f"Candidatura {row.status} en {row.empresa or 'empresa desconocida'}",
                "meta": {
                    "titulo": row.titulo,
                    "empresa": row.empresa,
                    "status": row.status,
                },
            })

        for row in user_rows:
            events.append({
                "type": "user",
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "email": row.email,
                "summary": "Nuevo usuario registrado",
                "meta": {
                    "email_verified": bool(row.email_verified),
                },
            })

        events.sort(key=lambda item: item["created_at"] or "", reverse=True)
        return JSONResponse(content={
            "items": events[:limit],
            "errors": [],
        })
    finally:
        db.close()


@router.get("/api/admin/ai-usage")
def get_admin_ai_usage(_: User = Depends(require_admin_user)):
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(status_code=500, content={"detail": "Base de datos no disponible"})

    db = SessionLocal()
    try:
        today = datetime.utcnow().date()
        cost_estimate = _empty_cost_estimate()

        totals = db.query(
            func.coalesce(func.sum(AIDailyUsage.total_units), 0).label("total_units"),
            func.coalesce(func.sum(AIDailyUsage.match_count), 0).label("total_matches"),
            func.coalesce(func.sum(AIDailyUsage.cover_letter_count), 0).label("total_cover_letters"),
        ).one()

        totals_today = db.query(
            func.coalesce(func.sum(AIDailyUsage.total_units), 0).label("today_units"),
            func.coalesce(func.sum(AIDailyUsage.match_count), 0).label("today_matches"),
            func.coalesce(func.sum(AIDailyUsage.cover_letter_count), 0).label("today_cover_letters"),
        ).filter(AIDailyUsage.usage_date == today).one()

        usage_per_user = db.query(
            AIDailyUsage.user_id.label("user_id"),
            func.coalesce(func.sum(AIDailyUsage.total_units), 0).label("total_units"),
            func.coalesce(func.sum(AIDailyUsage.match_count), 0).label("match_count"),
            func.coalesce(func.sum(AIDailyUsage.cover_letter_count), 0).label("cover_letter_count"),
        ).group_by(
            AIDailyUsage.user_id
        ).subquery()

        has_cost_table = False
        try:
            has_cost_table = inspect(db.bind).has_table("ai_api_cost_events")
        except Exception:
            has_cost_table = False

        if has_cost_table:
            cost_per_user = db.query(
                AIAPICostEvent.user_id.label("user_id"),
                func.coalesce(func.sum(AIAPICostEvent.estimated_cost_usd), 0.0).label("estimated_cost_usd"),
            ).group_by(
                AIAPICostEvent.user_id
            ).subquery()

            top_users = db.query(
                User.email,
                func.coalesce(usage_per_user.c.total_units, 0).label("total_units"),
                func.coalesce(usage_per_user.c.match_count, 0).label("match_count"),
                func.coalesce(usage_per_user.c.cover_letter_count, 0).label("cover_letter_count"),
                func.coalesce(cost_per_user.c.estimated_cost_usd, 0.0).label("estimated_cost_usd"),
            ).outerjoin(
                usage_per_user, usage_per_user.c.user_id == User.id
            ).outerjoin(
                cost_per_user, cost_per_user.c.user_id == User.id
            ).filter(
                (usage_per_user.c.user_id.isnot(None)) | (cost_per_user.c.user_id.isnot(None))
            ).order_by(
                func.coalesce(cost_per_user.c.estimated_cost_usd, 0.0).desc(),
                func.coalesce(usage_per_user.c.total_units, 0).desc(),
                User.email.asc()
            ).limit(10).all()

            total_estimated_cost = db.query(
                func.coalesce(func.sum(AIAPICostEvent.estimated_cost_usd), 0.0)
            ).scalar() or 0.0
            today_estimated_cost = db.query(
                func.coalesce(func.sum(AIAPICostEvent.estimated_cost_usd), 0.0)
            ).filter(
                AIAPICostEvent.created_at >= datetime.combine(today, datetime.min.time()),
                AIAPICostEvent.created_at < datetime.combine(today + timedelta(days=1), datetime.min.time()),
            ).scalar() or 0.0

            by_feature = db.query(
                AIAPICostEvent.feature,
                func.count(AIAPICostEvent.id).label("requests"),
                func.coalesce(func.sum(AIAPICostEvent.estimated_cost_usd), 0.0).label("estimated_cost_usd"),
            ).group_by(
                AIAPICostEvent.feature
            ).order_by(
                func.coalesce(func.sum(AIAPICostEvent.estimated_cost_usd), 0.0).desc(),
                AIAPICostEvent.feature.asc(),
            ).all()

            daily_rows = []
            for offset in range(6, -1, -1):
                day = today - timedelta(days=offset)
                day_start, day_end = _day_bounds(day)
                usage_row = db.query(
                    func.coalesce(func.sum(AIDailyUsage.total_units), 0).label("units"),
                    func.coalesce(func.sum(AIDailyUsage.match_count), 0).label("analyses"),
                    func.coalesce(func.sum(AIDailyUsage.cover_letter_count), 0).label("cover_letters"),
                ).filter(
                    AIDailyUsage.usage_date == day
                ).one()
                cost_value = db.query(
                    func.coalesce(func.sum(AIAPICostEvent.estimated_cost_usd), 0.0)
                ).filter(
                    AIAPICostEvent.created_at >= day_start,
                    AIAPICostEvent.created_at < day_end,
                ).scalar() or 0.0
                daily_rows.append({
                    "date": day.isoformat(),
                    "units": int(usage_row.units or 0),
                    "analyses": int(usage_row.analyses or 0),
                    "cover_letters": int(usage_row.cover_letters or 0),
                    "estimated_cost_usd": _round_money(cost_value),
                })

            model_breakdown = db.query(
                AIAPICostEvent.model,
                func.count(AIAPICostEvent.id).label("requests"),
                func.coalesce(func.sum(AIAPICostEvent.input_tokens), 0).label("input_tokens"),
                func.coalesce(func.sum(AIAPICostEvent.output_tokens), 0).label("output_tokens"),
                func.coalesce(func.sum(AIAPICostEvent.estimated_cost_usd), 0.0).label("estimated_cost_usd"),
            ).group_by(
                AIAPICostEvent.model
            ).order_by(
                func.coalesce(func.sum(AIAPICostEvent.estimated_cost_usd), 0.0).desc(),
                AIAPICostEvent.model.asc(),
            ).all()

            recent_events = db.query(
                AIAPICostEvent.created_at,
                AIAPICostEvent.feature,
                AIAPICostEvent.model,
                AIAPICostEvent.input_tokens,
                AIAPICostEvent.output_tokens,
                AIAPICostEvent.estimated_cost_usd,
                User.email.label("email"),
            ).outerjoin(
                User, User.id == AIAPICostEvent.user_id
            ).order_by(
                AIAPICostEvent.created_at.desc()
            ).limit(12).all()

            combined_spent = AI_COST_BASELINE_SPENT_USD + float(total_estimated_cost or 0.0)
            total_budget_reference = AI_COST_BASELINE_SPENT_USD + AI_COST_BASELINE_REMAINING_USD
            estimated_remaining = (
                max(total_budget_reference - combined_spent, 0.0)
                if total_budget_reference > 0
                else None
            )
            cost_estimate = {
                "baseline_spent_usd": _round_money(AI_COST_BASELINE_SPENT_USD),
                "baseline_remaining_usd": _round_money(AI_COST_BASELINE_REMAINING_USD),
                "estimated_spent_since_tracking_usd": _round_money(total_estimated_cost),
                "estimated_spent_today_usd": _round_money(today_estimated_cost),
                "combined_spent_usd": _round_money(combined_spent),
                "estimated_remaining_usd": _round_money(estimated_remaining) if estimated_remaining is not None else None,
                "feature_breakdown": [{
                    "feature": row.feature,
                    "requests": int(row.requests or 0),
                    "estimated_cost_usd": _round_money(row.estimated_cost_usd),
                } for row in by_feature],
                "daily_breakdown": daily_rows,
                "model_breakdown": [{
                    "model": row.model,
                    "requests": int(row.requests or 0),
                    "input_tokens": int(row.input_tokens or 0),
                    "output_tokens": int(row.output_tokens or 0),
                    "estimated_cost_usd": _round_money(row.estimated_cost_usd),
                } for row in model_breakdown],
                "recent_events": [{
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                    "feature": row.feature,
                    "model": row.model,
                    "email": row.email,
                    "input_tokens": int(row.input_tokens or 0),
                    "output_tokens": int(row.output_tokens or 0),
                    "estimated_cost_usd": _round_money(row.estimated_cost_usd),
                } for row in recent_events],
                "tracking_ready": True,
            }
        else:
            top_users = db.query(
                User.email,
                func.coalesce(usage_per_user.c.total_units, 0).label("total_units"),
                func.coalesce(usage_per_user.c.match_count, 0).label("match_count"),
                func.coalesce(usage_per_user.c.cover_letter_count, 0).label("cover_letter_count"),
                literal(0.0).label("estimated_cost_usd"),
            ).outerjoin(
                usage_per_user, usage_per_user.c.user_id == User.id
            ).filter(
                usage_per_user.c.user_id.isnot(None)
            ).order_by(
                func.coalesce(usage_per_user.c.total_units, 0).desc(),
                User.email.asc()
            ).limit(10).all()

        usage_today = aliased(AIDailyUsage)
        used_today_expr = func.coalesce(usage_today.total_units, 0).label("used_today")
        limit_hits = db.query(
            User.email,
            User.daily_ai_quota,
            used_today_expr,
        ).join(
            usage_today,
            and_(usage_today.user_id == User.id, usage_today.usage_date == today),
        ).filter(
            used_today_expr >= User.daily_ai_quota
        ).order_by(
            used_today_expr.desc(), User.email.asc()
        ).all()

        return JSONResponse(content={
            "total_usage": {
                "units": int(totals.total_units or 0),
                "analyses": int(totals.total_matches or 0),
                "cover_letters": int(totals.total_cover_letters or 0),
            },
            "today_usage": {
                "units": int(totals_today.today_units or 0),
                "analyses": int(totals_today.today_matches or 0),
                "cover_letters": int(totals_today.today_cover_letters or 0),
            },
            "top_users": [{
                "email": row.email,
                "units": int(row.total_units or 0),
                "analyses": int(row.match_count or 0),
                "cover_letters": int(row.cover_letter_count or 0),
                "estimated_cost_usd": _round_money(row.estimated_cost_usd),
            } for row in top_users],
            "limit_hits": [{
                "email": row.email,
                "daily_ai_quota": int(row.daily_ai_quota or 0),
                "used_today": int(row.used_today or 0),
            } for row in limit_hits],
            "cost_estimate": cost_estimate,
        })
    finally:
        db.close()


@router.get("/api/admin/agent-activity")
def get_admin_agent_activity(_: User = Depends(require_admin_user)):
    """Trazabilidad del agente: runs agrupados por estado + actividad reciente.

    Complementa /api/admin/ai-usage (coste y tokens) con la observabilidad de la
    máquina de estados del agente personal de empleo.
    """
    from app.models.agent_run import AgentRun

    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(status_code=500, content={"detail": "Base de datos no disponible"})

    db = SessionLocal()
    try:
        if not inspect(db.bind).has_table("agent_runs"):
            return JSONResponse(content={"by_state": [], "recent": [], "totals": {}})

        by_state = (
            db.query(AgentRun.state, func.count(AgentRun.id).label("count"))
            .group_by(AgentRun.state)
            .all()
        )
        totals = db.query(
            func.count(AgentRun.id),
            func.coalesce(func.sum(AgentRun.ai_calls), 0),
            func.coalesce(func.sum(AgentRun.offers_discarded_prefilter), 0),
            func.coalesce(func.sum(AgentRun.offers_analyzed), 0),
        ).first()
        recent = (
            db.query(AgentRun, User.email)
            .outerjoin(User, User.id == AgentRun.user_id)
            .order_by(AgentRun.created_at.desc())
            .limit(20)
            .all()
        )

        total_runs = int(totals[0] or 0)
        total_analyzed = int(totals[3] or 0)
        total_discarded = int(totals[2] or 0)
        return JSONResponse(content={
            "by_state": [{"state": s, "count": int(c)} for s, c in by_state],
            "totals": {
                "runs": total_runs,
                "ai_interpret_calls": int(totals[1] or 0),
                "offers_discarded_prefilter": total_discarded,
                "offers_analyzed": total_analyzed,
                # % de ofertas descartadas con reglas deterministas antes de tocar IA
                "prefilter_ratio": round(total_discarded / max(total_discarded + total_analyzed, 1), 3),
            },
            "recent": [{
                "id": run.id,
                "email": email,
                "state": run.state,
                "instruction": (run.raw_instruction or "")[:120],
                "result_count": run.result_count,
                "ai_calls": run.ai_calls,
                "created_at": run.created_at.isoformat() if run.created_at else None,
            } for run, email in recent],
        })
    finally:
        db.close()


@router.post("/api/admin/cache/clear")
def clear_search_cache(_: User = Depends(require_admin_user)):
    """Delete all search-cache entries so the next search fetches fresh results."""
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(status_code=500, content={"detail": "Base de datos no disponible"})

    db = SessionLocal()
    try:
        deleted = db.query(SearchCache).delete(synchronize_session=False)
        db.commit()
        return JSONResponse(content={"deleted": deleted})
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        db.close()


@router.get("/api/admin/job-ingestion/runs")
def get_job_ingestion_runs(
    _: User = Depends(require_admin_user),
    limit: int = Query(12, ge=1, le=50),
):
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(status_code=500, content={"detail": "Base de datos no disponible"})

    db = SessionLocal()
    try:
        return JSONResponse(content={
            "items": list_ingestion_runs(db, limit=limit),
            "running": (
                db.query(JobIngestionRun)
                .filter(JobIngestionRun.status == "running")
                .order_by(JobIngestionRun.created_at.desc())
                .count()
            ) > 0,
        })
    finally:
        db.close()


@router.get("/api/admin/job-index/health")
def get_job_index_health(_: User = Depends(require_admin_user)):
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(status_code=500, content={"detail": "Base de datos no disponible"})

    db = SessionLocal()
    try:
        now = datetime.utcnow()
        recent_verification_cutoff = now - timedelta(hours=24)
        due_verification_cutoff = now - timedelta(hours=72)
        stale_listing_cutoff = now - timedelta(hours=168)

        verified_recently_case = case(
            (
                and_(
                    JobOffer.is_active.is_(True),
                    JobOffer.last_verified_at.isnot(None),
                    JobOffer.last_verified_at >= recent_verification_cutoff,
                    (JobOffer.last_seen_at.is_(None) | (JobOffer.last_seen_at > stale_listing_cutoff)),
                ),
                1,
            ),
            else_=0,
        )
        verification_due_case = case(
            (
                and_(
                    JobOffer.is_active.is_(True),
                    JobOffer.last_verified_at.isnot(None),
                    JobOffer.last_verified_at < recent_verification_cutoff,
                    JobOffer.last_verified_at >= due_verification_cutoff,
                    (JobOffer.last_seen_at.is_(None) | (JobOffer.last_seen_at > stale_listing_cutoff)),
                ),
                1,
            ),
            else_=0,
        )
        stale_verification_case = case(
            (
                and_(
                    JobOffer.is_active.is_(True),
                    (
                        JobOffer.last_verified_at.is_(None)
                        | (JobOffer.last_verified_at < due_verification_cutoff)
                    ),
                    (JobOffer.last_seen_at.is_(None) | (JobOffer.last_seen_at > stale_listing_cutoff)),
                ),
                1,
            ),
            else_=0,
        )
        stale_listing_case = case(
            (
                and_(
                    JobOffer.is_active.is_(True),
                    JobOffer.last_seen_at.isnot(None),
                    JobOffer.last_seen_at <= stale_listing_cutoff,
                ),
                1,
            ),
            else_=0,
        )
        inactive_case = case((JobOffer.is_active.is_(False), 1), else_=0)

        overview = db.query(
            func.count(JobOffer.id).label("total_offers"),
            func.coalesce(func.sum(case((JobOffer.is_active.is_(True), 1), else_=0)), 0).label("active_offers"),
            func.coalesce(func.avg(JobOffer.source_confidence), 0.0).label("avg_confidence"),
            func.coalesce(func.sum(verified_recently_case), 0).label("verified_recently"),
            func.coalesce(func.sum(stale_listing_case), 0).label("stale_listing"),
            func.coalesce(func.count(func.distinct(JobOffer.source_name)), 0).label("source_count"),
        ).one()

        source_rows = db.query(
            func.coalesce(JobOffer.source_name, "desconocida").label("source_name"),
            func.coalesce(JobOffer.source_type, "aggregator").label("source_type"),
            func.count(JobOffer.id).label("total_offers"),
            func.coalesce(func.sum(case((JobOffer.is_active.is_(True), 1), else_=0)), 0).label("active_offers"),
            func.coalesce(func.sum(verified_recently_case), 0).label("verified_recently"),
            func.coalesce(func.avg(JobOffer.source_confidence), 0.0).label("avg_confidence"),
            func.max(JobOffer.last_seen_at).label("last_seen_at"),
        ).group_by(
            func.coalesce(JobOffer.source_name, "desconocida"),
            func.coalesce(JobOffer.source_type, "aggregator"),
        ).order_by(
            func.coalesce(func.sum(case((JobOffer.is_active.is_(True), 1), else_=0)), 0).desc(),
            func.count(JobOffer.id).desc(),
            func.coalesce(JobOffer.source_name, "desconocida").asc(),
        ).limit(8).all()

        location_rows = db.query(
            JobOffer.ubicacion,
            func.count(JobOffer.id).label("count"),
        ).filter(
            JobOffer.is_active.is_(True),
            JobOffer.ubicacion.isnot(None),
            func.length(func.trim(JobOffer.ubicacion)) > 0,
        ).group_by(
            JobOffer.ubicacion
        ).order_by(
            func.count(JobOffer.id).desc(),
            JobOffer.ubicacion.asc(),
        ).limit(6).all()

        recent_runs = (
            db.query(JobIngestionRun)
            .order_by(JobIngestionRun.created_at.desc(), JobIngestionRun.id.desc())
            .limit(5)
            .all()
        )

        freshness = [
            {
                "key": "verified_recently",
                "label": "Verificadas recientemente",
                "count": int(db.query(func.coalesce(func.sum(verified_recently_case), 0)).scalar() or 0),
            },
            {
                "key": "verification_due",
                "label": "Verificación reciente",
                "count": int(db.query(func.coalesce(func.sum(verification_due_case), 0)).scalar() or 0),
            },
            {
                "key": "stale_verification",
                "label": "Verificación pendiente",
                "count": int(db.query(func.coalesce(func.sum(stale_verification_case), 0)).scalar() or 0),
            },
            {
                "key": "stale_listing",
                "label": "Listado antiguo",
                "count": int(db.query(func.coalesce(func.sum(stale_listing_case), 0)).scalar() or 0),
            },
            {
                "key": "inactive",
                "label": "Inactivas",
                "count": int(db.query(func.coalesce(func.sum(inactive_case), 0)).scalar() or 0),
            },
        ]

        return JSONResponse(content={
            "overview": {
                "total_offers": int(overview.total_offers or 0),
                "active_offers": int(overview.active_offers or 0),
                "verified_recently": int(overview.verified_recently or 0),
                "stale_listing": int(overview.stale_listing or 0),
                "avg_confidence": round(float(overview.avg_confidence or 0.0), 3),
                "source_count": int(overview.source_count or 0),
            },
            "freshness": freshness,
            "sources": [{
                "source_name": row.source_name,
                "source_type": row.source_type,
                "total_offers": int(row.total_offers or 0),
                "active_offers": int(row.active_offers or 0),
                "verified_recently": int(row.verified_recently or 0),
                "avg_confidence": round(float(row.avg_confidence or 0.0), 3),
                "last_seen_at": row.last_seen_at.isoformat() if row.last_seen_at else None,
            } for row in source_rows],
            "top_locations": [{
                "location": row.ubicacion,
                "count": int(row.count or 0),
            } for row in location_rows],
            "recent_runs": [{
                "id": run.id,
                "status": run.status,
                "fetched_count": int(run.fetched_count or 0),
                "saved_new_count": int(run.saved_new_count or 0),
                "saved_updated_count": int(run.saved_updated_count or 0),
                "inactive_count": int(run.inactive_count or 0),
                "error_count": int(run.error_count or 0),
                "created_at": run.created_at.isoformat() if run.created_at else None,
                "started_at": run.started_at.isoformat() if run.started_at else None,
                "finished_at": run.finished_at.isoformat() if run.finished_at else None,
            } for run in recent_runs],
        })
    finally:
        db.close()


@router.get("/api/admin/job-sources/status")
def get_job_sources_status(_: User = Depends(require_admin_user)):
    return JSONResponse(content=get_public_source_configuration_status())


@router.post("/api/admin/job-ingestion/run")
def start_job_ingestion(
    background_tasks: BackgroundTasks,
    body: StartJobIngestionRequest,
    admin_user: User = Depends(require_admin_user),
):
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(status_code=500, content={"detail": "Base de datos no disponible"})

    db = SessionLocal()
    try:
        if has_running_ingestion(db):
            raise HTTPException(status_code=409, detail="Ya hay una ingesta en ejecucion. Espera a que termine antes de lanzar otra.")

        payload = prepare_ingestion_payload(body.model_dump())
        run = create_ingestion_run(db, payload, user_id=admin_user.id, trigger_mode="admin")
        background_tasks.add_task(run_ingestion_task, run.id, payload)
        return JSONResponse(content={
            "detail": "Ingesta lanzada correctamente",
            "run_id": run.id,
            "status": run.status,
            "payload": payload,
        })
    finally:
        db.close()


@router.get("/api/admin/matching-quality")
def get_matching_quality_metrics(_: User = Depends(require_admin_user)):
    """Métricas de calidad del motor de matching basadas en el feedback de usuarios."""
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(status_code=500, content={"detail": "Base de datos no disponible"})

    db = SessionLocal()
    try:
        total = db.query(func.count(MatchFeedback.id)).scalar() or 0

        positivos = (
            db.query(func.count(MatchFeedback.id))
            .filter(MatchFeedback.rating == "up")
            .scalar()
            or 0
        )
        negativos = total - positivos
        ratio_precision = round((positivos / total * 100), 1) if total > 0 else 0.0

        # Distribución por resultado_ia (offer_result)
        dist_rows = (
            db.query(
                MatchFeedback.offer_result,
                func.count(MatchFeedback.id).label("count"),
            )
            .filter(MatchFeedback.offer_result.isnot(None))
            .group_by(MatchFeedback.offer_result)
            .all()
        )
        distribucion = {row.offer_result: int(row.count) for row in dist_rows}

        # Interpretación textual del ratio
        if ratio_precision >= 70:
            interpretacion = "Motor funcionando correctamente"
            interpretacion_level = "good"
        elif ratio_precision >= 50:
            interpretacion = "Revisión recomendada"
            interpretacion_level = "warning"
        else:
            interpretacion = "Calibración necesaria"
            interpretacion_level = "danger"

        # Precision/Recall por categoría de resultado IA
        # Precision(APLICA) = feedbacks positivos en ofertas que el motor marcó APLICA / total APLICA con feedback
        precision_by_result = {}
        for result_label in ("APLICA", "QUIZÁ", "NO_ENCAJA"):
            total_label = (
                db.query(func.count(MatchFeedback.id))
                .filter(MatchFeedback.offer_result == result_label)
                .scalar() or 0
            )
            positivos_label = (
                db.query(func.count(MatchFeedback.id))
                .filter(MatchFeedback.offer_result == result_label, MatchFeedback.rating == "up")
                .scalar() or 0
            )
            if total_label > 0:
                precision_by_result[result_label] = {
                    "total": total_label,
                    "positivos": positivos_label,
                    "precision": round(positivos_label / total_label * 100, 1),
                }

        # Evolución semanal del ratio (últimas 8 semanas)
        weekly = []
        for w in range(7, -1, -1):
            week_start = datetime.utcnow() - timedelta(weeks=w + 1)
            week_end = datetime.utcnow() - timedelta(weeks=w)
            w_total = (
                db.query(func.count(MatchFeedback.id))
                .filter(MatchFeedback.created_at >= week_start, MatchFeedback.created_at < week_end)
                .scalar() or 0
            )
            w_pos = (
                db.query(func.count(MatchFeedback.id))
                .filter(
                    MatchFeedback.created_at >= week_start,
                    MatchFeedback.created_at < week_end,
                    MatchFeedback.rating == "up",
                )
                .scalar() or 0
            )
            weekly.append({
                "week": week_end.strftime("%d/%m"),
                "total": w_total,
                "positivos": w_pos,
                "ratio": round(w_pos / w_total * 100, 1) if w_total > 0 else None,
            })

        return JSONResponse(content={
            "total_feedbacks": int(total),
            "positivos": int(positivos),
            "negativos": int(negativos),
            "ratio_precision": float(ratio_precision),
            "distribucion_por_resultado": distribucion,
            "precision_by_result": precision_by_result,
            "weekly_evolution": weekly,
            "interpretacion": interpretacion,
            "interpretacion_level": interpretacion_level,
        })
    finally:
        db.close()


@router.get("/api/admin/export/evaluation-csv")
def export_evaluation_csv(_: User = Depends(require_admin_user)):
    """Exporta CSV con datos de evaluación del motor: feedback, scores y búsquedas.
    Para incluir en la memoria del TFM."""
    SessionLocal = get_session_local()
    if SessionLocal is None:
        raise HTTPException(status_code=500, detail="Base de datos no disponible")

    db = SessionLocal()
    try:
        output = io.StringIO()
        writer = csv.writer(output)

        # Sección 1: Feedback de matching
        writer.writerow(["# SECCION: Feedback de Matching"])
        writer.writerow(["id", "usuario_email", "adzuna_id", "rating", "offer_result", "offer_score", "created_at"])
        feedback_rows = (
            db.query(MatchFeedback, User.email)
            .outerjoin(User, User.id == MatchFeedback.user_id)
            .order_by(MatchFeedback.created_at.desc())
            .limit(5000)
            .all()
        )
        for fb, email in feedback_rows:
            writer.writerow([
                fb.id, email or "", fb.adzuna_id, fb.rating,
                fb.offer_result or "", fb.offer_score or "",
                fb.created_at.isoformat() if fb.created_at else "",
            ])

        writer.writerow([])

        # Sección 2: Historial de búsquedas
        writer.writerow(["# SECCION: Historial de busquedas"])
        writer.writerow(["id", "usuario_email", "stack", "anos_experiencia", "num_aplica", "num_quiza", "num_no_encaja", "created_at"])
        search_rows = (
            db.query(SearchHistory, User.email)
            .outerjoin(User, User.id == SearchHistory.user_id)
            .order_by(SearchHistory.created_at.desc())
            .limit(5000)
            .all()
        )
        for sh, email in search_rows:
            stack_str = ",".join(sh.stack) if isinstance(sh.stack, list) else (sh.stack or "")
            writer.writerow([
                sh.id, email or "", stack_str, sh.anos_experiencia or "",
                sh.num_aplica or 0, sh.num_quiza or 0, sh.num_no_encaja or 0,
                sh.created_at.isoformat() if sh.created_at else "",
            ])

        writer.writerow([])

        # Sección 3: Resumen de usuarios
        writer.writerow(["# SECCION: Resumen de usuarios"])
        writer.writerow(["total_usuarios", "verificados", "fecha_exportacion"])
        total_u = db.query(func.count(User.id)).scalar() or 0
        verified_u = db.query(func.count(User.id)).filter(User.email_verified.is_(True)).scalar() or 0
        writer.writerow([total_u, verified_u, datetime.utcnow().isoformat()])

        output.seek(0)
        filename = f"jobmatch_evaluacion_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.csv"
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    finally:
        db.close()


@router.delete("/api/admin/cleanup/inactive-users")
def cleanup_inactive_users(
    days_inactive: int = Query(default=30, ge=7, le=365),
    dry_run: bool = Query(default=True),
    _: User = Depends(require_admin_user),
):
    """Elimina usuarios sin actividad en los últimos N días.
    Con dry_run=true (por defecto) solo muestra quiénes serían eliminados."""
    SessionLocal = get_session_local()
    if SessionLocal is None:
        raise HTTPException(status_code=500, detail="Base de datos no disponible")

    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(days=days_inactive)

        # Usuarios inactivos: sin búsquedas, sin candidaturas, sin favoritos desde cutoff
        # y cuenta creada antes del cutoff
        active_user_ids = set()
        for sh in db.query(SearchHistory.user_id).filter(SearchHistory.created_at >= cutoff).all():
            active_user_ids.add(sh.user_id)
        for app in db.query(Application.user_id).filter(Application.created_at >= cutoff).all():
            active_user_ids.add(app.user_id)
        for fav in db.query(Favorite.user_id).filter(Favorite.created_at >= cutoff).all():
            active_user_ids.add(fav.user_id)

        inactive_query = (
            db.query(User)
            .filter(
                User.is_admin.is_(False),
                User.is_super_admin.is_(False),
                User.created_at < cutoff,
                ~User.id.in_(active_user_ids) if active_user_ids else literal(True),
            )
        )
        inactive_users = inactive_query.all()

        if dry_run:
            return JSONResponse(content={
                "dry_run": True,
                "would_delete": len(inactive_users),
                "days_inactive": days_inactive,
                "cutoff": cutoff.isoformat(),
                "users": [{"id": u.id, "email": u.email, "created_at": u.created_at.isoformat() if u.created_at else None} for u in inactive_users[:50]],
            })

        deleted_count = 0
        for user in inactive_users:
            try:
                db.query(AIDailyUsage).filter(AIDailyUsage.user_id == user.id).delete(synchronize_session=False)
                db.query(Favorite).filter(Favorite.user_id == user.id).delete(synchronize_session=False)
                db.query(SearchHistory).filter(SearchHistory.user_id == user.id).delete(synchronize_session=False)
                db.query(Application).filter(Application.user_id == user.id).delete(synchronize_session=False)
                db.query(RateLimitBucket).filter(RateLimitBucket.bucket_key == f"email:{user.email}").delete(synchronize_session=False)
                db.delete(user)
                deleted_count += 1
            except Exception as exc:
                db.rollback()
                raise HTTPException(status_code=500, detail=f"Error eliminando usuario {user.id}: {exc}")

        db.commit()
        return JSONResponse(content={
            "dry_run": False,
            "deleted": deleted_count,
            "days_inactive": days_inactive,
        })
    finally:
        db.close()
