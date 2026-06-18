# -*- coding: utf-8 -*-
"""Cross-module integration test: the agent persists a run, the user confirms a
selection, and the saved offer is then visible through the favorites API.

Demonstrates the end-to-end flow (search -> rank -> confirm -> persist -> read
back from a different router) on in-memory SQLite, no network/AI.
"""
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


def _build_app(monkeypatch):
    from app.database import Base, get_db
    from app.models.agent_run import AgentRun
    from app.models.company_logo import CompanyLogo
    from app.models.favorite import Favorite
    from app.models.user import User
    from app.routers import agent as agent_router
    from app.routers import favorites as favorites_router
    from app.routers.user import get_current_user_record
    from app.services import agent_service

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(
        bind=engine,
        tables=[User.__table__, AgentRun.__table__, Favorite.__table__, CompanyLogo.__table__],
    )

    # agent + favorites routers use Depends(get_db) — overridden on the app below.

    async def fake_fetch(skills, locations=None, db=None):
        return [
            {"id": 1, "adzuna_id": "x1", "titulo": "React Dev", "empresa": "ACME",
             "ubicacion": "Madrid", "salario": "", "descripcion": "React"},
        ]

    def fake_match(profile, offers, api_key, db=None, user_id=None):
        return [{"id": o["id"], "resultado": "APLICA", "puntuacion": 80, "decision_reason": "ok",
                 "strengths": [], "gaps": [], "blockers": [], "skills_match": [], "skills_missing": []}
                for o in offers]

    monkeypatch.setattr(agent_router, "fetch_offers_for_search", fake_fetch)
    monkeypatch.setattr(agent_service, "match_profile_with_offers", fake_match)

    user = SimpleNamespace(id=7, email="u@u.com", is_super_admin=True, is_admin=False,
                           anos_experiencia="2", stack=["React"], ingles="b2",
                           idiomas=[], ubicaciones=[], modalidad=[])

    app = FastAPI()
    app.include_router(agent_router.router)
    app.include_router(favorites_router.router)
    app.dependency_overrides[get_db] = lambda: SessionLocal()
    app.dependency_overrides[get_current_user_record] = lambda: user
    return TestClient(app)


def test_full_agent_to_favorites_flow(monkeypatch):
    client = _build_app(monkeypatch)

    # 1) Agent search -> proposal waiting for the user.
    run = client.post("/api/agent/search", json={"instruction": "ofertas de React"}).json()["run"]
    assert run["state"] == "WAITING_FOR_USER"
    assert run["result_count"] == 1

    # 2) User confirms the offer -> persisted as a favorite, run completes.
    confirm = client.post(f"/api/agent/runs/{run['id']}/confirm", json={"offer_ids": ["x1"]}).json()
    assert confirm["saved"] == 1
    assert confirm["run"]["state"] == "COMPLETED"

    # 3) The favorite is now visible through the (separate) favorites API.
    favs = client.get("/api/favorites").json()
    assert any(f["adzuna_id"] == "x1" and f["titulo"] == "React Dev" for f in favs)
