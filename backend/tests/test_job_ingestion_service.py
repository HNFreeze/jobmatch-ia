# -*- coding: utf-8 -*-
from app.services.job_ingestion_service import normalize_requested_sources, prepare_ingestion_payload


def test_normalize_requested_sources_filters_invalid_values():
    assert normalize_requested_sources(["public_sources", "foo", "adzuna"]) == ["public_sources", "adzuna"]


def test_prepare_ingestion_payload_uses_defaults_when_empty():
    payload = prepare_ingestion_payload({})

    assert payload["skills"]
    assert payload["locations"]
    assert payload["sources"]


def test_prepare_ingestion_payload_keeps_manual_values():
    payload = prepare_ingestion_payload({
        "skills": ["python", "react"],
        "locations": ["Madrid"],
        "sources": ["adzuna"],
    })

    assert payload == {
        "skills": ["python", "react"],
        "locations": ["Madrid"],
        "sources": ["adzuna"],
    }
