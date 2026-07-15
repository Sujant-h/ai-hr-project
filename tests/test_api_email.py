from __future__ import annotations

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_an_email_draft_is_generated_from_the_selected_questions():
    response = client.post(
        "/api/email",
        json={
            "candidate": {
                "id": "c0", "name": "Lena", "source": "cv.txt",
                "raw_text": "text", "email": "lena@example.com",
            },
            "questions": ["Wie viele Jahre Python?"],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["to"] == "lena@example.com"
    assert body["subject"] == "Rückfragen zu Ihrer Bewerbung"
    assert "Sehr geehrte/r Lena," in body["body"]
    assert "1. Wie viele Jahre Python?" in body["body"]


def test_a_candidate_without_an_email_gets_the_placeholder_recipient():
    """cv_agent leaves email None when the CV never stated one; the draft is for
    human review, so it carries a placeholder rather than failing."""
    response = client.post(
        "/api/email",
        json={
            "candidate": {"id": "c0", "name": "Lena", "source": "cv.txt", "raw_text": "text"},
            "questions": ["Frage?"],
        },
    )
    assert response.json()["to"] == "bewerber@example.com"


def test_no_selected_questions_still_produces_a_draft():
    response = client.post(
        "/api/email",
        json={
            "candidate": {"id": "c0", "name": "Lena", "source": "cv.txt", "raw_text": "text"},
            "questions": [],
        },
    )
    assert response.status_code == 200
    assert "Mit freundlichen Grüßen" in response.json()["body"]
