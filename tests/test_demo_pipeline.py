"""End-to-end smoke test of the rule-based agent pipeline on the demo data.

This is the path "✨ Demo-Daten laden" exercises, minus the Streamlit session
state. It runs every agent in sequence and asserts the contract the UI relies on.
"""

from __future__ import annotations

from api.demo_data import DEMO_CVS, DEMO_JOB
from agents import rules
from models import EDU_LEVELS


def _run_pipeline():
    requirements = rules.stellenprofil_agent(DEMO_JOB)
    candidates = [
        rules.cv_agent(name, "Demo-Daten", text, i) for i, (name, text) in enumerate(DEMO_CVS)
    ]
    for cand in candidates:
        cand.matches = rules.matching_agent(cand, requirements)
        cand.gaps = rules.informationsluecken_agent(cand, cand.matches)
        cand.questions = rules.rueckfragen_agent(cand, cand.gaps)
    return requirements, candidates


def test_demo_job_yields_the_expected_requirements():
    requirements = rules.stellenprofil_agent(DEMO_JOB)
    labels = {r.label for r in requirements}

    assert {"Python", "SQL", "AWS", "Docker"} <= labels
    assert "5+ Jahre Berufserfahrung" in labels
    assert "Bildungsabschluss: Bachelor" in labels
    assert {"Sprache: Deutsch", "Sprache: Englisch"} <= labels


def test_demo_job_marks_scrum_line_as_optional():
    """'Projektmanagement und Scrum wünschenswert' is a nice-to-have."""
    requirements = rules.stellenprofil_agent(DEMO_JOB)
    pm = next(r for r in requirements if r.label == "Projektmanagement")
    assert pm.importance == "kann"


def test_demo_candidates_are_extracted():
    _, candidates = _run_pipeline()
    lena, tomas, sarah = candidates

    assert lena.name == "Lena Hoffmann"
    assert lena.email == "lena.hoffmann@example.com"
    assert lena.years == 7
    assert lena.education == EDU_LEVELS["master"]
    assert {"Python", "SQL", "AWS", "Docker"} <= set(lena.skills)

    assert tomas.years == 3
    assert tomas.education == EDU_LEVELS["bachelor"]
    assert tomas.email is None  # no e-mail in this CV — drives a gap + question

    assert sarah.education == EDU_LEVELS["bachelor"]
    assert sarah.years is None


def test_every_requirement_gets_exactly_one_match_per_candidate():
    """The UI renders one checklist row per requirement — nothing may be dropped."""
    requirements, candidates = _run_pipeline()
    for cand in candidates:
        assert len(cand.matches) == len(requirements)
        assert [m.requirement_id for m in cand.matches] == [r.id for r in requirements]


def test_strong_candidate_meets_the_core_requirements():
    _, candidates = _run_pipeline()
    lena = candidates[0]
    by_label = {m.label: m.status for m in lena.matches}

    assert by_label["Python"] == "erfuellt"
    assert by_label["5+ Jahre Berufserfahrung"] == "erfuellt"
    assert by_label["Bildungsabschluss: Bachelor"] == "erfuellt"  # Master exceeds Bachelor


def test_partial_experience_is_flagged_partial_not_failed():
    """Tomas has 3 of 5 years — that is 'teilweise', never a rejection."""
    _, candidates = _run_pipeline()
    tomas = candidates[1]
    by_label = {m.label: m.status for m in tomas.matches}
    assert by_label["5+ Jahre Berufserfahrung"] == "teilweise"


def test_missing_contact_details_produce_a_question():
    _, candidates = _run_pipeline()
    tomas = candidates[1]
    assert any(g.requirement_label == "Kontaktdaten" for g in tomas.gaps)
    assert any("E-Mail-Adresse" in q for q in tomas.questions)


def test_agents_never_rank_or_score_candidates():
    """The human-in-the-loop premise: the agents expose no score and no order."""
    _, candidates = _run_pipeline()
    for cand in candidates:
        for match in cand.matches:
            assert match.status in ("erfuellt", "teilweise", "offen", "nicht_erfuellt")
        assert not hasattr(cand, "score")
        assert not hasattr(cand, "rank")


def test_email_draft_is_composed_but_not_sent():
    _, candidates = _run_pipeline()
    lena = candidates[0]
    to, subject, body = rules.generate_email(lena, lena.questions[:2])

    assert to == "lena.hoffmann@example.com"
    assert subject
    assert lena.name in body
    for question in lena.questions[:2]:
        assert question in body
