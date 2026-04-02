# -*- coding: utf-8 -*-
from app.services.matching_service import _evaluate_offer_match, _sort_by_fit


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

