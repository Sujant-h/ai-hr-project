"""Regression tests for the rule-based extraction agents.

Each test here pins down a bug that was found in the original implementation,
so the behaviour cannot silently regress. The agents are pure functions, so no
Streamlit runtime is needed.
"""

from __future__ import annotations

import app
from models import EDU_LEVELS


# --- Education detection -----------------------------------------------------


def test_diplomarbeit_does_not_imply_a_diplom():
    """A Bachelor candidate who wrote a 'Diplomarbeit' does not hold a Diplom.

    'diplom' matching as a substring of 'Diplomarbeit' promoted the candidate
    to Master level (3).
    """
    level, label = app._detect_education("Ausbildung: Bachelor Informatik\nDiplomarbeit über Netzwerke")
    assert level == EDU_LEVELS["bachelor"], f"expected Bachelor, got {label!r}"


def test_masterarbeit_does_not_imply_a_master():
    level, label = app._detect_education("Bachelor Informatik\nMasterarbeit noch offen")
    assert level == EDU_LEVELS["bachelor"], f"expected Bachelor, got {label!r}"


def test_bare_ausbildung_section_header_is_not_a_qualification():
    """'Ausbildung' is a near-universal CV section header — on its own it says
    nothing about a completed qualification."""
    level, label = app._detect_education("Ausbildung\n- Praktikum bei Firma X")
    assert level == 0, f"expected no qualification, got {label!r}"


def test_real_ausbildung_is_still_detected():
    level, _ = app._detect_education("Abgeschlossene Ausbildung als Fachinformatiker")
    assert level == EDU_LEVELS["ausbildung"]


def test_highest_degree_wins():
    level, _ = app._detect_education("Bachelor Informatik, danach Master Data Science")
    assert level == EDU_LEVELS["master"]


# --- German compound words ---------------------------------------------------


def test_language_stated_as_a_compound_is_found():
    """German ads say 'Englischkenntnisse', not 'Englisch'. Whole-word matching
    alone missed the language requirement entirely."""
    assert "Englisch" in app._find_terms("Sehr gute Deutsch- und Englischkenntnisse", app.LANGUAGE_VOCAB)


def test_hyphenated_compound_is_found():
    assert "Python" in app._find_terms("Python-Kenntnisse erforderlich", app.SKILL_VOCAB)
    assert "SQL" in app._find_terms("Mehrjährige SQL-Erfahrung", app.SKILL_VOCAB)


def test_compound_matching_does_not_confuse_java_with_javascript():
    """The reason bare prefix matching is not an option."""
    found = app._find_terms("Erfahrung mit JavaScript und Node", app.SKILL_VOCAB)
    assert "JavaScript" in found
    assert "Java" not in found


def test_standalone_term_still_matches():
    found = app._find_terms("Kenntnisse in Java und Docker", app.SKILL_VOCAB)
    assert "Java" in found
    assert "Docker" in found


def test_unrelated_compound_does_not_match():
    """Only the listed qualifier suffixes may follow a term."""
    assert "Java" not in app._find_terms("Wir arbeiten im Javaland", app.SKILL_VOCAB)


# --- Requirement importance --------------------------------------------------


def _importance_of(requirements: list, label: str) -> str:
    req = next((r for r in requirements if r.label == label), None)
    assert req is not None, f"{label!r} not extracted from {[r.label for r in requirements]}"
    return req.importance


def test_optional_skill_found_via_synonym_stays_optional():
    """The skill is found via a synonym ('pytorch') but importance was judged by
    searching for the canonical name ('machine learning'), which never matched —
    so the nice-to-have silently defaulted to mandatory."""
    reqs = app.stellenprofil_agent("Anforderungen:\n- PyTorch wünschenswert\n")
    assert _importance_of(reqs, "Machine Learning") == "kann"


def test_optional_skill_found_via_second_synonym_stays_optional():
    reqs = app.stellenprofil_agent("Anforderungen:\n- Scrum von Vorteil\n")
    assert _importance_of(reqs, "Projektmanagement") == "kann"


def test_mandatory_skill_stays_mandatory():
    reqs = app.stellenprofil_agent("Anforderungen:\n- Sehr gute Python-Kenntnisse\n")
    assert _importance_of(reqs, "Python") == "muss"


def test_optional_skill_found_via_canonical_name_stays_optional():
    reqs = app.stellenprofil_agent("Anforderungen:\n- Docker ist nice to have\n")
    assert _importance_of(reqs, "Docker") == "kann"


def test_importance_is_judged_per_line_not_across_the_whole_ad():
    """Two skills on separate lines must keep their own importance."""
    reqs = app.stellenprofil_agent(
        "Anforderungen:\n- Python zwingend erforderlich\n- Kubernetes wünschenswert\n"
    )
    assert _importance_of(reqs, "Python") == "muss"
    assert _importance_of(reqs, "Kubernetes") == "kann"
