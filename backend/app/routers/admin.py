# -*- coding: utf-8 -*-
import os
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import and_, func
from sqlalchemy.orm import aliased

from app.database import get_session_local
from app.models.ai_daily_usage import AIDailyUsage
from app.models.ai_api_cost_event import AIAPICostEvent
from app.models.application import Application
from app.models.email_verification_token import EmailVerificationToken
from app.models.favorite import Favorite
from app.models.rate_limit_bucket import RateLimitBucket
from app.models.search_history import SearchHistory
from app.models.user import User
from app.routers.user import require_admin_user

router = APIRouter()
ADMIN_DELETE_CONFIRMATION_CODE = os.getenv("ADMIN_DELETE_CONFIRMATION_CODE", "715345")
AI_COST_BASELINE_SPENT_USD = float(os.getenv("AI_COST_BASELINE_SPENT_USD", "0"))
AI_COST_BASELINE_REMAINING_USD = float(os.getenv("AI_COST_BASELINE_REMAINING_USD", "0"))

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

        db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == user.id).delete(synchronize_session=False)
        db.query(AIDailyUsage).filter(AIDailyUsage.user_id == user.id).delete(synchronize_session=False)
        db.query(Favorite).filter(Favorite.user_id == user.id).delete(synchronize_session=False)
        db.query(SearchHistory).filter(SearchHistory.user_id == user.id).delete(synchronize_session=False)
        db.query(Application).filter(Application.user_id == user.id).delete(synchronize_session=False)
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

        combined_spent = AI_COST_BASELINE_SPENT_USD + float(total_estimated_cost or 0.0)
        total_budget_reference = AI_COST_BASELINE_SPENT_USD + AI_COST_BASELINE_REMAINING_USD
        estimated_remaining = (
            max(total_budget_reference - combined_spent, 0.0)
            if total_budget_reference > 0
            else None
        )

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
            "cost_estimate": {
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
            },
        })
    finally:
        db.close()
