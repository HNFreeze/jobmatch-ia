# -*- coding: utf-8 -*-
"""Crea (o restablece) el usuario de prueba del TFM.

Uso:  python -m app.create_demo_user

Inserta un usuario demo ya verificado y con perfil completo, para que el
revisor del TFM pueda entrar y probar el matching/agente sin registrarse ni
verificar email. Idempotente: si ya existe, restablece su contraseña y perfil.
Requiere DATABASE_URL. Ejecútalo contra la BD donde quieras el usuario
(local o la base de Render de producción).

Credenciales resultantes:
    email:    demo@jobmatch.ia
    password: DemoJobMatch2026!
"""
import sys
from datetime import datetime

import bcrypt

from app.database import get_session_local
from app.models.user import User

DEMO_EMAIL = "demo@jobmatch.ia"
DEMO_PASSWORD = "DemoJobMatch2026!"

DEMO_PROFILE = dict(
    alias="Candidato Demo",
    nombre="Candidato",
    apellidos="Demo",
    anos_experiencia="3",
    stack=["React", "TypeScript", "JavaScript", "Node.js", "CSS", "Git"],
    idiomas=[{"idioma": "Inglés", "nivel": "B2"}],
    ubicaciones=["Madrid"],
    modalidad=["Remoto"],
    stack_years={"React": 3, "TypeScript": 2, "JavaScript": 4, "Node.js": 2},
    onboarding_completed=True,
    email_verified=True,
    is_admin=False,
    is_super_admin=False,
    is_blocked=False,
    daily_ai_quota=50,  # holgada para que el revisor pueda probar las funciones de IA
)


def run() -> int:
    SessionLocal = get_session_local()
    if SessionLocal is None:
        print("DATABASE_URL no configurada — no se puede crear el usuario demo.")
        return 1

    db = SessionLocal()
    try:
        password_hash = bcrypt.hashpw(DEMO_PASSWORD.encode(), bcrypt.gensalt()).decode()
        now = datetime.utcnow()
        user = db.query(User).filter(User.email == DEMO_EMAIL).first()
        action = "actualizado" if user else "creado"
        if not user:
            user = User(email=DEMO_EMAIL)
            db.add(user)
        user.password_hash = password_hash
        user.email_verified_at = now
        for field, value in DEMO_PROFILE.items():
            setattr(user, field, value)
        db.commit()
        print(f"Usuario demo {action}: {DEMO_EMAIL} / {DEMO_PASSWORD}")
        return 0
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        print(f"Error al crear el usuario demo: {exc}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(run())
