# -*- coding: utf-8 -*-
"""Router de datos de empresa: expone la información y los logos de empresa cacheados para enriquecer las ofertas."""
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.company_data_service import get_or_create_company_data

router = APIRouter()

@router.get("/api/company/{name}")
def get_company_info(name: str, db: Session = Depends(get_db)):
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
