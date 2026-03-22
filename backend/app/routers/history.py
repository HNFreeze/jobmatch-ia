# -*- coding: utf-8 -*-
import json
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.database import get_session_local
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
def save_history(body: HistoryRequest, user_id: int = Depends(get_current_user_id)):
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(
            status_code=500,
            content={"detail": "Base de datos no disponible"},
            media_type="application/json; charset=utf-8",
        )
    db = SessionLocal()
    try:
        stack_json = json.dumps(body.stack, ensure_ascii=False)
        ubicaciones_json = json.dumps(body.ubicaciones or [], ensure_ascii=False)
        modalidad_json = json.dumps(body.modalidad or [], ensure_ascii=False)

        existing = (
            db.query(SearchHistory)
            .filter(SearchHistory.user_id == user_id)
            .filter(SearchHistory.stack == stack_json)
            .filter(SearchHistory.anos_experiencia == body.anos_experiencia)
            .filter(SearchHistory.ubicaciones == ubicaciones_json)
            .filter(SearchHistory.modalidad == modalidad_json)
            .first()
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
                stack=stack_json,
                anos_experiencia=body.anos_experiencia,
                ubicaciones=ubicaciones_json,
                modalidad=modalidad_json,
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
    except Exception as e:
        db.rollback()
        return JSONResponse(
            status_code=500,
            content={"detail": str(e)},
            media_type="application/json; charset=utf-8",
        )
    finally:
        db.close()


@router.get("/api/history")
def get_history(user_id: int = Depends(get_current_user_id)):
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(
            status_code=500,
            content={"detail": "Base de datos no disponible"},
            media_type="application/json; charset=utf-8",
        )
    db = SessionLocal()
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
                    "stack": json.loads(r.stack) if r.stack else [],
                    "anos_experiencia": r.anos_experiencia or "",
                    "ubicaciones": json.loads(r.ubicaciones) if r.ubicaciones else [],
                    "modalidad": json.loads(r.modalidad) if r.modalidad else [],
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
