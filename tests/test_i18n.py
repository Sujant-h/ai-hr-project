"""The language contract.

The UI is English by default and German on request, and the agents write prose
the recruiter reads. These tests pin the two rules that keep that from becoming
a logic bug: the codes the app compares on never move, and every catalogue can
render every string.
"""

from __future__ import annotations

import pytest

from agents import rules
from i18n import CATALOG, DEFAULT_LANG, _EN, edu_label, language_display, normalize_lang, tr
from models import Candidate, Requirement
from vocabulary import LANGUAGE_VOCAB, SKILL_VOCAB, canonicalize, canonicalize_all

LANGS = list(CATALOG)


def test_english_is_the_default():
    assert DEFAULT_LANG == "en"


@pytest.mark.parametrize("lang", LANGS)
def test_every_catalogue_covers_every_key(lang):
    """A missing key degrades to English rather than crashing, which is easy to
    ship without noticing — so it is asserted instead."""
    missing = set(_EN) - set(CATALOG[lang])
    assert not missing, f"{lang} is missing: {sorted(missing)}"


@pytest.mark.parametrize("lang", LANGS)
def test_no_catalogue_invents_keys(lang):
    extra = set(CATALOG[lang]) - set(_EN)
    assert not extra, f"{lang} has keys English does not: {sorted(extra)}"


def test_an_unknown_language_falls_back_to_english():
    assert normalize_lang("klingon") == "en"
    assert normalize_lang(None) == "en"
    assert tr("note.skill.met", "klingon") == tr("note.skill.met", "en")


def test_a_missing_key_returns_the_key_rather_than_raising():
    """Mid-analysis is the worst possible moment to discover a typo."""
    assert tr("no.such.key", "en") == "no.such.key"


@pytest.mark.parametrize("lang", LANGS)
def test_placeholders_are_interpolated(lang):
    assert "42" in tr("note.experience.met", lang, years=42)


def test_the_two_languages_actually_differ():
    """Guards against a catalogue that was copied and never translated."""
    assert tr("note.skill.met", "en") != tr("note.skill.met", "de")
    assert tr("email.subject", "en") != tr("email.subject", "de")


def test_edu_label_is_translated_but_the_level_is_not():
    assert edu_label(2, "en") == "Bachelor"
    assert edu_label(4, "en") == "Doctorate"
    assert edu_label(4, "de") == "Promotion"


def test_an_unmapped_education_level_is_unknown_not_a_crash():
    assert edu_label(99, "en") == tr("edu.unknown", "en")


def test_language_names_are_translated_for_display():
    assert language_display("English", "de") == "Englisch"
    assert language_display("English", "en") == "English"


def test_an_unknown_language_name_passes_through():
    """The LLM backend extracts languages as free text and is not limited to the
    rule-based vocabulary."""
    assert language_display("Klingon", "de") == "Klingon"


# --- The invariant that makes matching survive a language switch --------------


@pytest.mark.parametrize("lang", LANGS)
def test_canonical_vocabulary_never_changes_with_the_language(lang):
    """`value` and `skills` are compared across requests; a translated canonical
    would silently stop matching."""
    ad = "Python, SQL und AWS. Sehr gute Englischkenntnisse."
    reqs = rules.stellenprofil_agent(ad, lang)
    values = {r.value for r in reqs}
    assert {"Python", "SQL", "AWS", "English"} <= values


def test_a_cv_parsed_in_one_language_still_matches_requirements_from_another():
    """The recruiter can switch language between uploading a CV and running the
    analysis. The prose changes; the verdict must not."""
    cand_en = rules.cv_agent("L", "cv.txt", "Skills: Python\nSprachen: Englisch", 0, "en")
    cand_de = rules.cv_agent("L", "cv.txt", "Skills: Python\nSprachen: Englisch", 0, "de")
    assert cand_en.skills == cand_de.skills
    assert cand_en.languages == cand_de.languages

    reqs = rules.stellenprofil_agent("Python und Englisch", "de")
    en_statuses = [m.status for m in rules.matching_agent(cand_en, reqs, "en")]
    de_statuses = [m.status for m in rules.matching_agent(cand_de, reqs, "de")]
    assert en_statuses == de_statuses
    assert "erfuellt" in en_statuses


def test_canonicalize_maps_a_german_term_onto_the_english_canonical():
    """Observed against the real API: gpt-4o-mini returns "Projektmanagement" for
    a German job ad no matter how firmly the prompt asks for canonical English.
    The rule-based matcher then compares that to Candidate.skills
    (["Project Management"]) and reports a skill the CV lists as missing.
    """
    assert canonicalize("Projektmanagement", SKILL_VOCAB) == "Project Management"
    assert canonicalize("Informatik", SKILL_VOCAB) == "Computer Science"
    assert canonicalize("Englisch", LANGUAGE_VOCAB) == "English"


def test_canonicalize_is_case_and_whitespace_insensitive():
    assert canonicalize("  PROJEKTMANAGEMENT  ", SKILL_VOCAB) == "Project Management"
    assert canonicalize("project management", SKILL_VOCAB) == "Project Management"


def test_canonicalize_accepts_a_canonical_name_unchanged():
    assert canonicalize("Project Management", SKILL_VOCAB) == "Project Management"
    assert canonicalize("Python", SKILL_VOCAB) == "Python"


def test_canonicalize_all_drops_the_duplicates_collapsing_creates():
    """Observed against the real API: a CV listing "Projektmanagement, Scrum"
    canonicalizes to "Project Management" twice, because both are synonyms of it.
    The UI keys its skill badges on the name and counts the list, so a duplicate
    means a React key collision and an inflated "skills detected" figure.
    """
    assert canonicalize_all(["Projektmanagement", "Scrum"], SKILL_VOCAB) == ["Project Management"]


def test_canonicalize_all_preserves_order():
    """Reordering a candidate's skills would read as a ranking."""
    assert canonicalize_all(["SQL", "Python", "Docker"], SKILL_VOCAB) == ["SQL", "Python", "Docker"]


def test_canonicalize_all_drops_empty_terms():
    assert canonicalize_all(["Python", "", "   "], SKILL_VOCAB) == ["Python"]


def test_canonicalize_passes_an_unknown_term_through():
    """The LLM is not limited to this vocabulary. Dropping a skill it found would
    be worse than showing it in the model's own words."""
    assert canonicalize("Rust", SKILL_VOCAB) == "Rust"
    assert canonicalize("Klingon", LANGUAGE_VOCAB) == "Klingon"


def test_a_german_skill_value_still_matches_an_english_skill_list():
    """The end-to-end shape of the bug: an LLM-extracted requirement whose value
    came back German, matched by the rule-based agent on the fallback path."""
    cand = Candidate(
        id="c0", name="T", source="cv", raw_text="Skills: Projektmanagement",
        skills=[canonicalize("Projektmanagement", SKILL_VOCAB)],
    )
    req = Requirement(
        id="r0", label="Projektmanagement", kind="skill",
        value=canonicalize("Projektmanagement", SKILL_VOCAB),
    )
    assert rules.matching_agent(cand, [req], "de")[0].status == "erfuellt"


@pytest.mark.parametrize("lang", LANGS)
def test_status_and_importance_codes_are_never_translated(lang):
    cand = Candidate(id="c", name="L", source="t", raw_text="Skills: Python", skills=["Python"])
    reqs = [Requirement(id="r0", label="Python", kind="skill", value="Python", importance="muss")]
    matches = rules.matching_agent(cand, reqs, lang)

    assert matches[0].status == "erfuellt"
    assert matches[0].importance == "muss"


@pytest.mark.parametrize("lang", LANGS)
def test_the_question_for_a_gap_is_chosen_by_kind_not_by_label(lang):
    """Every gap kind must produce its own question in every language. Dispatch
    used to read German label prefixes, which made this silently impossible."""
    cand = rules.cv_agent("L", "cv.txt", "Skills: Java", 0, lang)  # no e-mail, no years
    reqs = rules.stellenprofil_agent("Python. Englisch. Bachelor. 5 Jahre.", lang)
    matches = rules.matching_agent(cand, reqs, lang)
    gaps = rules.informationsluecken_agent(cand, matches, lang)
    questions = rules.rueckfragen_agent(cand, gaps, lang)

    kinds = {g.kind for g in gaps}
    assert {"contact", "experience_years", "language", "education"} <= kinds
    # One question per distinct gap, and none of them fell through to the
    # generic skill wording by accident.
    assert len(questions) == len({g.requirement_label for g in gaps})
    assert len(set(questions)) == len(questions)
