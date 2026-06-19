"""Router de candidaturas: alta y seguimiento de las candidaturas del usuario (estado, notas y fecha de seguimiento)."""
from typing import List, Optional
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel

from app.database import get_db
from app.routers.user import get_current_user_id
from app.models.user import User
from app.models.application import Application

router = APIRouter()

class ApplicationCreate(BaseModel):
    adzuna_id: str
    titulo: Optional[str] = ""
    empresa: Optional[str] = ""
    url: Optional[str] = ""
    status: Optional[str] = "guardada"
    notes: Optional[str] = None

class ApplicationUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    follow_up_date: Optional[date] = None

class ApplicationOut(BaseModel):
    id: int
    user_id: int
    adzuna_id: str
    titulo: Optional[str] = ""
    empresa: Optional[str] = ""
    url: Optional[str] = ""
    status: str
    notes: Optional[str]
    follow_up_date: Optional[date] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True

def _serialize_app(db_app: Application) -> dict:
    return {
        "id": db_app.id,
        "user_id": db_app.user_id,
        "adzuna_id": db_app.adzuna_id,
        "titulo": db_app.titulo or "",
        "empresa": db_app.empresa or "",
        "url": db_app.url or "",
        "status": db_app.status,
        "notes": db_app.notes,
        "follow_up_date": db_app.follow_up_date.isoformat() if db_app.follow_up_date else None,
        "created_at": db_app.created_at.isoformat() if db_app.created_at else None,
        "updated_at": db_app.updated_at.isoformat() if db_app.updated_at else None,
    }

@router.post("/api/applications", response_model=ApplicationOut)
def create_application(
    app_data: ApplicationCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    existing = db.query(Application).filter(
        Application.user_id == user_id,
        Application.adzuna_id == app_data.adzuna_id
    ).first()
    
    if existing:
        return _serialize_app(existing)
        
    db_application = Application(
        user_id=user_id,
        adzuna_id=app_data.adzuna_id,
        titulo=app_data.titulo,
        empresa=app_data.empresa,
        url=app_data.url,
        status=app_data.status or "guardada",
        notes=app_data.notes
    )
    try:
        db.add(db_application)
        db.commit()
        db.refresh(db_application)
        return _serialize_app(db_application)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create application")

@router.get("/api/applications", response_model=List[ApplicationOut])
def get_applications(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    apps = db.query(Application).filter(Application.user_id == user_id).order_by(Application.updated_at.desc()).all()
    return [_serialize_app(a) for a in apps]

@router.patch("/api/applications/{app_id}", response_model=ApplicationOut)
def update_application(
    app_id: int,
    app_data: ApplicationUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    db_app = db.query(Application).filter(
        Application.id == app_id, 
        Application.user_id == user_id
    ).first()
    
    if not db_app:
        raise HTTPException(status_code=404, detail="Application not found")
        
    if app_data.status is not None:
        db_app.status = app_data.status
    if app_data.notes is not None:
        db_app.notes = app_data.notes
    if "follow_up_date" in app_data.model_fields_set:
        db_app.follow_up_date = app_data.follow_up_date
        
    db_app.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_app)
    return _serialize_app(db_app)

@router.delete("/api/applications/{app_id}")
def delete_application(
    app_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    db_app = db.query(Application).filter(
        Application.id == app_id, 
        Application.user_id == user_id
    ).first()
    
    if not db_app:
        raise HTTPException(status_code=404, detail="Application not found")
        
    db.delete(db_app)
    db.commit()
    return {"message": "Application deleted successfully"}
