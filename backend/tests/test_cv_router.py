# -*- coding: utf-8 -*-
import json
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


def _sample_cv_json(name="Ana Developer"):
    return {
        "personal": {"name": name, "title": "Backend Developer"},
        "summary": "Perfil con experiencia en Python, APIs y automatizacion.",
        "experience": [
            {
                "id": "exp_1",
                "company": "Acme",
                "role": "Backend Developer",
                "period": "2022-Actualidad",
                "location": "Madrid",
                "bullets": [
                    "Desarrollo de APIs en FastAPI",
                    "Automatizacion de procesos internos",
                    "Optimizacion de consultas SQL",
                ],
            }
        ],
        "education": [{"id": "edu_1", "degree": "Ingenieria Informatica", "institution": "UPM", "year": "2021"}],
        "skills": [{"category": "Backend", "items": ["Python", "FastAPI", "SQLAlchemy", "PostgreSQL"]}],
        "languages": [{"language": "Español", "level": "Nativo"}, {"language": "Ingles", "level": "C1"}],
        "projects": [{"id": "proj_1", "name": "JobMatch IA", "url": "", "bullets": ["Motor de matching", "Generacion de CV"], "flagged": False}],
        "certifications": [{"name": "AWS Practitioner", "year": "2024"}],
        "meta": {"selected_template": "professional_modern", "fit_one_page": False},
    }


def _build_client(monkeypatch):
    from app.database import Base
    from app.models.cv_ats_result import CVAtsResult
    from app.models.cv_edit_session import CVEditSession
    from app.models.cv_improvement import CVImprovement
    from app.models.cv_offer_variant import CVOfferVariant
    from app.models.user import User
    from app.routers import cv as cv_router
    from app.routers.user import get_current_user_record

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(
        bind=engine,
        tables=[
            User.__table__,
            CVAtsResult.__table__,
            CVImprovement.__table__,
            CVEditSession.__table__,
            CVOfferVariant.__table__,
        ],
    )

    monkeypatch.setattr(cv_router, "get_session_local", lambda: TestingSessionLocal)

    user = SimpleNamespace(id=1, nombre="Ana", alias="ana")
    app = FastAPI()
    app.include_router(cv_router.router)
    app.dependency_overrides[get_current_user_record] = lambda: user

    with TestingSessionLocal() as db:
        db.add(
            User(
                id=1,
                email="ana@example.com",
                password_hash="hash",
                alias="ana",
                nombre="Ana",
                email_verified=True,
            )
        )
        db.add(
            CVImprovement(
                id=1,
                user_id=1,
                ats_result_id=None,
                improved_cv_text="CV mejorado legacy",
                cv_structured_json=json.dumps(_sample_cv_json(), ensure_ascii=False),
                ats_score_before=48,
                ats_score_after=79,
                meta_json=json.dumps({"keywords_to_add": ["Python", "FastAPI"]}, ensure_ascii=False),
            )
        )
        db.add(
            CVEditSession(
                id=1,
                user_id=1,
                improvement_id=1,
                edited_cv_json=json.dumps(_sample_cv_json(name="Ana Editada"), ensure_ascii=False),
                action_log_json=json.dumps([{"type": "manual_edit"}], ensure_ascii=False),
            )
        )
        db.commit()

    return TestClient(app), TestingSessionLocal, cv_router


def test_create_variant_uses_latest_edit_session(monkeypatch):
    client, SessionLocal, _router = _build_client(monkeypatch)

    response = client.post(
        "/api/cv/improvement/1/variants",
        json={
            "offer": {
                "adzuna_id": "adz-123",
                "titulo": "Senior Backend Developer",
                "empresa": "Acme Labs",
                "url": "https://example.com/jobs/1",
                "resultado": "APLICA",
                "offer_requirements": {
                    "critical": ["Python", "FastAPI"],
                    "required_skill_years": [{"skill": "Python", "years": 3, "required": True}],
                },
            }
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["created"] is True
    assert payload["variant"]["offer_adzuna_id"] == "adz-123"
    assert payload["cv_json"]["personal"]["name"] == "Ana Editada"
    assert payload["cv_json"]["meta"]["variant_name"] == "Senior Backend Developer · Acme Labs"
    assert payload["cv_json"]["meta"]["target_offer"]["empresa"] == "Acme Labs"
    assert payload["cv_json"]["meta"]["target_offer"]["offer_requirements"]["critical"][0] == "Python"

    with SessionLocal() as db:
        from app.models.cv_offer_variant import CVOfferVariant

        variant = db.query(CVOfferVariant).filter(CVOfferVariant.improvement_id == 1).one()
        assert variant.name == "Senior Backend Developer · Acme Labs"


def test_variant_edit_round_trip_is_isolated(monkeypatch):
    client, SessionLocal, _router = _build_client(monkeypatch)
    create_response = client.post(
        "/api/cv/improvement/1/variants",
        json={"offer": {"adzuna_id": "adz-456", "titulo": "Python Developer", "empresa": "Globex"}},
    )
    variant_id = create_response.json()["variant"]["id"]

    updated_json = create_response.json()["cv_json"]
    updated_json["summary"] = "Resumen enfocado a Python y APIs."
    updated_json["meta"]["variant_name"] = "Python Developer · Globex"

    save_response = client.put(
        f"/api/cv/improvement/1/edit?variant_id={variant_id}",
        json={"edited_cv_json": updated_json, "action_log": [{"type": "variant_update"}]},
    )
    assert save_response.status_code == 200

    variant_response = client.get(f"/api/cv/improvement/1/edit?variant_id={variant_id}")
    base_response = client.get("/api/cv/improvement/1/edit")

    assert variant_response.status_code == 200
    assert base_response.status_code == 200
    assert variant_response.json()["source"] == "variant"
    assert variant_response.json()["cv_json"]["summary"] == "Resumen enfocado a Python y APIs."
    assert base_response.json()["cv_json"]["summary"] != "Resumen enfocado a Python y APIs."

    with SessionLocal() as db:
        from app.models.cv_offer_variant import CVOfferVariant

        variant = db.query(CVOfferVariant).filter(CVOfferVariant.id == variant_id).one()
        assert variant.name == "Python Developer · Globex"


def test_download_pdf_uses_variant_template_and_fit_one_page(monkeypatch):
    client, SessionLocal, router = _build_client(monkeypatch)
    create_response = client.post(
        "/api/cv/improvement/1/variants",
        json={"offer": {"adzuna_id": "adz-789", "titulo": "Platform Engineer", "empresa": "Umbrella"}},
    )
    variant_id = create_response.json()["variant"]["id"]

    with SessionLocal() as db:
        from app.models.cv_offer_variant import CVOfferVariant

        variant = db.query(CVOfferVariant).filter(CVOfferVariant.id == variant_id).one()
        variant_json = json.loads(variant.edited_cv_json)
        variant_json["meta"]["selected_template"] = "ats_minimal"
        variant_json["meta"]["fit_one_page"] = True
        variant.edited_cv_json = json.dumps(variant_json, ensure_ascii=False)
        db.commit()

    captured = {}

    def fake_generate_cv_pdf_from_json(cv_json, candidate_name="", template="professional_modern", fit_one_page=False):
        captured["cv_json"] = cv_json
        captured["candidate_name"] = candidate_name
        captured["template"] = template
        captured["fit_one_page"] = fit_one_page
        return b"%PDF-1.4 test"

    monkeypatch.setattr(router, "generate_cv_pdf_from_json", fake_generate_cv_pdf_from_json)
    monkeypatch.setattr(router, "generate_cv_pdf", lambda *_args, **_kwargs: b"%PDF-1.4 fallback")

    response = client.get(f"/api/cv/download-pdf/1?variant_id={variant_id}")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert captured["template"] == "ats_minimal"
    assert captured["fit_one_page"] is True
    assert captured["cv_json"]["meta"]["variant_name"] == "Platform Engineer · Umbrella"


def test_optimize_variant_for_offer_updates_variant(monkeypatch):
    client, SessionLocal, router = _build_client(monkeypatch)
    create_response = client.post(
        "/api/cv/improvement/1/variants",
        json={"offer": {"adzuna_id": "adz-opt", "titulo": "Backend Python", "empresa": "Acme"}},
    )
    variant_id = create_response.json()["variant"]["id"]

    monkeypatch.setenv("CLAUDE_API_KEY", "test-key")
    monkeypatch.setattr(router, "consume_ai_quota", lambda db, user, action: {"cv_improve_remaining": 1, "used": 1})

    async def fake_optimize(cv_json, offer_snapshot, api_key, user_id=None):
        next_json = json.loads(json.dumps(cv_json))
        next_json["summary"] = "Resumen optimizado para Backend Python."
        next_json.setdefault("meta", {})["fit_one_page"] = True
        return (
            {
                "focus_summary": "He priorizado Python y APIs.",
                "changes_applied": ["Resumen orientado a Python", "Version mas compacta"],
                "cv_structured_json": next_json,
            },
            SimpleNamespace(input_tokens=100, output_tokens=50),
        )

    monkeypatch.setattr(router, "optimize_cv_json_for_offer", fake_optimize)

    response = client.post(f"/api/cv/improvement/1/optimize-for-offer?variant_id={variant_id}")

    assert response.status_code == 200
    payload = response.json()
    assert payload["optimized"] is True
    assert payload["cv_json"]["summary"] == "Resumen optimizado para Backend Python."
    assert payload["changes_applied"][0] == "Resumen orientado a Python"

    with SessionLocal() as db:
        from app.models.cv_offer_variant import CVOfferVariant

        variant = db.query(CVOfferVariant).filter(CVOfferVariant.id == variant_id).one()
        stored_json = json.loads(variant.edited_cv_json)
        stored_log = json.loads(variant.action_log_json)
        assert stored_json["summary"] == "Resumen optimizado para Backend Python."
        assert stored_json["meta"]["fit_one_page"] is True
        assert stored_log[-1]["type"] == "offer_optimize_ai"


def test_my_improvements_include_variant_summaries(monkeypatch):
    client, _SessionLocal, _router = _build_client(monkeypatch)
    client.post(
        "/api/cv/improvement/1/variants",
        json={"offer": {"adzuna_id": "adz-999", "titulo": "Data Engineer", "empresa": "Initech"}},
    )

    response = client.get("/api/cv/my-improvements")

    assert response.status_code == 200
    payload = response.json()
    assert payload["improvements"][0]["variant_count"] == 1
    assert payload["improvements"][0]["variants"][0]["offer_company"] == "Initech"


def test_compact_cv_data_limits_content():
    from app.services.cv_pdf_service import _compact_cv_data

    long_cv = _sample_cv_json()
    long_cv["summary"] = " ".join(["Resumen"] * 200)
    long_cv["experience"] = [
        {
            "id": f"exp_{index}",
            "company": f"Empresa {index}",
            "role": "Backend Developer",
            "bullets": [f"Bullet {index}-{bullet} " + ("x" * 160) for bullet in range(4)],
        }
        for index in range(6)
    ]
    long_cv["projects"] = [
        {"id": f"proj_{index}", "name": f"Proyecto {index}", "bullets": [("y" * 140)] * 4}
        for index in range(4)
    ]
    long_cv["certifications"] = [{"name": f"Cert {index}", "year": "2024"} for index in range(6)]

    compact = _compact_cv_data(long_cv)

    assert len(compact["experience"]) == 4
    assert all(len(experience["bullets"]) <= 2 for experience in compact["experience"])
    assert len(compact["projects"]) == 2
    assert all(len(project["bullets"]) <= 2 for project in compact["projects"])
    assert len(compact["certifications"]) == 3
    assert len(compact["summary"]) < len(long_cv["summary"])
