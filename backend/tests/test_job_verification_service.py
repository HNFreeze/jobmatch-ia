# -*- coding: utf-8 -*-
from datetime import datetime, timedelta
from types import SimpleNamespace

from app.services.job_verification_service import classify_offer_check_result, needs_offer_verification


def test_classify_offer_check_result_detects_closed_offer_content():
    result = classify_offer_check_result(200, "Lo sentimos, esta oferta ya no esta disponible.")

    assert result["status"] == "inactive"
    assert result["reason"] == "closure_hint"


def test_classify_offer_check_result_treats_404_as_inactive():
    result = classify_offer_check_result(404, "")

    assert result["status"] == "inactive"
    assert result["reason"] == "http_404"


def test_needs_offer_verification_when_last_check_is_old():
    now = datetime(2026, 4, 2, 12, 0, 0)
    row = SimpleNamespace(
        is_active=True,
        canonical_url="https://empresa.com/jobs/1",
        url="https://empresa.com/jobs/1",
        last_verified_at=now - timedelta(hours=30),
    )

    assert needs_offer_verification(row, now=now, stale_hours=24) is True


def test_needs_offer_verification_skips_inactive_offers():
    now = datetime(2026, 4, 2, 12, 0, 0)
    row = SimpleNamespace(
        is_active=False,
        canonical_url="https://empresa.com/jobs/1",
        url="https://empresa.com/jobs/1",
        last_verified_at=now - timedelta(hours=50),
    )

    assert needs_offer_verification(row, now=now, stale_hours=24) is False
