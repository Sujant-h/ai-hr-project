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


def test_backend_endpoint_reports_the_rule_based_backend(client):
    response = client.get("/api/backend")
    assert response.status_code == 200
    assert response.json() == {"label": "regelbasiert"}


def test_demo_endpoint_serves_the_seed_data(client):
    response = client.get("/api/demo")
    assert response.status_code == 200
    body = response.json()
    assert "Senior Backend Entwickler" in body["job_text"]
    assert len(body["cvs"]) == 3
    assert body["cvs"][0]["name"] == "Lena Hoffmann"
    assert "lena.hoffmann@example.com" in body["cvs"][0]["text"]
