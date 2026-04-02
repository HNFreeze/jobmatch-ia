# -*- coding: utf-8 -*-
import asyncio

from app.services import official_sources_service as service


class _DummyResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class _DummyAsyncClient:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url, params=None, auth=None, headers=None):
        if "recruitee.com/api/offers" in url:
            return _DummyResponse({
                "offers": [
                    {
                        "id": "job-1",
                        "title": "Backend Python Engineer",
                        "company_name": "Acme Tech",
                        "description_requirements": "<p>Python y FastAPI</p>",
                        "careers_url": "https://acme.recruitee.com/o/backend-python",
                        "updated_at": "2026-04-02T09:00:00Z",
                        "department": "Engineering",
                        "tags": ["Python", "Backend"],
                        "location": {
                            "city": "Madrid",
                            "country": "ES",
                        },
                    }
                ]
            })
        raise AssertionError(f"Unexpected URL requested during test: {url}")


def test_get_public_source_configuration_status_reports_recruitee(monkeypatch):
    monkeypatch.setenv("ADZUNA_APP_ID", "demo-id")
    monkeypatch.setenv("ADZUNA_APP_KEY", "demo-key")
    monkeypatch.setenv("RECRUITEE_COMPANY_SLUGS", "acme,foo")
    monkeypatch.delenv("GREENHOUSE_BOARD_TOKENS", raising=False)

    snapshot = service.get_public_source_configuration_status()

    recruitee = next(item for item in snapshot["sources"] if item["key"] == "recruitee")
    adzuna = next(item for item in snapshot["sources"] if item["key"] == "adzuna")

    assert adzuna["is_configured"] is True
    assert recruitee["is_configured"] is True
    assert recruitee["configured_values_count"] == 2
    assert recruitee["configured_values_preview"] == ["acme", "foo"]
    assert snapshot["overview"]["ready_sources"] >= 2


def test_fetch_offers_from_public_sources_includes_recruitee(monkeypatch):
    monkeypatch.setenv("RECRUITEE_COMPANY_SLUGS", "acme")
    monkeypatch.delenv("INFOJOBS_CLIENT_ID", raising=False)
    monkeypatch.delenv("INFOJOBS_CLIENT_SECRET", raising=False)
    monkeypatch.delenv("GREENHOUSE_BOARD_TOKENS", raising=False)
    monkeypatch.delenv("ASHBY_JOB_BOARD_NAMES", raising=False)
    monkeypatch.delenv("LEVER_SITE_NAMES", raising=False)
    monkeypatch.delenv("LEVER_EU_SITE_NAMES", raising=False)
    monkeypatch.setattr(service.httpx, "AsyncClient", _DummyAsyncClient)

    result = asyncio.run(service.fetch_offers_from_public_sources_with_details(["python"], locations=["Madrid"]))

    assert len(result["offers"]) == 1
    assert result["offers"][0]["source_name"] == "recruitee"
    assert result["offers"][0]["empresa"] == "Acme Tech"
    assert result["offers"][0]["ubicacion"] == "Madrid, ES"
    assert result["sources"][0]["source"] == "recruitee:acme"
    assert result["sources"][0]["status"] == "ok"
