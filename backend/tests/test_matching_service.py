# -*- coding: utf-8 -*-
from app.services.matching_service import _evaluate_offer_match, _heuristic_offer_signals, _sort_by_fit


def test_sort_by_fit_prioritizes_reliable_verified_offer():
    profile = {
        "stack": ["Python", "FastAPI", "SQL"],
        "experience": "3",
        "english": "c1",
        "idiomas": [{"idioma": "Ingles", "nivel": "C1"}],
        "ubicaciones": ["Madrid"],
        "modalidad": ["Remoto", "Hibrido"],
    }
    signals = {
        "required_skills": ["python"],
        "preferred_skills": ["fastapi"],
        "normalized_role": "backend",
        "seniority_level": "mid",
        "required_years_min": 2,
        "language_requirements": [],
        "work_mode": "hybrid",
    }

    reliable_offer = {
        "id": 1,
        "titulo": "Backend Python Engineer",
        "empresa": "Acme",
        "ubicacion": "Madrid",
        "descripcion": "Python FastAPI SQL",
        "salario": "40k-45k",
        "source_type": "official_api",
        "source_confidence": 0.96,
        "freshness_state": "verified_recently",
        "verified_recently": True,
        "url": "https://example.com/jobs/1",
    }
    weak_offer = {
        "id": 2,
        "titulo": "Backend Python Engineer",
        "empresa": "Acme Mirror",
        "ubicacion": "Madrid",
        "descripcion": "Python FastAPI SQL",
        "salario": "Salario no especificado",
        "source_type": "aggregator",
        "source_confidence": 0.51,
        "freshness_state": "stale_listing",
        "verified_recently": False,
        "url": "https://example.com/jobs/2",
    }

    reliable_result = _evaluate_offer_match(profile, reliable_offer, signals)
    weak_result = _evaluate_offer_match(profile, weak_offer, signals)

    ranked = _sort_by_fit([weak_result, reliable_result])

    assert reliable_result["ranking_score"] > weak_result["ranking_score"]
    assert ranked[0]["id"] == 1
    assert "fuente oficial" in reliable_result["quality_notes"]


def test_heuristic_offer_signals_extracts_skill_years_and_constraints():
    offer = {
        "id": 1,
        "titulo": "Backend Python Engineer",
        "descripcion": (
            "Imprescindible experiencia con Python y FastAPI. "
            "Buscamos 3+ anos con Python y 2 anos con Docker. "
            "Posicion presencial en Madrid con guardias rotativas."
        ),
        "ubicacion": "Madrid",
        "salario": "40k-50k",
    }

    signals = _heuristic_offer_signals(offer)

    assert "Python" in signals["required_skills"]
    assert signals["required_years_min"] == 3
    assert any(item["skill"] == "Python" and item["years"] == 3 for item in signals["required_skill_years"])
    assert any("presencial" in item.lower() for item in signals["hard_constraints"])
    assert any("imprescindible" in item.lower() for item in signals["must_have_requirements"])


def test_evaluate_offer_match_uses_skill_depth_requirements_as_blocker():
    profile = {
        "stack": ["Python", "Docker"],
        "experience": "1",
        "english": "",
        "idiomas": [],
        "ubicaciones": ["Madrid"],
        "modalidad": ["Presencial"],
    }
    offer = {
        "id": 9,
        "titulo": "Backend Python Engineer",
        "empresa": "Acme",
        "ubicacion": "Madrid",
        "descripcion": "Python y Docker",
        "salario": "45k",
        "source_type": "official_api",
        "source_confidence": 0.91,
        "freshness_state": "verified_recently",
        "verified_recently": True,
        "url": "https://example.com/jobs/9",
    }
    signals = {
        "required_skills": ["Python", "Docker"],
        "preferred_skills": [],
        "critical_requirements": ["Python", "Docker"],
        "must_have_requirements": ["Experiencia fuerte en APIs"],
        "hard_constraints": ["Presencial en Madrid"],
        "required_skill_years": [{"skill": "Python", "years": 3, "required": True}],
        "normalized_role": "backend",
        "seniority_level": "mid",
        "required_years_min": 2,
        "required_languages": [],
        "work_mode": "onsite",
        "location_constraints": ["Madrid"],
    }

    result = _evaluate_offer_match(profile, offer, signals)

    assert result["resultado"] == "NO_ENCAJA"
    assert any("3+ anos con Python" in item for item in result["blockers"])
    assert result["offer_requirements"]["required_skill_years"][0]["years"] == 3
