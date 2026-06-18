# -*- coding: utf-8 -*-
"""Unit tests for the personal job-search agent service.

These tests never hit the network: the offer-search callable is injected and
the matching engine / Anthropic client are monkeypatched. They run on the
in-memory SQLite session from conftest.
"""
import asyncio
import json
from types import SimpleNamespace

import pytest

from app.models.agent_run import (
    AGENT_STATE_FILTERING,
    AGENT_STATE_INTERPRETING,
    AGENT_STATE_SEARCHING,
    AGENT_STATE_WAITING_FOR_USER,
)
from app.services import agent_service
from app.services.agent_service import (
    SearchInstruction,
    build_plan,
    diversify_by_company,
    fallback_interpretation,
    interpret_instruction,
    prefilter_offers,
    run_agent_search,
)


def test_diversify_by_company_caps_without_dropping():
    offers = [{"id": i, "empresa": "Cabify"} for i in range(5)] + [{"id": 99, "empresa": "Otra"}]
    out = diversify_by_company(offers, max_per_company=2)
    # Nothing is dropped; the capped ones move to the end.
    assert len(out) == 6
    top3 = [o["empresa"] for o in out[:3]]
    assert top3.count("Cabify") == 2  # capped at 2 in the primary block
    assert "Otra" in top3             # the other company surfaces near the top


# ── SearchInstruction validation ─────────────────────────────────────────────
def test_search_instruction_cleans_and_clamps():
    instr = SearchInstruction.model_validate(
        {
            "roles": ["Frontend", "Frontend", "  "],
            "skills": ["React", "react"],
            "locations": ["Madrid"],
            "remote_allowed": True,
            "salary_min": "22000",
            "max_age_days": "7",
            "seniority": ["junior", "BOGUS", "senior"],
        }
    )
    assert instr.roles == ["Frontend"]
    assert instr.skills == ["React"]  # case-insensitive dedupe
    assert instr.salary_min == 22000  # coerced from string
    assert instr.max_age_days == 7
    assert instr.seniority == ["junior", "senior"]  # bogus dropped


def test_search_instruction_rejects_bad_numbers():
    instr = SearchInstruction.model_validate({"salary_min": "abc", "max_age_days": -5})
    assert instr.salary_min is None
    assert instr.max_age_days is None


# ── Deterministic fallback ────────────────────────────────────────────────────
def test_fallback_interpretation_extracts_signals():
    instr = fallback_interpretation(
        "Busco ofertas junior de React y Python en remoto", {"stack": [], "ubicaciones": []}
    )
    assert "React" in instr.skills
    assert "Python" in instr.skills
    assert instr.remote_allowed is True
    assert "junior" in instr.seniority


def test_fallback_uses_profile_stack_when_no_skills_in_text():
    instr = fallback_interpretation("quiero algo interesante", {"stack": ["Go", "Kafka"]})
    assert instr.skills == ["Go", "Kafka"]


def test_interpret_without_api_key_uses_fallback():
    instr, source, calls = interpret_instruction("React remoto", {"stack": []}, api_key=None)
    assert source == "fallback"
    assert calls == 0
    assert "React" in instr.skills


# ── AI interpretation (mocked client) ─────────────────────────────────────────
class _FakeMessage:
    def __init__(self, text):
        self.content = [SimpleNamespace(text=text)]
        self.usage = None
        self.id = "msg_test"


def _fake_client_returning(text):
    class _Messages:
        def create(self, **kwargs):
            return _FakeMessage(text)

    class _Client:
        def __init__(self, *a, **k):
            self.messages = _Messages()

    return _Client


def test_interpret_ai_valid_json(monkeypatch):
    payload = json.dumps(
        {"roles": ["Backend"], "skills": ["Python"], "locations": ["Madrid"],
         "remote_allowed": False, "salary_min": 30000, "max_age_days": 14, "seniority": ["mid"]}
    )
    monkeypatch.setattr(agent_service.anthropic, "Anthropic", _fake_client_returning(payload))
    instr, source, calls = interpret_instruction("...", {"stack": []}, api_key="fake")
    assert source == "ai"
    assert calls == 1
    assert instr.skills == ["Python"]
    assert instr.salary_min == 30000


def test_interpret_ai_invalid_json_falls_back(monkeypatch):
    monkeypatch.setattr(agent_service.anthropic, "Anthropic", _fake_client_returning("lo siento, no puedo"))
    instr, source, calls = interpret_instruction("React en Madrid", {"stack": []}, api_key="fake")
    assert source == "fallback"
    assert calls == 0
    assert "React" in instr.skills


# ── Deterministic pre-filtering ───────────────────────────────────────────────
def test_prefilter_drops_low_salary_and_old_offers():
    filters = SearchInstruction(salary_min=30000, max_age_days=7)
    offers = [
        {"id": 1, "salario": "20.000 - 25.000 EUR", "fecha_publicacion": ""},   # too low
        {"id": 2, "salario": "35000 EUR", "fecha_publicacion": ""},             # ok
        {"id": 3, "salario": "", "fecha_publicacion": "2000-01-01T00:00:00Z"},  # too old
        {"id": 4, "salario": "", "fecha_publicacion": ""},                       # unknown -> kept
    ]
    kept, discarded = prefilter_offers(offers, filters)
    kept_ids = {o["id"] for o in kept}
    assert kept_ids == {2, 4}
    assert len(discarded) == 2


def test_build_plan_mentions_hard_constraints():
    plan = build_plan(SearchInstruction(skills=["React"], salary_min=25000, max_age_days=7))
    steps = {p["step"] for p in plan}
    assert {"interpretar", "buscar", "filtrar", "analizar", "priorizar", "confirmar"} <= steps
    filtrar = next(p for p in plan if p["step"] == "filtrar")
    assert "25000" in filtrar["detail"]


# ── State machine end-to-end (no network) ─────────────────────────────────────
def test_run_agent_search_reaches_waiting_state(db_session, monkeypatch):
    user = SimpleNamespace(id=1)

    async def fake_fetch(skills, locations=None, db=None):
        return [
            {"id": 1, "adzuna_id": "a1", "titulo": "React Developer", "empresa": "X",
             "ubicacion": "Madrid", "salario": "", "descripcion": "React TypeScript"},
            {"id": 2, "adzuna_id": "a2", "titulo": "Backend Go", "empresa": "Y",
             "ubicacion": "Remoto", "salario": "", "descripcion": "Golang remoto"},
        ]

    def fake_match(profile, offers, api_key, db=None, user_id=None):
        return [
            {"id": o["id"], "resultado": "APLICA", "puntuacion": 80,
             "decision_reason": "ok", "strengths": ["x"], "gaps": [], "blockers": [],
             "skills_match": ["React"], "skills_missing": []}
            for o in offers
        ]

    monkeypatch.setattr(agent_service, "match_profile_with_offers", fake_match)

    run = asyncio.run(
        run_agent_search(
            db=db_session,
            user=user,
            instruction="Busco ofertas de React en remoto",
            api_key=None,  # forces deterministic interpretation
            profile={"stack": ["React"], "experience": "3", "english": "b2",
                     "ubicaciones": [], "modalidad": [], "idiomas": []},
            fetch_offers=fake_fetch,
        )
    )

    assert run.state == AGENT_STATE_WAITING_FOR_USER
    assert run.offers_found == 2
    assert run.result_count == 2
    assert run.interpretation_source == "fallback"
    # The plan and the state trace are persisted for traceability.
    plan = json.loads(run.plan_json)
    assert len(plan) == 6
    log_states = [entry["state"] for entry in json.loads(run.step_log_json)]
    for expected in (AGENT_STATE_INTERPRETING, AGENT_STATE_SEARCHING, AGENT_STATE_FILTERING):
        assert expected in log_states
    results = json.loads(run.results_json)
    assert results[0]["decision_reason"] == "ok"


def test_run_agent_search_handles_no_offers(db_session, monkeypatch):
    user = SimpleNamespace(id=2)

    async def empty_fetch(skills, locations=None, db=None):
        return []

    run = asyncio.run(
        run_agent_search(
            db=db_session,
            user=user,
            instruction="algo imposible",
            api_key=None,
            profile={"stack": [], "experience": "", "english": "",
                     "ubicaciones": [], "modalidad": [], "idiomas": []},
            fetch_offers=empty_fetch,
        )
    )
    assert run.state == AGENT_STATE_WAITING_FOR_USER
    assert run.result_count == 0
