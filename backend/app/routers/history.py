# -*- coding: utf-8 -*-
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.search_history import SearchHistory
from app.routers.user import get_current_user_id

router = APIRouter()


class HistoryRequest(BaseModel):
    stack: List[str]
    anos_experiencia: Optional[str] = ""
    ubicaciones: Optional[List[str]] = []
    modalidad: Optional[List[str]] = []
    num_aplica: int = 0
    num_quiza: int = 0
    num_no_encaja: int = 0


@router.post("/api/history")
def save_history(body: HistoryRequest, user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    try:
        stack_val = body.stack
        ubicaciones_val = body.ubicaciones or []
        modalidad_val = body.modalidad or []

        # Dedup en Python: comparar columnas JSONB (stack/ubicaciones/modalidad)
        # con == en SQL falla en Postgres ("operator does not exist: jsonb = json").
        # Filtramos por user_id + anos_experiencia (String) y comparamos las listas en memoria.
        candidates = (
            db.query(SearchHistory)
            .filter(SearchHistory.user_id == user_id)
            .filter(SearchHistory.anos_experiencia == body.anos_experiencia)
            .all()
        )
        existing = next(
            (r for r in candidates
             if (r.stack or []) == stack_val
             and (r.ubicaciones or []) == ubicaciones_val
             and (r.modalidad or []) == modalidad_val),
            None,
        )

        if existing:
            existing.num_aplica = body.num_aplica
            existing.num_quiza = body.num_quiza
            existing.num_no_encaja = body.num_no_encaja
            existing.created_at = datetime.utcnow()
            db.commit()
        else:
            db.add(SearchHistory(
                user_id=user_id,
                stack=stack_val,
                anos_experiencia=body.anos_experiencia,
                ubicaciones=ubicaciones_val,
                modalidad=modalidad_val,
                num_aplica=body.num_aplica,
                num_quiza=body.num_quiza,
                num_no_encaja=body.num_no_encaja,
            ))
            db.commit()

            all_searches = (
                db.query(SearchHistory)
                .filter(SearchHistory.user_id == user_id)
                .order_by(SearchHistory.created_at.desc())
                .all()
            )
            if len(all_searches) > 3:
                db.delete(all_searches[-1])
                db.commit()

        return JSONResponse(
            content={"detail": "Búsqueda guardada"},
            media_type="application/json; charset=utf-8",
        )
    except Exception:
        db.rollback()
        return JSONResponse(
            status_code=500,
            content={"detail": "Error interno del servidor."},
            media_type="application/json; charset=utf-8",
        )
    finally:
        db.close()


@router.get("/api/history")
def get_history(user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    try:
        rows = (
            db.query(SearchHistory)
            .filter(SearchHistory.user_id == user_id)
            .order_by(SearchHistory.created_at.desc())
            .limit(3)
            .all()
        )
        return JSONResponse(
            content=[
                {
                    "id": r.id,
                    "stack": r.stack or [],
                    "anos_experiencia": r.anos_experiencia or "",
                    "ubicaciones": r.ubicaciones or [],
                    "modalidad": r.modalidad or [],
                    "num_aplica": r.num_aplica or 0,
                    "num_quiza": r.num_quiza or 0,
                    "num_no_encaja": r.num_no_encaja or 0,
                    "num_total": (r.num_aplica or 0) + (r.num_quiza or 0) + (r.num_no_encaja or 0),
                    "created_at": str(r.created_at),
                }
                for r in rows
            ],
            media_type="application/json; charset=utf-8",
        )
    finally:
        db.close()
