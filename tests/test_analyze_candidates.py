"""Tests for the pure analysis core.

This is where parallelism and the audit trail meet, so it is where a mistake
would be both severe and quiet: results attached to the wrong candidate, or a
per-candidate fallback hidden behind a batch-level label.
"""

from __future__ import annotations

import pytest

import llm_agents
from agents.dispatch import AgentRun
from api import orchestration
from api.orchestration import analyze_candidates
from models import Candidate, MatchResult, Requirement


@pytest.fixture(autouse=True)
def no_api_key(monkeypatch):
    monkeypatch.setattr(llm_agents, "llm_available", lambda: False)


@pytest.fixture
def reqs():
    return [Requirement(id="r0", label="Python", kind="skill", value="Python", importance="muss")]


@pytest.fixture
def candidates():
    return [
        Candidate(id=f"c{i}", name=f"Cand {i}", source="t", raw_text=f"CV number {i}")
        for i in range(3)
    ]


def _match_for(cand: Candidate, fallback: str = None) -> AgentRun:
    """A dispatcher stub whose output identifies the candidate it was given."""
    return AgentRun(
        result=[
            MatchResult(
                requirement_id="r0",
                label="Python",
                kind="skill",
                importance="muss",
                status="erfuellt",
                note=f"evidence from {cand.raw_text}",
            )
        ],
        backend="rule-based",
        fallback_reason=fallback,
    )


def test_each_candidate_gets_its_own_matches(monkeypatch, reqs, candidates):
    """Guards the parallel path: every candidate must receive the result computed
    from its own CV, not a neighbour's."""
    monkeypatch.setattr(orchestration, "match_candidate", lambda c, r, lang='en': _match_for(c))

    analyses, _ = analyze_candidates(reqs, candidates)

    for analysis in analyses:
        cand = analysis.candidate
        assert cand.matches[0].note == f"evidence from {cand.raw_text}"


def test_downstream_agents_ran(monkeypatch, reqs, candidates):
    monkeypatch.setattr(orchestration, "match_candidate", lambda c, r, lang='en': _match_for(c))

    analyses, _ = analyze_candidates(reqs, candidates)

    for analysis in analyses:
        # informationsluecken_agent + rueckfragen_agent ran: no e-mail in these
        # CVs, so each candidate has a contact-details gap and a question.
        assert any(g.kind == "contact" for g in analysis.candidate.gaps)
        assert analysis.candidate.questions


def test_a_fallback_is_reported_per_candidate(monkeypatch, reqs, candidates):
    """The client's cache must never store a fallback, so it needs to know which
    individual candidates fell back — a batch label cannot say that."""
    def sometimes_fails(cand, _reqs, lang='en'):
        return _match_for(cand, fallback="API timeout" if cand.id == "c1" else None)

    monkeypatch.setattr(orchestration, "match_candidate", sometimes_fails)

    analyses, _ = analyze_candidates(reqs, candidates)

    assert [a.fallback_reason for a in analyses] == [None, "API timeout", None]


def test_fallbacks_reach_the_audit_entries(monkeypatch, reqs, candidates):
    monkeypatch.setattr(orchestration, "match_candidate", lambda c, r, lang='en': _match_for(c, "API timeout"))

    _, entries = analyze_candidates(reqs, candidates)

    assert any("API timeout" in e.detail for e in entries)


def test_analyze_candidates_does_not_claim_a_batch_it_cannot_see(monkeypatch, reqs, candidates):
    """Callers pass only their uncached candidates, so this function never sees
    the whole batch and must not describe one."""
    monkeypatch.setattr(orchestration, "match_candidate", lambda c, r, lang='en': _match_for(c))

    _, entries = analyze_candidates(reqs, candidates)

    assert not any(e.action == "Requirements compared" for e in entries)


def test_no_candidates_is_handled(monkeypatch, reqs):
    analyses, entries = analyze_candidates(reqs, [])
    assert analyses == []
    assert entries == []


def test_the_batch_summary_counts_every_backend_it_is_given(reqs):
    """The caller holds cached and fresh results together, so it passes the full
    backend list — including the backends that produced cached results."""
    entries = orchestration.batch_summary_entries(reqs, ["rule-based"] * 3)

    summary = [e for e in entries if e.action == "Requirements compared"]
    assert len(summary) == 1
    assert "3 candidate(s)" in summary[0].detail
    assert "1 requirement(s)" in summary[0].detail
    assert "3x rule-based" in summary[0].detail


def test_the_batch_summary_reports_a_mixed_batch_honestly(reqs):
    """The exact bug test_audit.py guards: one candidate falling back must not be
    hidden behind whichever backend ran last."""
    entries = orchestration.batch_summary_entries(reqs, ["rule-based", "LLM (gpt-4o-mini)"])

    detail = entries[0].detail
    assert "1x rule-based" in detail
    assert "1x LLM (gpt-4o-mini)" in detail


def test_the_batch_summary_includes_the_local_agent_entries(reqs):
    entries = orchestration.batch_summary_entries(reqs, ["rule-based"])
    actions = [e.action for e in entries]
    assert "Gaps analyzed" in actions
    assert "Follow-up questions generated" in actions
