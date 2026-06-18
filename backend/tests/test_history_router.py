# -*- coding: utf-8 -*-
"""Endpoint tests for the search-history router. Guards the save/dedup logic
(the JSONB columns are deduped in Python, never via SQL `jsonb = json`)."""
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


def _build():
    from app.database import Base, get_db
    from app.models.search_history import SearchHistory
    from app.routers import history as history_router
    from app.routers.user import get_current_user_id

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine, tables=[SearchHistory.__table__])
    session = SessionLocal()

    app = FastAPI()
    app.include_router(history_router.router)
    app.dependency_overrides[get_db] = lambda: session
    app.dependency_overrides[get_current_user_id] = lambda: 1
    return TestClient(app)


def test_history_save_get_and_dedup():
    client = _build()
    body = {"stack": ["React", "TypeScript"], "anos_experiencia": "3",
            "ubicaciones": ["Madrid"], "modalidad": ["remoto"],
            "num_aplica": 2, "num_quiza": 3, "num_no_encaja": 5}

    assert client.post("/api/history", json=body).status_code == 200
    listed = client.get("/api/history").json()
    assert len(listed) == 1 and listed[0]["stack"] == ["React", "TypeScript"]

    # Same criteria -> updates the existing row (dedup), does not duplicate.
    body2 = {**body, "num_aplica": 9}
    assert client.post("/api/history", json=body2).status_code == 200
    listed = client.get("/api/history").json()
    assert len(listed) == 1 and listed[0]["num_aplica"] == 9

    # Different stack -> new row.
    assert client.post("/api/history", json={**body, "stack": ["Python"]}).status_code == 200
    assert len(client.get("/api/history").json()) == 2
