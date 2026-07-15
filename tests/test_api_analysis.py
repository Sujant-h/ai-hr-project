from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import llm_agents
from api.main import app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(llm_agents, "llm_available", lambda: False)
    return TestClient(app)


def _payload():
    return {
        "requirements": [
            {"id": "r0", "label": "Python", "kind": "skill", "value": "Python", "importance": "muss"}
        ],
        "candidates": [
            {
                "id": "c0",
                "name": "Lena",
                "source": "cv.txt",
                "raw_text": "Skills: Python\nBerufserfahrung: 7 Jahre",
                "skills": ["Python"],
            }
        ],
    }


def test_a_candidate_comes_back_matched_with_gaps_and_questions(client):
    response = client.post("/api/analysis", json=_payload())
    assert response.status_code == 200
    analysis = response.json()["analyses"][0]
    assert analysis["candidate"]["matches"][0]["requirement_id"] == "r0"
    assert analysis["candidate"]["gaps"] is not None
    assert analysis["backend"] == "regelbasiert"


def test_every_analysis_reports_its_own_backend(client):
    """The client owns the cache and must never store a fallback, so the backend
    is reported per candidate rather than once per batch."""
    analysis = client.post("/api/analysis", json=_payload()).json()["analyses"][0]
    assert "backend" in analysis
    assert "fallback_reason" in analysis


def test_the_response_carries_the_batch_audit_trail(client):
    entries = client.post("/api/analysis", json=_payload()).json()["audit"]
    actions = [e["action"] for e in entries]
    assert "Anforderungsabgleich durchgeführt" in actions
    assert "Lücken analysiert" in actions
    assert "Rückfragen generiert" in actions


def test_the_summary_counts_the_clients_cached_candidates_too(client):
    """The client sends only uncached candidates, so it reports the backends of
    the ones it served from cache. Otherwise the audit trail would describe only
    part of what the recruiter is looking at."""
    payload = _payload()
    payload["cached_backends"] = ["LLM (gpt-4o-mini)", "LLM (gpt-4o-mini)"]

    entries = client.post("/api/analysis", json=payload).json()["audit"]

    summary = next(e for e in entries if e["action"] == "Anforderungsabgleich durchgeführt")
    assert "3 Kandidat(en)" in summary["detail"]
    assert "2x LLM (gpt-4o-mini)" in summary["detail"]
    assert "1x regelbasiert" in summary["detail"]


def test_a_fully_cached_rerun_still_reports_every_candidate(client):
    """The regression this guards: nothing to recompute must not mean "0
    Kandidat(en) geprüft" while N candidates sit on screen."""
    payload = _payload()
    payload["candidates"] = []
    payload["cached_backends"] = ["regelbasiert"] * 3

    response = client.post("/api/analysis", json=payload)

    assert response.status_code == 200
    assert response.json()["analyses"] == []
    summary = next(
        e for e in response.json()["audit"] if e["action"] == "Anforderungsabgleich durchgeführt"
    )
    assert "3 Kandidat(en)" in summary["detail"]


def test_cached_backends_defaults_to_empty(client):
    """A first run has nothing cached; the field must be optional."""
    response = client.post("/api/analysis", json=_payload())
    assert response.status_code == 200
