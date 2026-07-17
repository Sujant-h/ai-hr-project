"""Tests for how information gaps are derived and prioritised."""

from __future__ import annotations

from agents import rules
from models import Candidate, MatchResult


def _match(label: str, importance: str, status: str = "offen") -> MatchResult:
    return MatchResult(
        requirement_id=label,
        label=label,
        kind="skill",
        importance=importance,
        status=status,
        note="Nicht im Lebenslauf erwähnt.",
    )


def _candidate() -> Candidate:
    return Candidate(
        id="c0", name="Test", source="t", raw_text="x", email="a@b.de", years=5
    )


def test_gap_carries_the_importance_of_its_requirement():
    """A missing nice-to-have must not look like a missing hard requirement."""
    gaps = rules.informationsluecken_agent(
        _candidate(), [_match("Python", "muss"), _match("Kubernetes", "kann")]
    )
    by_label = {g.requirement_label: g.importance for g in gaps}
    assert by_label["Python"] == "muss"
    assert by_label["Kubernetes"] == "kann"


def test_must_have_gaps_are_listed_first():
    gaps = rules.informationsluecken_agent(
        _candidate(), [_match("Kubernetes", "kann"), _match("Python", "muss")]
    )
    assert [g.requirement_label for g in gaps] == ["Python", "Kubernetes"]


def test_optional_gaps_are_kept_not_dropped():
    """The recruiter still chooses which questions to send, so an optional gap is
    worth surfacing — just not with the same urgency."""
    gaps = rules.informationsluecken_agent(_candidate(), [_match("Kubernetes", "kann")])
    assert len(gaps) == 1


def test_satisfied_requirements_produce_no_gap():
    gaps = rules.informationsluecken_agent(
        _candidate(), [_match("Python", "muss", status="erfuellt")]
    )
    assert gaps == []


def test_missing_contact_details_are_treated_as_a_must():
    cand = Candidate(id="c0", name="T", source="t", raw_text="x", email=None, years=5)
    gaps = rules.informationsluecken_agent(cand, [])
    contact = next(g for g in gaps if g.kind == "contact")
    assert contact.importance == "muss"
