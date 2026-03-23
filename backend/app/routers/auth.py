# -*- coding: utf-8 -*-
import os
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from fastapi import APIRouter, Request
from fastapi import HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.database import get_session_local
from app.models.email_verification_token import EmailVerificationToken
from app.models.user import User
from app.services.ai_quota_service import DEFAULT_DAILY_AI_QUOTA
from app.services.email_service import build_verification_email, send_email
from app.services.rate_limit_service import RateLimitRule, enforce_rate_limits
from app.services.security_service import (
    create_access_token,
    generate_verification_token,
    get_client_ip,
    hash_token,
    normalize_email,
)
from app.services.turnstile_service import validate_turnstile_token

router = APIRouter()
VERIFICATION_TOKEN_HOURS = int(os.getenv("EMAIL_VERIFICATION_TOKEN_HOURS", "24"))


class RegisterRequest(BaseModel):
    email: str
    password: str
    alias: str
    nombre: Optional[str] = None
    apellidos: Optional[str] = None
    turnstile_token: str


class LoginRequest(BaseModel):
    email: str
    password: str


class VerifyEmailRequest(BaseModel):
    token: str


class ResendVerificationRequest(BaseModel):
    email: str


def _build_verification_url(raw_token: str) -> str:
    frontend_url = os.getenv("APP_FRONTEND_URL", "http://localhost:3001").rstrip("/")
    return f"{frontend_url}/#verify-email?token={raw_token}"


def _replace_email_verification_token(db, user: User) -> str:
    db.query(EmailVerificationToken).filter(
        EmailVerificationToken.user_id == user.id
    ).delete(synchronize_session=False)

    raw_token = generate_verification_token()
    db.add(EmailVerificationToken(
        user_id=user.id,
        token_hash=hash_token(raw_token),
        expires_at=datetime.utcnow() + timedelta(hours=VERIFICATION_TOKEN_HOURS),
    ))
    return raw_token


def _send_verification_email(user: User, raw_token: str) -> None:
    verification_url = _build_verification_url(raw_token)
    subject, text_body, html_body = build_verification_email(user.email, verification_url)
    send_email(user.email, subject, text_body, html_body)


@router.post("/api/auth/register")
def register(body: RegisterRequest, request: Request):
    email = normalize_email(body.email)
    alias = (body.alias or "").strip()

    if len(body.password) < 8:
        return JSONResponse(
            status_code=422,
            content={"detail": "La contraseña debe tener al menos 8 caracteres"},
            media_type="application/json; charset=utf-8",
        )

    if not alias:
        return JSONResponse(
            status_code=422,
            content={"detail": "El alias es obligatorio"},
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
    client_ip = get_client_ip(request)
    try:
        enforce_rate_limits(db, [
            RateLimitRule(
                action="auth_register_ip",
                bucket_key=f"ip:{client_ip}",
                limit=20,
                window_seconds=3600,
                detail="Has alcanzado el límite de registros desde esta IP. Inténtalo más tarde.",
            ),
        ])

        try:
            if not validate_turnstile_token(body.turnstile_token, client_ip):
                return JSONResponse(
                    status_code=400,
                    content={"detail": "La validación anti-bot no se ha completado correctamente", "code": "turnstile_failed"},
                    media_type="application/json; charset=utf-8",
                )
        except Exception as e:
            return JSONResponse(
                status_code=503,
                content={"detail": f"No se pudo validar Turnstile: {e}", "code": "turnstile_unavailable"},
                media_type="application/json; charset=utf-8",
            )

        existing = db.query(User).filter(User.email == email).first()
        if existing:
            if existing.email_verified:
                return JSONResponse(
                    status_code=409,
                    content={"detail": "El email ya está registrado", "code": "email_already_registered"},
                    media_type="application/json; charset=utf-8",
                )
            return JSONResponse(
                status_code=409,
                content={
                    "detail": "Ya existe una cuenta pendiente de verificar para este email",
                    "code": "email_not_verified",
                    "email": email,
                },
                media_type="application/json; charset=utf-8",
            )

        hashed = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
        user = User(
            email=email,
            password_hash=hashed,
            alias=alias,
            nombre=(body.nombre or "").strip() or None,
            apellidos=(body.apellidos or "").strip() or None,
            email_verified=False,
            daily_ai_quota=int(os.getenv("DEFAULT_DAILY_AI_QUOTA", str(DEFAULT_DAILY_AI_QUOTA))),
        )
        db.add(user)
        db.flush()

        raw_token = _replace_email_verification_token(db, user)
        db.commit()
        db.refresh(user)

        email_sent = True
        try:
            _send_verification_email(user, raw_token)
        except Exception:
            email_sent = False

        return JSONResponse(
            status_code=201,
            content={
                "detail": "Cuenta creada. Revisa tu correo para verificar tu email.",
                "email": user.email,
                "verification_required": True,
                "email_sent": email_sent,
            },
            media_type="application/json; charset=utf-8",
        )
    except HTTPException as e:
        db.rollback()
        return JSONResponse(
            status_code=e.status_code,
            content={"detail": e.detail},
            headers=e.headers,
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


@router.post("/api/auth/login")
def login(body: LoginRequest, request: Request):
    email = normalize_email(body.email)

    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(
            status_code=500,
            content={"detail": "Base de datos no disponible"},
            media_type="application/json; charset=utf-8",
        )

    db = SessionLocal()
    client_ip = get_client_ip(request)
    try:
        enforce_rate_limits(db, [
            RateLimitRule(
                action="auth_login_ip",
                bucket_key=f"ip:{client_ip}",
                limit=12,
                window_seconds=900,
                detail="Demasiados intentos de inicio de sesión desde esta IP. Espera unos minutos.",
            ),
            RateLimitRule(
                action="auth_login_email",
                bucket_key=f"email:{email}",
                limit=8,
                window_seconds=900,
                detail="Demasiados intentos de inicio de sesión para este usuario. Espera unos minutos.",
            ),
        ])

        user = db.query(User).filter(User.email == email).first()
        if not user or not bcrypt.checkpw(body.password.encode(), user.password_hash.encode()):
            return JSONResponse(
                status_code=401,
                content={"detail": "Email o contraseña incorrectos"},
                media_type="application/json; charset=utf-8",
            )

        if user.is_blocked:
            return JSONResponse(
                status_code=403,
                content={"detail": "Tu cuenta ha sido bloqueada. Contacta con administracion", "code": "account_blocked"},
                media_type="application/json; charset=utf-8",
            )

        if not user.email_verified:
            return JSONResponse(
                status_code=403,
                content={
                    "detail": "Debes verificar tu email antes de iniciar sesión",
                    "code": "email_not_verified",
                    "email": user.email,
                },
                media_type="application/json; charset=utf-8",
            )

        token = create_access_token(user.id, user.email)
        return JSONResponse(
            content={
                "token": token,
                "email": user.email,
                "alias": user.alias or user.email.split("@")[0],
                "is_admin": bool(user.is_admin),
            },
            media_type="application/json; charset=utf-8",
        )
    except HTTPException as e:
        return JSONResponse(
            status_code=e.status_code,
            content={"detail": e.detail},
            headers=e.headers,
            media_type="application/json; charset=utf-8",
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"detail": str(e)},
            media_type="application/json; charset=utf-8",
        )
    finally:
        db.close()


@router.post("/api/auth/verify-email")
def verify_email(body: VerifyEmailRequest, request: Request):
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(
            status_code=500,
            content={"detail": "Base de datos no disponible"},
            media_type="application/json; charset=utf-8",
        )

    db = SessionLocal()
    client_ip = get_client_ip(request)
    try:
        enforce_rate_limits(db, [
            RateLimitRule(
                action="auth_verify_email_ip",
                bucket_key=f"ip:{client_ip}",
                limit=20,
                window_seconds=3600,
                detail="Has realizado demasiados intentos de verificación. Inténtalo más tarde.",
            ),
        ])

        hashed_token = hash_token(body.token.strip())
        token_row = (
            db.query(EmailVerificationToken)
            .filter(EmailVerificationToken.token_hash == hashed_token)
            .first()
        )
        if not token_row or token_row.used_at:
            return JSONResponse(
                status_code=400,
                content={"detail": "El enlace de verificación no es válido", "code": "invalid_verification_token"},
                media_type="application/json; charset=utf-8",
            )

        if token_row.expires_at < datetime.utcnow():
            return JSONResponse(
                status_code=400,
                content={"detail": "El enlace de verificación ha expirado", "code": "expired_verification_token"},
                media_type="application/json; charset=utf-8",
            )

        user = db.query(User).filter(User.id == token_row.user_id).first()
        if not user:
            return JSONResponse(
                status_code=400,
                content={"detail": "No se encontró la cuenta asociada a este enlace"},
                media_type="application/json; charset=utf-8",
            )

        user.email_verified = True
        user.email_verified_at = datetime.utcnow()
        token_row.used_at = datetime.utcnow()
        db.query(EmailVerificationToken).filter(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.id != token_row.id,
        ).delete(synchronize_session=False)
        db.commit()

        return JSONResponse(
            content={"detail": "Email verificado correctamente", "email": user.email},
            media_type="application/json; charset=utf-8",
        )
    except HTTPException as e:
        db.rollback()
        return JSONResponse(
            status_code=e.status_code,
            content={"detail": e.detail},
            headers=e.headers,
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


@router.post("/api/auth/resend-verification")
def resend_verification_email(body: ResendVerificationRequest, request: Request):
    email = normalize_email(body.email)

    SessionLocal = get_session_local()
    if SessionLocal is None:
        return JSONResponse(
            status_code=500,
            content={"detail": "Base de datos no disponible"},
            media_type="application/json; charset=utf-8",
        )

    db = SessionLocal()
    client_ip = get_client_ip(request)
    try:
        enforce_rate_limits(db, [
            RateLimitRule(
                action="auth_resend_ip",
                bucket_key=f"ip:{client_ip}",
                limit=20,
                window_seconds=3600,
                detail="Has solicitado demasiados reenvíos desde esta IP. Inténtalo más tarde.",
            ),
            RateLimitRule(
                action="auth_resend_email",
                bucket_key=f"email:{email}",
                limit=10,
                window_seconds=3600,
                detail="Ya has solicitado varios reenvíos para este email. Espera un poco antes de volver a intentarlo.",
            ),
        ])

        user = db.query(User).filter(User.email == email).first()
        if not user or user.email_verified:
            return JSONResponse(
                content={"detail": "Si existe una cuenta pendiente, te hemos enviado un nuevo correo de verificación."},
                media_type="application/json; charset=utf-8",
            )

        raw_token = _replace_email_verification_token(db, user)
        db.commit()

        try:
            _send_verification_email(user, raw_token)
        except Exception:
            return JSONResponse(
                status_code=503,
                content={"detail": "No se pudo enviar el correo de verificación. Inténtalo más tarde."},
                media_type="application/json; charset=utf-8",
            )

        return JSONResponse(
            content={"detail": "Te hemos enviado un nuevo correo de verificación."},
            media_type="application/json; charset=utf-8",
        )
    except HTTPException as e:
        db.rollback()
        return JSONResponse(
            status_code=e.status_code,
            content={"detail": e.detail},
            headers=e.headers,
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
