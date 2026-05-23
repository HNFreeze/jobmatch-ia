# -*- coding: utf-8 -*-
import json
from typing import List, Optional

import bcrypt
from fastapi import APIRouter, Depends, Header
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.database import get_session_local
from app.models.ai_daily_usage import AIDailyUsage
from app.models.application import Application
from app.models.email_verification_token import EmailVerificationToken
from app.models.favorite import Favorite
from app.models.search_history import SearchHistory
from app.models.user import User
from app.services.ai_quota_service import get_quota_snapshot
from app.services.security_service import decode_user_id_from_token

router = APIRouter()
DELETE_ACCOUNT_CONFIRMATION = "ELIMINAR"


def get_current_user_record(authorization: str = Header(None)) -> User:
    user_id = decode_user_id_from_token(authorization)
    SessionLocal = get_session_local()
    if SessionLocal is None:
        raise HTTPException(status_code=500, detail="Base de datos no disponible")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no disponible")
        if user.is_blocked:
            raise HTTPException(status_code=403, detail="Tu cuenta ha sido bloqueada. Contacta con administracion")
        if not user.email_verified:
            raise HTTPException(status_code=403, detail="Debes verificar tu email para usar la aplicación")
        db.expunge(user)
        return user
    finally:
        db.close()


def get_current_user_id(user: User = Depends(get_current_user_record)) -> int:
    return user.id


def require_admin_user(user: User = Depends(get_current_user_record)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Acceso restringido a administradores")
    return user


class Language(BaseModel):
    idioma: str
    nivel: str


class ProfileData(BaseModel):
    stack: Optional[List[str]] = None
    anos_experiencia: Optional[str] = None
    idiomas: Optional[List[Language]] = None
    ubicaciones: Optional[List[str]] = None
    modalidad: Optional[List[str]] = None
    onboarding_completed: Optional[bool] = None
    stack_years: Optional[dict] = None  # {"Python": 3, "React": 2}


class ConsentRequest(BaseModel):
    accepted: bool


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class DeleteAccountRequest(BaseModel):
    current_password: str
    confirmation_text: str


@router.patch("/api/user/consent")
def update_consent(body: ConsentRequest, user_id: int = Depends(get_current_user_id)):
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(
            status_code=500,
            content={"detail": "Base de datos no disponible"},
            media_type="application/json; charset=utf-8",
        )
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        user.analytics_consent = body.accepted
        db.commit()
        return JSONResponse(
            content={"detail": "Preferencia de analítica guardada", "analytics_consent": body.accepted},
            media_type="application/json; charset=utf-8",
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        return JSONResponse(
            status_code=500,
            content={"detail": str(e)},
            media_type="application/json; charset=utf-8",
        )
    finally:
        db.close()


@router.get("/api/user/profile")
def get_profile(user_id: int = Depends(get_current_user_id)):
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(
            status_code=500,
            content={"detail": "Base de datos no disponible"},
            media_type="application/json; charset=utf-8",
        )
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        return JSONResponse(
            content={
                "email": user.email,
                "email_verified": bool(user.email_verified),
                "is_admin": bool(user.is_admin),
                "is_blocked": bool(user.is_blocked),
                "alias": user.alias or user.email.split("@")[0],
                "nombre": user.nombre or "",
                "apellidos": user.apellidos or "",
                "stack": json.loads(user.stack) if user.stack else [],
                "anos_experiencia": user.anos_experiencia or "",
                "idiomas": json.loads(user.idiomas) if user.idiomas else [],
                "ubicaciones": json.loads(user.ubicaciones) if user.ubicaciones else [],
                "modalidad": json.loads(user.modalidad) if user.modalidad else [],
                "onboarding_completed": bool(user.onboarding_completed),
                "analytics_consent": user.analytics_consent,
                "stack_years": json.loads(user.stack_years) if user.stack_years else {},
            },
            media_type="application/json; charset=utf-8",
        )
    finally:
        db.close()


@router.get("/api/user/ai-quota")
def get_ai_quota(user: User = Depends(get_current_user_record)):
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(
            status_code=500,
            content={"detail": "Base de datos no disponible"},
            media_type="application/json; charset=utf-8",
        )
    db = SessionLocal()
    try:
        fresh_user = db.query(User).filter(User.id == user.id).first()
        if not fresh_user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        snapshot = get_quota_snapshot(db, fresh_user)
        return JSONResponse(content=snapshot, media_type="application/json; charset=utf-8")
    finally:
        db.close()


@router.patch("/api/user/password")
def change_password(body: ChangePasswordRequest, user_id: int = Depends(get_current_user_id)):
    if len(body.new_password) < 8:
        return JSONResponse(
            status_code=422,
            content={"detail": "La nueva contraseña debe tener al menos 8 caracteres"},
            media_type="application/json; charset=utf-8",
        )

    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(
            status_code=500,
            content={"detail": "Base de datos no disponible"},
            media_type="application/json; charset=utf-8",
        )

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        if not bcrypt.checkpw(body.current_password.encode(), user.password_hash.encode()):
            return JSONResponse(
                status_code=400,
                content={"detail": "La contraseña actual no es correcta"},
                media_type="application/json; charset=utf-8",
            )

        if bcrypt.checkpw(body.new_password.encode(), user.password_hash.encode()):
            return JSONResponse(
                status_code=400,
                content={"detail": "La nueva contraseña debe ser diferente a la actual"},
                media_type="application/json; charset=utf-8",
            )

        user.password_hash = bcrypt.hashpw(
            body.new_password.encode(), bcrypt.gensalt()
        ).decode()
        db.commit()
        return JSONResponse(
            content={"detail": "Contraseña actualizada correctamente"},
            media_type="application/json; charset=utf-8",
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        return JSONResponse(
            status_code=500,
            content={"detail": str(e)},
            media_type="application/json; charset=utf-8",
        )
    finally:
        db.close()


@router.delete("/api/user/account")
def delete_account(body: DeleteAccountRequest, user_id: int = Depends(get_current_user_id)):
    if not body.current_password.strip():
        return JSONResponse(
            status_code=422,
            content={"detail": "La contraseña actual es obligatoria"},
            media_type="application/json; charset=utf-8",
        )

    if body.confirmation_text.strip().upper() != DELETE_ACCOUNT_CONFIRMATION:
        return JSONResponse(
            status_code=422,
            content={"detail": f"Debes escribir '{DELETE_ACCOUNT_CONFIRMATION}' para confirmar"},
            media_type="application/json; charset=utf-8",
        )

    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(
            status_code=500,
            content={"detail": "Base de datos no disponible"},
            media_type="application/json; charset=utf-8",
        )

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no disponible")

        if not bcrypt.checkpw(body.current_password.encode(), user.password_hash.encode()):
            return JSONResponse(
                status_code=400,
                content={"detail": "La contraseña actual no es correcta"},
                media_type="application/json; charset=utf-8",
            )

        db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == user_id).delete(synchronize_session=False)
        db.query(AIDailyUsage).filter(AIDailyUsage.user_id == user_id).delete(synchronize_session=False)
        db.query(Favorite).filter(Favorite.user_id == user_id).delete(synchronize_session=False)
        db.query(SearchHistory).filter(SearchHistory.user_id == user_id).delete(synchronize_session=False)
        db.query(Application).filter(Application.user_id == user_id).delete(synchronize_session=False)
        db.delete(user)
        db.commit()

        return JSONResponse(
            content={"detail": "Cuenta eliminada correctamente"},
            media_type="application/json; charset=utf-8",
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        return JSONResponse(
            status_code=500,
            content={"detail": str(e)},
            media_type="application/json; charset=utf-8",
        )
    finally:
        db.close()


@router.put("/api/user/profile")
def update_profile(body: ProfileData, user_id: int = Depends(get_current_user_id)):
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(
            status_code=500,
            content={"detail": "Base de datos no disponible"},
            media_type="application/json; charset=utf-8",
        )
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        if body.stack is not None:
            user.stack = json.dumps(body.stack, ensure_ascii=False)
        if body.anos_experiencia is not None:
            user.anos_experiencia = body.anos_experiencia
        if body.idiomas is not None:
            user.idiomas = json.dumps(
                [lang.model_dump() for lang in body.idiomas],
                ensure_ascii=False,
            )
        if body.ubicaciones is not None:
            user.ubicaciones = json.dumps(body.ubicaciones, ensure_ascii=False)
        if body.modalidad is not None:
            user.modalidad = json.dumps(body.modalidad, ensure_ascii=False)
        if body.onboarding_completed is not None:
            user.onboarding_completed = body.onboarding_completed
        if body.stack_years is not None:
            user.stack_years = json.dumps(body.stack_years, ensure_ascii=False)
        db.commit()
        return JSONResponse(
            content={"detail": "Perfil guardado correctamente"},
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
