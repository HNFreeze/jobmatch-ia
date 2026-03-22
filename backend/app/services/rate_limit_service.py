# -*- coding: utf-8 -*-
from dataclasses import dataclass
from datetime import datetime, timedelta

from fastapi import HTTPException

from app.models.rate_limit_bucket import RateLimitBucket


@dataclass
class RateLimitRule:
    action: str
    bucket_key: str
    limit: int
    window_seconds: int
    detail: str


def _window_start_for(now: datetime, window_seconds: int) -> datetime:
    timestamp = int(now.timestamp())
    floored = timestamp - (timestamp % window_seconds)
    return datetime.utcfromtimestamp(floored)


def enforce_rate_limits(db, rules: list[RateLimitRule]) -> None:
    now = datetime.utcnow()

    for rule in rules:
        window_start = _window_start_for(now, rule.window_seconds)
        row = (
            db.query(RateLimitBucket)
            .filter(RateLimitBucket.action == rule.action)
            .filter(RateLimitBucket.bucket_key == rule.bucket_key)
            .filter(RateLimitBucket.window_start == window_start)
            .first()
        )

        if row and row.count >= rule.limit:
            retry_after = int((window_start + timedelta(seconds=rule.window_seconds) - now).total_seconds())
            raise HTTPException(
                status_code=429,
                detail=rule.detail,
                headers={"Retry-After": str(max(retry_after, 1))},
            )

        if row:
            row.count += 1
            row.updated_at = now
        else:
            db.add(RateLimitBucket(
                action=rule.action,
                bucket_key=rule.bucket_key,
                window_start=window_start,
                count=1,
            ))

    db.commit()
