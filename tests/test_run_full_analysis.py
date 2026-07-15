"""Integration tests for run_full_analysis.

This is where parallelism, caching and the audit trail meet, so it is where a
mistake would be both severe and quiet: results attached to the wrong candidate,
or a cache that re-bills every run.
"""

from __future__ import annotations

import pytest

import app
import llm_agents
from api import orchestration
from models import Candidate, MatchResult, Requirement


@pytest.fixture
def session(monkeypatch):
    class FakeState(dict):
        __getattr__ = dict.get

        def __setattr__(self, key, value):
            self[key] = value

    state = FakeState()
    state.update(
        {
            "requirements": [
                Requirement(id="r0", label="Python", kind="skill", value="Python", importance="muss")
            ],
            "candidates": [
                Candidate(id=f"c{i}", name=f"Cand {i}", source="t", raw_text=f"CV number {i}")
                for i in range(3)
            ],
            "audit": [],
            "analysis_cache": {},
            "analysis_done": False,
        }
    )
    monkeypatch.setattr(app.st, "session_state", state)
    monkeypatch.setattr(llm_agents, "llm_available", lambda: False)
    return state


def _match_for(cand: Candidate) -> app.AgentRun:
    """A dispatcher stub whose output identifies the candidate it was given."""
    return app.AgentRun(
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
        backend="regelbasiert",
    )


def test_each_candidate_gets_its_own_matches(session, monkeypatch):
    """Guards the parallel path: every candidate must receive the result computed
    from its own CV, not a neighbour's."""
    monkeypatch.setattr(orchestration, "match_candidate", lambda cand, reqs: _match_for(cand))

    app.run_full_analysis()

    for cand in session["candidates"]:
        assert cand.matches[0].note == f"evidence from {cand.raw_text}"


def test_analysis_is_marked_done_and_downstream_agents_ran(session, monkeypatch):
    monkeypatch.setattr(orchestration, "match_candidate", lambda cand, reqs: _match_for(cand))

    app.run_full_analysis()

    assert session["analysis_done"] is True
    for cand in session["candidates"]:
        # informationsluecken_agent + rueckfragen_agent ran: no e-mail in these
        # CVs, so each candidate has a contact-details gap and a question.
        assert any(g.requirement_label == "Kontaktdaten" for g in cand.gaps)
        assert cand.questions


def test_second_run_is_served_from_cache(session, monkeypatch):
    """Re-running an unchanged analysis must not call the backend again."""
    calls = []

    def counting_match(cand, reqs):
        calls.append(cand.id)
        return _match_for(cand)

    monkeypatch.setattr(orchestration, "match_candidate", counting_match)

    app.run_full_analysis()
    assert len(calls) == 3

    app.run_full_analysis()
    assert len(calls) == 3, f"cache miss: re-billed {len(calls) - 3} extra call(s)"


def test_changing_the_job_profile_invalidates_the_cache(session, monkeypatch):
    calls = []

    def counting_match(cand, reqs):
        calls.append(cand.id)
        return _match_for(cand)

    monkeypatch.setattr(orchestration, "match_candidate", counting_match)

    app.run_full_analysis()
    assert len(calls) == 3

    session["requirements"] = [
        Requirement(id="r1", label="Java", kind="skill", value="Java", importance="muss")
    ]
    app.run_full_analysis()
    assert len(calls) == 6, "new requirements must be re-matched, not served from cache"


def test_a_failed_llm_call_is_retried_on_the_next_run(session, monkeypatch):
    """Fallback results are not cached, so a transient API error does not pin the
    candidate to rule-based output for the rest of the session."""
    calls = []

    def failing_match(cand, reqs):
        calls.append(cand.id)
        run = _match_for(cand)
        run.fallback_reason = "API timeout"
        return run

    monkeypatch.setattr(orchestration, "match_candidate", failing_match)

    app.run_full_analysis()
    app.run_full_analysis()
    assert len(calls) == 6, "a fallback must not be cached"


def test_fallbacks_reach_the_audit_log(session, monkeypatch):
    def failing_match(cand, reqs):
        run = _match_for(cand)
        run.fallback_reason = "API timeout"
        return run

    monkeypatch.setattr(orchestration, "match_candidate", failing_match)

    app.run_full_analysis()

    details = [e.detail for e in session["audit"]]
    assert any("API timeout" in d for d in details)
