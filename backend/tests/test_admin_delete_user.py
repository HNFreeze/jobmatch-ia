# -*- coding: utf-8 -*-
"""Endpoint test for admin user deletion.

Regression: el borrado de usuario debe limpiar TODAS las tablas con FK a
users.id (no solo unas pocas). Si se queda una sin limpiar, en producción el
DELETE final revienta por foreign key y el usuario no se borra. Aquí se crea
un usuario con registros en varias de esas tablas (incluidas las que el
endpoint NO limpiaba antes: agent_runs, cv_analyses, interview_sessions,
match_feedback) y se comprueba que tras el borrado no queda ni rastro.
"""
from datetime import datetime

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


def _build_app(monkeypatch):
    from app.database import Base
    # Importar todos los modelos implicados para que create_all cree sus tablas
    # (el endpoint hace DELETE FROM <tabla> en todas ellas).
    from app.models.user import User  # noqa: F401
    from app.models.agent_run import AgentRun  # noqa: F401
    from app.models.ai_daily_usage import AIDailyUsage  # noqa: F401
    from app.models.application import Application  # noqa: F401
    from app.models.cv_analysis import CVAnalysis  # noqa: F401
    from app.models.cv_ats_result import CVAtsResult  # noqa: F401
    from app.models.cv_edit_session import CVEditSession  # noqa: F401
    from app.models.cv_improvement import CVImprovement  # noqa: F401
    from app.models.cv_offer_variant import CVOfferVariant  # noqa: F401
    from app.models.email_verification_token import EmailVerificationToken  # noqa: F401
    from app.models.favorite import Favorite  # noqa: F401
    from app.models.interview_session import InterviewSession  # noqa: F401
    from app.models.job_ingestion_run import JobIngestionRun  # noqa: F401
    from app.models.match_feedback import MatchFeedback  # noqa: F401
    from app.models.notification import Notification  # noqa: F401
    from app.models.rate_limit_bucket import RateLimitBucket  # noqa: F401
    from app.models.search_history import SearchHistory  # noqa: F401
    from app.routers import admin as admin_router
    from app.routers.user import require_admin_user

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    # Tabla legada SIN modelo (feature de alertas retirada): simula que sigue en
    # la BD de producción con FK a users. El borrado debe limpiarla igualmente.
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE job_alerts (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL)"))
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # El endpoint usa get_session_local() directamente: lo apuntamos a la BD de test.
    monkeypatch.setattr(admin_router, "get_session_local", lambda: SessionLocal)

    app = FastAPI()
    app.include_router(admin_router.router)
    # El admin que ejecuta el borrado es OTRO usuario (id distinto al objetivo).
    app.dependency_overrides[require_admin_user] = lambda: User(
        id=999, email="admin@admin.com", password_hash="x", is_admin=True,
    )
    return TestClient(app), SessionLocal, admin_router


def _seed_user_with_children(SessionLocal):
    from app.models.user import User
    from app.models.agent_run import AgentRun
    from app.models.application import Application
    from app.models.cv_analysis import CVAnalysis
    from app.models.favorite import Favorite
    from app.models.interview_session import InterviewSession
    from app.models.match_feedback import MatchFeedback
    from app.models.notification import Notification
    from app.models.rate_limit_bucket import RateLimitBucket

    db = SessionLocal()
    try:
        user = User(email="victima@example.com", password_hash="hash", is_admin=False)
        db.add(user)
        db.commit()
        db.refresh(user)
        uid = user.id

        db.add_all([
            # tablas que el endpoint ya limpiaba
            Favorite(user_id=uid, adzuna_id="f1"),
            Application(user_id=uid, adzuna_id="a1"),
            # tablas que NO limpiaba (causaban el fallo de FK en prod)
            AgentRun(user_id=uid, raw_instruction="busca react remoto"),
            CVAnalysis(user_id=uid, file_size_bytes=100, content_type="application/pdf",
                       structured_profile_json="{}"),
            InterviewSession(user_id=uid, job_title="Backend Dev"),
            MatchFeedback(user_id=uid, adzuna_id="a1", rating="up"),
            Notification(user_id=uid, title="hola"),
            RateLimitBucket(action="auth_register_email", bucket_key=f"email:{user.email}",
                            window_start=datetime.utcnow()),
        ])
        # Fila en la tabla legada sin modelo (FK a users).
        db.execute(text("INSERT INTO job_alerts (user_id) VALUES (:uid)"), {"uid": uid})
        db.commit()
        return uid
    finally:
        db.close()


def _count(SessionLocal, table, uid):
    db = SessionLocal()
    try:
        return db.execute(
            text(f"SELECT COUNT(*) FROM {table} WHERE user_id = :uid"), {"uid": uid}
        ).scalar()
    finally:
        db.close()


def test_delete_user_cleans_all_child_tables(monkeypatch):
    client, SessionLocal, admin_router = _build_app(monkeypatch)
    uid = _seed_user_with_children(SessionLocal)

    # Precondición: hay registros hijos repartidos por varias tablas.
    assert _count(SessionLocal, "agent_runs", uid) == 1
    assert _count(SessionLocal, "cv_analyses", uid) == 1
    assert _count(SessionLocal, "interview_sessions", uid) == 1

    resp = client.request(
        "DELETE",
        f"/api/admin/users/{uid}",
        json={"confirmation_code": admin_router.ADMIN_DELETE_CONFIRMATION_CODE},
    )
    assert resp.status_code == 200, resp.text

    # El usuario y TODOS sus registros hijos han desaparecido (incluida la
    # tabla legada job_alerts, que es la que bloqueaba el borrado en prod).
    for table in [
        "favoritos", "applications", "agent_runs", "cv_analyses",
        "interview_sessions", "match_feedback", "notifications", "job_alerts",
    ]:
        assert _count(SessionLocal, table, uid) == 0, f"quedaron filas en {table}"

    db = SessionLocal()
    try:
        assert db.execute(text("SELECT COUNT(*) FROM users WHERE id = :uid"), {"uid": uid}).scalar() == 0
        assert db.execute(
            text("SELECT COUNT(*) FROM rate_limit_buckets WHERE bucket_key = :k"),
            {"k": "email:victima@example.com"},
        ).scalar() == 0
    finally:
        db.close()


def test_delete_user_wrong_confirmation_code_is_rejected(monkeypatch):
    client, SessionLocal, _ = _build_app(monkeypatch)
    uid = _seed_user_with_children(SessionLocal)

    resp = client.request(
        "DELETE", f"/api/admin/users/{uid}", json={"confirmation_code": "codigo-incorrecto"},
    )
    assert resp.status_code == 403
    # El usuario sigue existiendo: clave incorrecta no borra nada.
    db = SessionLocal()
    try:
        assert db.execute(text("SELECT COUNT(*) FROM users WHERE id = :uid"), {"uid": uid}).scalar() == 1
    finally:
        db.close()
