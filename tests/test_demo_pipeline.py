"""End-to-end smoke test of the rule-based agent pipeline on the demo data.

This is the path "✨ Load demo data" exercises, minus the Streamlit session
state. It runs every agent in sequence and asserts the contract the UI relies on.

Most tests run in both languages: the demo is the first thing a recruiter sees,
and it has to tell the same story either way. What is EXTRACTED must be identical
across languages — only the prose differs.
"""

from __future__ import annotations

import pytest

from api.demo_data import demo_cvs, demo_job
from agents import rules
from models import EDU_LEVELS

LANGS = ["en", "de"]

# The labels the rule-based agent builds for the demo ad, per language. Skills
# are canonical English in both: they are matching keys, not prose (see
# rules.SKILL_VOCAB).
EXPECTED_LABELS = {
    "en": {
        "experience": "5+ years of experience",
        "education": "Education: Bachelor",
        "languages": {"Language: German", "Language: English"},
    },
    "de": {
        "experience": "5+ Jahre Berufserfahrung",
        "education": "Bildungsabschluss: Bachelor",
        "languages": {"Sprache: Deutsch", "Sprache: Englisch"},
    },
}


def _run_pipeline(lang="en"):
    requirements = rules.stellenprofil_agent(demo_job(lang), lang)
    candidates = [
        rules.cv_agent(name, "demo", text, i, lang)
        for i, (name, text) in enumerate(demo_cvs(lang))
    ]
    for cand in candidates:
        cand.matches = rules.matching_agent(cand, requirements, lang)
        cand.gaps = rules.informationsluecken_agent(cand, cand.matches, lang)
        cand.questions = rules.rueckfragen_agent(cand, cand.gaps, lang)
    return requirements, candidates


@pytest.mark.parametrize("lang", LANGS)
def test_demo_job_yields_the_expected_requirements(lang):
    requirements = rules.stellenprofil_agent(demo_job(lang), lang)
    labels = {r.label for r in requirements}
    expected = EXPECTED_LABELS[lang]

    assert {"Python", "SQL", "AWS", "Docker"} <= labels
    assert expected["experience"] in labels
    assert expected["education"] in labels
    assert expected["languages"] <= labels


@pytest.mark.parametrize("lang", LANGS)
def test_the_same_requirements_are_found_whatever_the_language(lang):
    """Language changes the wording, never the extraction."""
    en = rules.stellenprofil_agent(demo_job("en"), "en")
    other = rules.stellenprofil_agent(demo_job(lang), lang)

    assert [r.id for r in en] == [r.id for r in other]
    assert [r.value for r in en] == [r.value for r in other]
    assert [r.importance for r in en] == [r.importance for r in other]


@pytest.mark.parametrize("lang", LANGS)
def test_demo_job_marks_scrum_line_as_optional(lang):
    """The Scrum/project-management line is a nice-to-have in both demo ads."""
    requirements = rules.stellenprofil_agent(demo_job(lang), lang)
    pm = next(r for r in requirements if r.value == "Project Management")
    assert pm.importance == "kann"


@pytest.mark.parametrize("lang", LANGS)
def test_demo_candidates_are_extracted(lang):
    _, candidates = _run_pipeline(lang)
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


@pytest.mark.parametrize("lang", LANGS)
def test_every_requirement_gets_exactly_one_match_per_candidate(lang):
    """The UI renders one checklist row per requirement — nothing may be dropped."""
    requirements, candidates = _run_pipeline(lang)
    for cand in candidates:
        assert len(cand.matches) == len(requirements)
        assert [m.requirement_id for m in cand.matches] == [r.id for r in requirements]


@pytest.mark.parametrize("lang", LANGS)
def test_strong_candidate_meets_the_core_requirements(lang):
    _, candidates = _run_pipeline(lang)
    lena = candidates[0]
    by_id = {m.requirement_id: m.status for m in lena.matches}

    assert by_id["skill_python"] == "erfuellt"
    assert by_id["exp_years"] == "erfuellt"
    assert by_id["education"] == "erfuellt"  # Master exceeds Bachelor


@pytest.mark.parametrize("lang", LANGS)
def test_partial_experience_is_flagged_partial_not_failed(lang):
    """Tomas has 3 of 5 years — that is 'teilweise', never a rejection."""
    _, candidates = _run_pipeline(lang)
    tomas = candidates[1]
    by_id = {m.requirement_id: m.status for m in tomas.matches}
    assert by_id["exp_years"] == "teilweise"


@pytest.mark.parametrize("lang", LANGS)
def test_missing_contact_details_produce_a_question(lang):
    _, candidates = _run_pipeline(lang)
    tomas = candidates[1]
    # Asserted on the gap's kind, not its label: the label is prose and changes
    # with the language, which is precisely why the kind exists.
    assert any(g.kind == "contact" for g in tomas.gaps)
    assert tomas.questions


@pytest.mark.parametrize("lang", LANGS)
def test_agents_never_rank_or_score_candidates(lang):
    """The human-in-the-loop premise: the agents expose no score and no order."""
    _, candidates = _run_pipeline(lang)
    for cand in candidates:
        for match in cand.matches:
            assert match.status in ("erfuellt", "teilweise", "offen", "nicht_erfuellt")
        assert not hasattr(cand, "score")
        assert not hasattr(cand, "rank")


@pytest.mark.parametrize("lang", LANGS)
def test_email_draft_is_composed_but_not_sent(lang):
    _, candidates = _run_pipeline(lang)
    lena = candidates[0]
    to, subject, body = rules.generate_email(lena, lena.questions[:2], lang)

    assert to == "lena.hoffmann@example.com"
    assert subject
    assert lena.name in body
    for question in lena.questions[:2]:
        assert question in body
