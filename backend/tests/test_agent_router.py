# -*- coding: utf-8 -*-
"""End-to-end flow test for the agent router (search -> confirm -> favorite).

Runs against in-memory SQLite with the offer source and matching engine
monkeypatched, so no network or AI is involved.
"""
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


def _build_client(monkeypatch, user_id=1, session_local=None):
    from app.database import Base, get_db
    from app.models.agent_run import AgentRun
    from app.models.favorite import Favorite
    from app.models.user import User
    from app.routers import agent as agent_router
    from app.routers.user import get_current_user_record
    from app.services import agent_service

    if session_local is None:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        Base.metadata.create_all(bind=engine, tables=[User.__table__, AgentRun.__table__, Favorite.__table__])
    TestingSessionLocal = session_local

    async def fake_fetch(skills, locations=None, db=None):
        return [
            {"id": 1, "adzuna_id": "a1", "titulo": "React Dev", "empresa": "X",
             "ubicacion": "Madrid", "salario": "", "descripcion": "React"},
            {"id": 2, "adzuna_id": "a2", "titulo": "Go Dev", "empresa": "Y",
             "ubicacion": "Remoto", "salario": "", "descripcion": "Golang"},
        ]

    def fake_match(profile, offers, api_key, db=None, user_id=None):
        return [
            {"id": o["id"], "resultado": "APLICA", "puntuacion": 78, "decision_reason": "ok",
             "strengths": [], "gaps": [], "blockers": [], "skills_match": [], "skills_missing": []}
            for o in offers
        ]

    monkeypatch.setattr(agent_router, "fetch_offers_for_search", fake_fetch)
    monkeypatch.setattr(agent_service, "match_profile_with_offers", fake_match)

    # Super admin skips quota + rate limiting, isolating the agent logic.
    user = SimpleNamespace(
        id=user_id, email="t@t.com", is_super_admin=True, is_admin=False,
        anos_experiencia="3", stack=["React"], ingles="b2", idiomas=[], ubicaciones=[], modalidad=[],
    )

    app = FastAPI()
    app.include_router(agent_router.router)
    app.dependency_overrides[get_db] = lambda: TestingSessionLocal()
    app.dependency_overrides[get_current_user_record] = lambda: user
    return TestClient(app), TestingSessionLocal


def test_agent_search_then_confirm_saves_favorite(monkeypatch):
    client, SessionLocal = _build_client(monkeypatch)

    resp = client.post("/api/agent/search", json={"instruction": "Busco ofertas de React en remoto"})
    assert resp.status_code == 200, resp.text
    run = resp.json()["run"]
    assert run["state"] == "WAITING_FOR_USER"
    assert run["result_count"] == 2
    assert run["plan"] and len(run["plan"]) == 6
    run_id = run["id"]

    # Confirm one offer -> it becomes a favorite, run completes.
    confirm = client.post(f"/api/agent/runs/{run_id}/confirm", json={"offer_ids": ["a1"]})
    assert confirm.status_code == 200, confirm.text
    body = confirm.json()
    assert body["saved"] == 1
    assert body["run"]["state"] == "COMPLETED"

    from app.models.favorite import Favorite
    db = SessionLocal()
    try:
        favs = db.query(Favorite).all()
        assert len(favs) == 1
        assert favs[0].adzuna_id == "a1"
    finally:
        db.close()


def test_confirm_rejected_when_not_waiting(monkeypatch):
    client, _ = _build_client(monkeypatch)
    run = client.post("/api/agent/search", json={"instruction": "React remoto"}).json()["run"]
    run_id = run["id"]
    client.post(f"/api/agent/runs/{run_id}/confirm", json={"offer_ids": ["a1"]})
    # Second confirm should be rejected (already COMPLETED).
    again = client.post(f"/api/agent/runs/{run_id}/confirm", json={"offer_ids": ["a2"]})
    assert again.status_code == 409


def test_run_is_owner_scoped(monkeypatch):
    client_a, shared = _build_client(monkeypatch, user_id=1)
    run = client_a.post("/api/agent/search", json={"instruction": "React"}).json()["run"]

    # A different user, same database, must not be able to read another user's run.
    client_b, _ = _build_client(monkeypatch, user_id=999, session_local=shared)
    resp = client_b.get(f"/api/agent/runs/{run['id']}")
    assert resp.status_code == 404


def test_cancel_run(monkeypatch):
    client, _ = _build_client(monkeypatch)
    run = client.post("/api/agent/search", json={"instruction": "React"}).json()["run"]
    resp = client.post(f"/api/agent/runs/{run['id']}/cancel")
    assert resp.status_code == 200
    assert resp.json()["run"]["state"] == "CANCELLED"
