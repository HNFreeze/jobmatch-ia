# -*- coding: utf-8 -*-
"""Endpoint tests for the favorites router (CRUD + owner scoping) on in-memory SQLite."""
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


def _build(monkeypatch, user_id=1, session_local=None):
    from app.database import Base, get_db
    from app.models.company_logo import CompanyLogo
    from app.models.favorite import Favorite
    from app.routers import favorites as fav_router
    from app.routers.user import get_current_user_id

    if session_local is None:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        Base.metadata.create_all(bind=engine, tables=[Favorite.__table__, CompanyLogo.__table__])

    app = FastAPI()
    app.include_router(fav_router.router)
    # The router now uses Depends(get_db); override it (a fresh session per request).
    app.dependency_overrides[get_db] = lambda: session_local()
    app.dependency_overrides[get_current_user_id] = lambda: user_id
    return TestClient(app), session_local


def test_favorites_crud_flow(monkeypatch):
    client, _ = _build(monkeypatch)

    assert client.get("/api/favorites").json() == []

    add = client.post("/api/favorites", json={"adzuna_id": "f1", "titulo": "React Dev", "empresa": "ACME"})
    assert add.status_code == 200

    listed = client.get("/api/favorites").json()
    assert len(listed) == 1 and listed[0]["adzuna_id"] == "f1"

    # Idempotent: adding the same offer again does not duplicate.
    client.post("/api/favorites", json={"adzuna_id": "f1"})
    assert len(client.get("/api/favorites").json()) == 1

    rm = client.delete("/api/favorites?adzuna_id=f1")
    assert rm.status_code == 200
    assert client.get("/api/favorites").json() == []


def test_favorites_are_owner_scoped(monkeypatch):
    client_a, shared = _build(monkeypatch, user_id=1)
    client_a.post("/api/favorites", json={"adzuna_id": "x1", "titulo": "A"})

    client_b, _ = _build(monkeypatch, user_id=2, session_local=shared)
    # User 2 must not see user 1's favorite.
    assert client_b.get("/api/favorites").json() == []
