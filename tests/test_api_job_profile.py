from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import llm_agents
from api.main import app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(llm_agents, "llm_available", lambda: False)
    return TestClient(app)


def test_requirements_are_extracted_from_a_job_ad(client):
    response = client.post("/api/job-profile", json={"text": "Python und SQL erforderlich"})
    assert response.status_code == 200
    body = response.json()
    labels = [r["label"] for r in body["requirements"]]
    assert "Python" in labels
    assert body["backend"] == "regelbasiert"


def test_the_response_carries_its_own_audit_trail(client):
    """The API is stateless: the transparency record travels in the response,
    because there is nowhere on the server to keep it."""
    response = client.post("/api/job-profile", json={"text": "Python erforderlich"})
    entries = response.json()["audit"]
    assert any(e["agent"] == "Stellenprofil-Agent" for e in entries)
    assert all(e["timestamp"] for e in entries)


def test_empty_input_is_accepted_and_yields_no_requirements(client):
    response = client.post("/api/job-profile", json={"text": ""})
    assert response.status_code == 200
    assert response.json()["requirements"] == []
