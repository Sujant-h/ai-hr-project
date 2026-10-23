"""The API must work with no API key and no network — same as the rest of the
suite. These two endpoints never touch OpenAI at all."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import llm_agents
from api.main import app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(llm_agents, "llm_available", lambda: False)
    return TestClient(app)


def test_health_endpoint_is_ok(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_backend_endpoint_reports_the_rule_based_backend(client):
    response = client.get("/api/backend")
    assert response.status_code == 200
    assert response.json() == {"label": "rule-based", "is_llm": False}


def test_backend_endpoint_defaults_to_english(client):
    """English is the product's default; German is opt-in."""
    assert client.get("/api/backend").json()["label"] == "rule-based"


def test_backend_label_follows_the_requested_language(client):
    assert client.get("/api/backend?lang=de").json()["label"] == "regelbasiert"


def test_is_llm_does_not_depend_on_the_language(client):
    """The label is translated; the flag the UI branches on must not be."""
    for lang in ("en", "de"):
        assert client.get(f"/api/backend?lang={lang}").json()["is_llm"] is False


def test_an_unknown_language_falls_back_rather_than_failing(client):
    response = client.get("/api/backend?lang=klingon")
    assert response.status_code == 422


def test_demo_endpoint_serves_the_seed_data(client):
    response = client.get("/api/demo")
    assert response.status_code == 200
    body = response.json()
    assert "Senior Backend Developer" in body["job_text"]
    assert len(body["cvs"]) == 3
    assert body["cvs"][0]["name"] == "Lena Hoffmann"
    assert "lena.hoffmann@example.com" in body["cvs"][0]["text"]


def test_demo_endpoint_serves_a_german_job_ad_in_german(client):
    """The demo shows the agents reading a realistic document, so the document
    itself is in the recruiter's language rather than translated on the fly."""
    body = client.get("/api/demo?lang=de").json()
    assert "Senior Backend Entwickler" in body["job_text"]
    assert len(body["cvs"]) == 3
    assert body["cvs"][0]["name"] == "Lena Hoffmann"
