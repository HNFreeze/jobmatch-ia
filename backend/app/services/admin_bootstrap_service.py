# -*- coding: utf-8 -*-
import os
from datetime import datetime

import bcrypt

from app.database import get_session_local
from app.models.user import User
from app.services.ai_quota_service import DEFAULT_DAILY_AI_QUOTA
from app.services.security_service import normalize_email


_SUPER_ADMIN_EMAIL = "sergiuswor@gmail.com"


def _ensure_super_admin(db) -> None:
    """Garantiza que sergiuswor@gmail.com tiene is_super_admin=True."""
    super_email = normalize_email(_SUPER_ADMIN_EMAIL)
    user = db.query(User).filter(User.email == super_email).first()
    if user and not user.is_super_admin:
        user.is_super_admin = True
        user.is_admin = True
        db.commit()


def ensure_bootstrap_admin() -> bool:
    admin_email = normalize_email(os.getenv("BOOTSTRAP_ADMIN_EMAIL"))
    admin_password = os.getenv("BOOTSTRAP_ADMIN_PASSWORD", "").strip()

    SessionLocal = get_session_local()
    if SessionLocal is None:
        return False

    db = SessionLocal()
    try:
        # Siempre garantizar el super admin
        try:
            _ensure_super_admin(db)
        except Exception:
            pass

        if not admin_email or not admin_password:
            return False

        user = db.query(User).filter(User.email == admin_email).first()
        if user:
            changed = False
            if not user.is_admin:
                user.is_admin = True
                changed = True
            if not user.email_verified:
                user.email_verified = True
                user.email_verified_at = user.email_verified_at or datetime.utcnow()
                changed = True
            if changed:
                db.commit()
            return changed

        hashed_password = bcrypt.hashpw(admin_password.encode(), bcrypt.gensalt()).decode()
        is_super = normalize_email(admin_email) == normalize_email(_SUPER_ADMIN_EMAIL)
        admin_user = User(
            email=admin_email,
            password_hash=hashed_password,
            alias="admin",
            nombre="Admin",
            apellidos=None,
            email_verified=True,
            email_verified_at=datetime.utcnow(),
            is_admin=True,
            is_super_admin=is_super,
            daily_ai_quota=int(os.getenv("DEFAULT_DAILY_AI_QUOTA", str(DEFAULT_DAILY_AI_QUOTA))),
        )
        db.add(admin_user)
        db.commit()
        return True
    except Exception:
        db.rollback()
        return False
    finally:
        db.close()
