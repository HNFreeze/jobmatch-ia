# -*- coding: utf-8 -*-
"""
alerts.py — Router para gestión de alertas de empleo y disparador manual.
"""
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.database import get_session_local
from app.models.job_alert import JobAlert
from app.models.user import User
from app.routers.user import get_current_user_record, require_admin_user
from app.services.alert_service import process_job_alerts

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class UpsertAlertRequest(BaseModel):
    min_score_threshold: int = Field(70, ge=30, le=100)
    email_frequency: str = Field("daily", pattern="^(daily|weekly)$")
    is_active: bool = True


# ── Helpers ───────────────────────────────────────────────────────────────────

def _serialize_alert(alert: JobAlert) -> dict:
    return {
        "id": alert.id,
        "min_score_threshold": alert.min_score_threshold,
        "email_frequency": alert.email_frequency,
        "is_active": bool(alert.is_active),
        "last_triggered_at": alert.last_triggered_at.isoformat() if alert.last_triggered_at else None,
        "created_at": alert.created_at.isoformat() if alert.created_at else None,
    }


# ── User endpoints ────────────────────────────────────────────────────────────

@router.get("/api/alerts/mine")
def get_my_alert(user: User = Depends(get_current_user_record)):
    """Devuelve la alerta activa del usuario (o null si no tiene)."""
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(status_code=500, content={"detail": "Base de datos no disponible"})
    db = SessionLocal()
    try:
        alert = db.query(JobAlert).filter(JobAlert.user_id == user.id).first()
        return JSONResponse(content={"alert": _serialize_alert(alert) if alert else None})
    finally:
        db.close()


@router.put("/api/alerts/mine")
def upsert_my_alert(body: UpsertAlertRequest, user: User = Depends(get_current_user_record)):
    """Crea o actualiza la alerta del usuario."""
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(status_code=500, content={"detail": "Base de datos no disponible"})
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        alert = db.query(JobAlert).filter(JobAlert.user_id == user.id).first()
        if alert:
            alert.min_score_threshold = body.min_score_threshold
            alert.email_frequency = body.email_frequency
            alert.is_active = body.is_active
            alert.updated_at = now
        else:
            alert = JobAlert(
                user_id=user.id,
                min_score_threshold=body.min_score_threshold,
                email_frequency=body.email_frequency,
                is_active=body.is_active,
                created_at=now,
                updated_at=now,
            )
            db.add(alert)
        db.commit()
        db.refresh(alert)
        return JSONResponse(content={"alert": _serialize_alert(alert)})
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@router.delete("/api/alerts/mine")
def delete_my_alert(user: User = Depends(get_current_user_record)):
    """Desactiva (soft-delete) la alerta del usuario."""
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(status_code=500, content={"detail": "Base de datos no disponible"})
    db = SessionLocal()
    try:
        alert = db.query(JobAlert).filter(JobAlert.user_id == user.id).first()
        if alert:
            alert.is_active = False
            alert.updated_at = datetime.utcnow()
            db.commit()
        return JSONResponse(content={"detail": "Alerta desactivada"})
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ── Admin endpoint: disparo manual ────────────────────────────────────────────

@router.post("/api/admin/alerts/trigger")
def trigger_alerts_manually(_: User = Depends(require_admin_user)):
    """Dispara el proceso de alertas manualmente (para testing / cron manual)."""
    try:
        summary = process_job_alerts()
        return JSONResponse(content={"detail": "Proceso de alertas completado", **summary})
    except Exception as exc:
        return JSONResponse(status_code=500, content={"detail": f"Error: {str(exc)}"})
