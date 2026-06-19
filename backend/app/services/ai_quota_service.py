# -*- coding: utf-8 -*-
"""Servicio de cuotas de IA: controla y contabiliza el uso diario de las funciones de IA por usuario y tipo de acción."""
from datetime import date, datetime

from fastapi import HTTPException

from app.models.ai_daily_usage import AIDailyUsage


DEFAULT_DAILY_AI_QUOTA = 8
CV_IMPROVE_DAILY_LIMIT = 2
INTERVIEW_DAILY_LIMIT = 1


def _get_or_create_usage(db, user_id: int, usage_date: date) -> AIDailyUsage:
    row = (
        db.query(AIDailyUsage)
        .filter(AIDailyUsage.user_id == user_id)
        .filter(AIDailyUsage.usage_date == usage_date)
        .first()
    )
    if row:
        return row

    row = AIDailyUsage(user_id=user_id, usage_date=usage_date)
    db.add(row)
    db.flush()
    return row


def get_quota_snapshot(db, user) -> dict:
    today = date.today()
    usage = (
        db.query(AIDailyUsage)
        .filter(AIDailyUsage.user_id == user.id)
        .filter(AIDailyUsage.usage_date == today)
        .first()
    )
    limit = user.daily_ai_quota or DEFAULT_DAILY_AI_QUOTA
    used = usage.total_units if usage else 0
    match_count = usage.match_count if usage else 0
    cover_letter_count = usage.cover_letter_count if usage else 0
    cv_analysis_count = usage.cv_analysis_count if usage else 0
    cv_improve_count = usage.cv_improve_count if usage else 0
    remaining = max(limit - used, 0)
    return {
        "date": str(today),
        "daily_limit": limit,
        "used": used,
        "remaining": remaining,
        "match_count": match_count,
        "cover_letter_count": cover_letter_count,
        "cv_analysis_count": cv_analysis_count,
        "cv_improve_count": cv_improve_count,
        "cv_improve_remaining": max(CV_IMPROVE_DAILY_LIMIT - cv_improve_count, 0),
        "interview_count": usage.interview_count or 0 if usage else 0,
        "interview_remaining": max(INTERVIEW_DAILY_LIMIT - (usage.interview_count or 0), 0) if usage else INTERVIEW_DAILY_LIMIT,
    }


def consume_ai_quota(db, user, action: str) -> dict:
    # Super admins: sin límites
    if getattr(user, "is_super_admin", False):
        return {
            "date": str(date.today()),
            "daily_limit": 9999,
            "used": 0,
            "remaining": 9999,
            "match_count": 0,
            "cover_letter_count": 0,
            "cv_analysis_count": 0,
            "cv_improve_count": 0,
            "cv_improve_remaining": 9999,
            "interview_count": 0,
            "interview_remaining": 9999,
        }

    today = date.today()
    usage = _get_or_create_usage(db, user.id, today)
    limit = user.daily_ai_quota or DEFAULT_DAILY_AI_QUOTA

    if (usage.total_units or 0) >= limit:
        raise HTTPException(
            status_code=429,
            detail="Has alcanzado tu cuota diaria de análisis IA. Vuelve a intentarlo mañana.",
        )

    if action == "match":
        usage.match_count = (usage.match_count or 0) + 1
    elif action == "cover_letter":
        usage.cover_letter_count = (usage.cover_letter_count or 0) + 1
    elif action == "cv_analysis":
        usage.cv_analysis_count = (usage.cv_analysis_count or 0) + 1
    elif action == "cv_improve":
        # Cuota independiente: máx CV_IMPROVE_DAILY_LIMIT al día
        current = usage.cv_improve_count or 0
        if current >= CV_IMPROVE_DAILY_LIMIT:
            raise HTTPException(
                status_code=429,
                detail=f"Has alcanzado el límite de {CV_IMPROVE_DAILY_LIMIT} mejoras de CV por día. Vuelve mañana.",
            )
        usage.cv_improve_count = current + 1
    elif action == "interview":
        # Cuota independiente: máx INTERVIEW_DAILY_LIMIT al día
        current = usage.interview_count or 0
        if current >= INTERVIEW_DAILY_LIMIT:
            raise HTTPException(
                status_code=429,
                detail=f"Ya has realizado tu simulación de entrevista de hoy. Vuelve mañana para practicar de nuevo.",
            )
        usage.interview_count = current + 1

    usage.total_units = (usage.total_units or 0) + 1
    usage.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(usage)

    return {
        "date": str(today),
        "daily_limit": limit,
        "used": usage.total_units,
        "remaining": max(limit - usage.total_units, 0),
        "match_count": usage.match_count or 0,
        "cover_letter_count": usage.cover_letter_count or 0,
        "cv_analysis_count": usage.cv_analysis_count or 0,
        "cv_improve_count": usage.cv_improve_count or 0,
        "cv_improve_remaining": max(CV_IMPROVE_DAILY_LIMIT - (usage.cv_improve_count or 0), 0),
        "interview_count": usage.interview_count or 0,
        "interview_remaining": max(INTERVIEW_DAILY_LIMIT - (usage.interview_count or 0), 0),
    }
