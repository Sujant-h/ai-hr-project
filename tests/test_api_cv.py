from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import llm_agents
from api.main import MAX_UPLOAD_BYTES, app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(llm_agents, "llm_available", lambda: False)
    return TestClient(app)


CV_TEXT = "Name: Lena Hoffmann\nE-Mail: lena@example.com\nSkills: Python, SQL\n"


def test_a_pasted_cv_becomes_a_structured_candidate(client):
    response = client.post("/api/cv", data={"name": "Lena Hoffmann", "text": CV_TEXT, "index": 0})
    assert response.status_code == 200
    body = response.json()
    assert body["candidate"]["email"] == "lena@example.com"
    assert "Python" in body["candidate"]["skills"]
    assert body["backend"] == "regelbasiert"


def test_an_uploaded_text_file_becomes_a_candidate(client):
    response = client.post(
        "/api/cv",
        files={"file": ("cv.txt", CV_TEXT.encode("utf-8"), "text/plain")},
        data={"name": "Lena Hoffmann", "index": 0},
    )
    assert response.status_code == 200
    assert "Python" in response.json()["candidate"]["skills"]


def test_the_response_carries_its_own_audit_trail(client):
    response = client.post("/api/cv", data={"name": "Lena", "text": CV_TEXT, "index": 0})
    assert any(e["agent"] == "CV-Agent" for e in response.json()["audit"])


def test_an_oversized_upload_is_rejected(client):
    """Streamlit's upload cap disappears with Streamlit; pymupdf must not be
    handed unbounded input."""
    oversized = b"x" * (MAX_UPLOAD_BYTES + 1)
    response = client.post(
        "/api/cv",
        files={"file": ("big.txt", oversized, "text/plain")},
        data={"name": "X", "index": 0},
    )
    assert response.status_code == 413


def test_neither_file_nor_text_is_a_client_error(client):
    response = client.post("/api/cv", data={"name": "X", "index": 0})
    assert response.status_code == 422
