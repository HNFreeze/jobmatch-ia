# -*- coding: utf-8 -*-
"""Servicio de seguridad: emisión y validación de tokens JWT, hashing de tokens y utilidades de identificación de cliente."""
import hashlib
import os
import secrets
from datetime import datetime, timedelta

import jwt
from fastapi import HTTPException, Request


def normalize_email(email: str | None) -> str:
    return (email or "").strip().lower()


def create_access_token(user_id: int, email: str) -> str:
    secret = os.getenv("JWT_SECRET", "dev-secret-inseguro")
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": datetime.utcnow() + timedelta(days=30),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_user_id_from_token(authorization: str | None) -> int:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token requerido")

    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(
            token,
            os.getenv("JWT_SECRET", "dev-secret-inseguro"),
            algorithms=["HS256"],
        )
        return int(payload["sub"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido")


def generate_verification_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("cf-connecting-ip") or request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"
