# -*- coding: utf-8 -*-
"""Endpoint tests for the alerts router — also verifies the Depends(get_db)
migration works at runtime (the override targets get_db, not get_session_local)."""
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


def _build():
    from app.database import Base, get_db
    from app.models.job_alert import JobAlert
    from app.routers import alerts as alerts_router
    from app.routers.user import get_current_user_record

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine, tables=[JobAlert.__table__])
    session = SessionLocal()

    app = FastAPI()
    app.include_router(alerts_router.router)
    app.dependency_overrides[get_db] = lambda: session
    app.dependency_overrides[get_current_user_record] = lambda: SimpleNamespace(id=1)
    return TestClient(app)


def test_alert_upsert_get_delete_flow():
    client = _build()

    assert client.get("/api/alerts/mine").json()["alert"] is None

    created = client.put("/api/alerts/mine", json={"min_score_threshold": 75, "email_frequency": "weekly", "is_active": True})
    assert created.status_code == 200
    assert created.json()["alert"]["min_score_threshold"] == 75

    got = client.get("/api/alerts/mine").json()["alert"]
    assert got is not None and got["email_frequency"] == "weekly"

    client.delete("/api/alerts/mine")
    assert client.get("/api/alerts/mine").json()["alert"]["is_active"] is False
