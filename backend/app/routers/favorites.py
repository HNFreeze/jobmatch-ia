# -*- coding: utf-8 -*-
from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.database import get_session_local
from app.models.favorite import Favorite
from app.routers.user import get_current_user_id
from app.services.company_logo_service import enrich_items_with_company_logos

router = APIRouter()


class FavoriteRequest(BaseModel):
    adzuna_id: str
    titulo: Optional[str] = ""
    empresa: Optional[str] = ""
    url: Optional[str] = ""
    resultado_ia: Optional[str] = ""


@router.get("/api/favorites")
def list_favorites(user_id: int = Depends(get_current_user_id)):
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(
            status_code=500,
            content={"detail": "Base de datos no disponible"},
            media_type="application/json; charset=utf-8",
        )
    db = SessionLocal()
    try:
        rows = db.query(Favorite).filter(Favorite.user_id == user_id).all()
        payload = [
            {
                "adzuna_id": r.adzuna_id,
                "titulo": r.titulo or "",
                "empresa": r.empresa or "",
                "url": r.url or "",
                "resultado_ia": r.resultado_ia or "",
                "created_at": str(r.created_at),
            }
            for r in rows
        ]
        try:
            payload = enrich_items_with_company_logos(db, payload)
        except Exception:
            pass
        return JSONResponse(
            content=payload,
            media_type="application/json; charset=utf-8",
        )
    finally:
        db.close()


@router.post("/api/favorites")
def add_favorite(body: FavoriteRequest, user_id: int = Depends(get_current_user_id)):
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(
            status_code=500,
            content={"detail": "Base de datos no disponible"},
            media_type="application/json; charset=utf-8",
        )
    db = SessionLocal()
    try:
        existing = db.query(Favorite).filter(
            Favorite.user_id == user_id,
            Favorite.adzuna_id == body.adzuna_id,
        ).first()
        if existing:
            return JSONResponse(
                content={"detail": "Ya es favorita"},
                media_type="application/json; charset=utf-8",
            )
        db.add(Favorite(
            user_id=user_id,
            adzuna_id=body.adzuna_id,
            titulo=body.titulo,
            empresa=body.empresa,
            url=body.url,
            resultado_ia=body.resultado_ia,
        ))
        db.commit()
        return JSONResponse(
            content={"detail": "Añadida a favoritas"},
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


@router.delete("/api/favorites/{adzuna_id}")
def remove_favorite(adzuna_id: str, user_id: int = Depends(get_current_user_id)):
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(
            status_code=500,
            content={"detail": "Base de datos no disponible"},
            media_type="application/json; charset=utf-8",
        )
    db = SessionLocal()
    try:
        row = db.query(Favorite).filter(
            Favorite.user_id == user_id,
            Favorite.adzuna_id == adzuna_id,
        ).first()
        if row:
            db.delete(row)
            db.commit()
        return JSONResponse(
            content={"detail": "Eliminada de favoritas"},
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
