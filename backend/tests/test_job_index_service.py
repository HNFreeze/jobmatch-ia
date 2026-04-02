# -*- coding: utf-8 -*-
from datetime import datetime, timedelta

from app.services.job_index_service import (
    annotate_offer_freshness,
    build_offer_dedupe_key,
    compute_effective_source_confidence,
    compute_source_confidence,
    matches_requested_locations,
    normalize_offer_record,
)
from app.services.job_search_service import _dedupe_and_sort_offers


def test_compute_source_confidence_prioritizes_official_sources():
    official_offer = {
        "source_type": "official_api",
        "ubicacion": "Madrid, Espana",
        "descripcion": "Python y FastAPI",
        "redirect_url": "https://empresa.com/jobs/1",
        "salario": "40k-50k",
        "fecha_publicacion": "2026-04-01T10:00:00Z",
    }
    aggregator_offer = {
        "source_type": "aggregator",
        "ubicacion": "Madrid, Espana",
        "descripcion": "Python y FastAPI",
        "redirect_url": "https://agregador.com/jobs/1",
        "salario": "40k-50k",
        "fecha_publicacion": "2026-04-01T10:00:00Z",
    }

    assert compute_source_confidence(official_offer) > compute_source_confidence(aggregator_offer)


def test_matches_requested_locations_accepts_spain_when_no_filter():
    assert matches_requested_locations("Barcelona, Espana", None, description="Modalidad hibrida")
    assert not matches_requested_locations("Berlin, Germany", None, description="Remote EU")


def test_normalize_offer_record_builds_source_aware_ids():
    offer = normalize_offer_record(
        "infojobs",
        "official_api",
        {
            "id": "abc-123",
            "title": "Backend Developer",
            "company": "Acme",
            "location": "Madrid",
            "description": "Python, FastAPI y PostgreSQL",
            "jobUrl": "https://empresa.com/jobs/backend",
        },
    )

    assert offer["adzuna_id"] == "infojobs:abc-123"
    assert offer["source_name"] == "infojobs"
    assert offer["source_type"] == "official_api"
    assert offer["canonical_url"] == "https://empresa.com/jobs/backend"
    assert offer["url"] == "https://empresa.com/jobs/backend"


def test_build_offer_dedupe_key_uses_canonical_url_when_available():
    offer = {
        "titulo": "Backend Developer",
        "empresa": "Acme",
        "ubicacion": "Madrid",
        "canonical_url": "https://empresa.com/jobs/backend",
    }

    assert build_offer_dedupe_key(offer) == "url::https://empresa.com/jobs/backend"


def test_dedupe_and_sort_prefers_more_reliable_source():
    official = normalize_offer_record(
        "infojobs",
        "official_api",
        {
            "id": "1",
            "title": "Backend Developer",
            "company": "Acme",
            "location": "Madrid, Espana",
            "jobUrl": "https://empresa.com/jobs/backend",
            "description": "Oferta oficial",
        },
    )
    aggregator = normalize_offer_record(
        "adzuna",
        "aggregator",
        {
            "id": "2",
            "title": "Backend Developer",
            "company": "Acme",
            "location": "Madrid, Espana",
            "redirect_url": "https://empresa.com/jobs/backend",
            "description": "Oferta agregada",
        },
    )

    offers = _dedupe_and_sort_offers([aggregator, official])

    assert len(offers) == 1
    assert offers[0]["source_name"] == "infojobs"


def test_effective_confidence_penalizes_stale_verification():
    now = datetime(2026, 4, 2, 12, 0, 0)
    offer = {
        "base_source_confidence": 0.92,
        "source_confidence": 0.92,
        "last_verified_at": (now - timedelta(days=8)).isoformat(),
        "last_seen_at": (now - timedelta(days=2)).isoformat(),
        "is_active": True,
    }

    assert compute_effective_source_confidence(offer, now=now) < 0.92


def test_annotate_offer_freshness_marks_recently_verified_offer():
    now = datetime(2026, 4, 2, 12, 0, 0)
    offer = annotate_offer_freshness(
        {
            "base_source_confidence": 0.92,
            "source_confidence": 0.92,
            "last_verified_at": (now - timedelta(hours=3)).isoformat(),
            "last_seen_at": (now - timedelta(hours=6)).isoformat(),
            "first_seen_at": (now - timedelta(days=2)).isoformat(),
            "is_active": True,
        },
        now=now,
    )

    assert offer["verified_recently"] is True
    assert offer["freshness_state"] == "verified_recently"
