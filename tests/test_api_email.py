from __future__ import annotations

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def _draft(questions, lang=None, email="lena@example.com"):
    candidate = {"id": "c0", "name": "Lena", "source": "cv.txt", "raw_text": "text"}
    if email is not None:
        candidate["email"] = email
    payload = {"candidate": candidate, "questions": questions}
    if lang is not None:
        payload["lang"] = lang
    return client.post("/api/email", json=payload)


def test_an_email_draft_is_generated_from_the_selected_questions():
    response = _draft(["How many years of Python?"])
    assert response.status_code == 200
    body = response.json()
    assert body["to"] == "lena@example.com"
    assert body["subject"] == "Questions about your application"
    assert "Dear Lena," in body["body"]
    assert "1. How many years of Python?" in body["body"]


def test_the_draft_is_written_in_the_requested_language():
    """The draft is sent to a candidate, so it follows the recruiter's choice —
    it is the one piece of generated prose that leaves the building."""
    body = _draft(["Wie viele Jahre Python?"], lang="de").json()
    assert body["subject"] == "Rückfragen zu Ihrer Bewerbung"
    assert "Sehr geehrte/r Lena," in body["body"]
    assert "Mit freundlichen Grüßen" in body["body"]
    assert "1. Wie viele Jahre Python?" in body["body"]


def test_the_draft_defaults_to_english_when_no_language_is_sent():
    assert _draft(["Q?"]).json()["subject"] == "Questions about your application"


def test_a_candidate_without_an_email_gets_the_placeholder_recipient():
    """cv_agent leaves email None when the CV never stated one; the draft is for
    human review, so it carries a placeholder rather than failing."""
    assert _draft(["Frage?"], email=None).json()["to"] == "applicant@example.com"


def test_the_placeholder_recipient_follows_the_language_too():
    assert _draft(["Frage?"], lang="de", email=None).json()["to"] == "bewerber@example.com"


def test_no_selected_questions_still_produces_a_draft():
    response = _draft([])
    assert response.status_code == 200
    assert "Kind regards" in response.json()["body"]
