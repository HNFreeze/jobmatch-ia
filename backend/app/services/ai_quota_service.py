# -*- coding: utf-8 -*-
from datetime import date, datetime

from fastapi import HTTPException

from app.models.ai_daily_usage import AIDailyUsage


DEFAULT_DAILY_AI_QUOTA = 8


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
    remaining = max(limit - used, 0)
    return {
        "date": str(today),
        "daily_limit": limit,
        "used": used,
        "remaining": remaining,
        "match_count": match_count,
        "cover_letter_count": cover_letter_count,
    }


def consume_ai_quota(db, user, action: str) -> dict:
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
    }
