# -*- coding: utf-8 -*-
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.notification import Notification
from app.routers.user import get_current_user_id

router = APIRouter()


def _serialize(n: Notification) -> dict:
    return {
        "id": n.id,
        "title": n.title,
        "message": n.message or "",
        "type": n.type or "info",
        "read": bool(n.read),
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


@router.get("/api/notifications")
def get_notifications(
    limit: int = 30,
    unread_only: bool = False,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    try:
        q = db.query(Notification).filter(Notification.user_id == user_id)
        if unread_only:
            q = q.filter(Notification.read == False)  # noqa: E712
        notifications = q.order_by(Notification.created_at.desc()).limit(limit).all()
        unread_count = (
            db.query(Notification)
            .filter(Notification.user_id == user_id, Notification.read == False)  # noqa: E712
            .count()
        )
        return JSONResponse(content={
            "notifications": [_serialize(n) for n in notifications],
            "unread_count": unread_count,
        })
    finally:
        db.close()


@router.patch("/api/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    try:
        n = db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        ).first()
        if not n:
            return JSONResponse(status_code=404, content={"detail": "Notificación no encontrada"})
        n.read = True
        db.commit()
        return JSONResponse(content={"detail": "Marcada como leída"})
    finally:
        db.close()


@router.post("/api/notifications/read-all")
def mark_all_read(user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    try:
        db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.read == False,  # noqa: E712
        ).update({"read": True})
        db.commit()
        return JSONResponse(content={"detail": "Todas marcadas como leídas"})
    finally:
        db.close()


# ── Helper used by alert_service to write notifications ──────────────────────
def create_notification(db, user_id: int, title: str, message: str = "", ntype: str = "alert") -> None:
    """Create an in-app notification. Called from alert_service when an alert fires."""
    try:
        n = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=ntype,
            read=False,
            created_at=datetime.utcnow(),
        )
        db.add(n)
        db.commit()
    except Exception:
        db.rollback()
