# -*- coding: utf-8 -*-
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.database import get_session_local
from app.services.company_data_service import get_or_create_company_data

router = APIRouter()

@router.get("/api/company/{name}")
def get_company_info(name: str):
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(status_code=500, content={"detail": "BD no disponible"})
    db = SessionLocal()
    try:
        data = get_or_create_company_data(db, name)
        if data:
            return JSONResponse(
                content=data,
                media_type="application/json; charset=utf-8"
            )
        return JSONResponse(
            status_code=404, 
            content={"detail": "Empresa no encontrada"},
            media_type="application/json; charset=utf-8"
        )
    finally:
        db.close()
