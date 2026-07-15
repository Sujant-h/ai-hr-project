"""Tests for the LLM -> rule-based fallback dispatchers.

This is the path most worth testing and, before the dispatchers were made pure,
the one that could not be tested at all: they wrote fallbacks straight into
st.session_state, so exercising them needed a Streamlit runtime.
"""

from __future__ import annotations

import pytest

import llm_agents
from agents.dispatch import AgentRun, analyze_cv, analyze_job_profile, match_candidate
from models import Candidate, Requirement


@pytest.fixture
def llm_enabled(monkeypatch):
    monkeypatch.setattr(llm_agents, "llm_available", lambda: True)
    monkeypatch.setattr(llm_agents, "DEFAULT_MODEL", "test-model")


@pytest.fixture
def llm_disabled(monkeypatch):
    monkeypatch.setattr(llm_agents, "llm_available", lambda: False)


# --- No API key: rule-based backend, no fallback recorded --------------------


def test_without_an_api_key_the_rule_based_backend_is_used(llm_disabled):
    run = analyze_job_profile("Python und SQL erforderlich")
    assert run.backend == "regelbasiert"
    assert run.fallback_reason is None
    assert {r.label for r in run.result} >= {"Python", "SQL"}


# --- LLM succeeds ------------------------------------------------------------


def test_successful_llm_call_reports_the_llm_backend(llm_enabled, monkeypatch):
    sentinel = [Requirement(id="x", label="Python", kind="skill", value="Python")]
    monkeypatch.setattr(llm_agents, "stellenprofil_agent_llm", lambda text: sentinel)

    run = analyze_job_profile("egal")
    assert run.result is sentinel
    assert run.backend == "LLM (test-model)"
    assert run.fallback_reason is None


# --- LLM fails: fall back to rules and report why ----------------------------


def _raise_llm_error(*args, **kwargs):
    raise llm_agents.LLMError("API timeout")


def test_job_profile_falls_back_to_rules_on_llm_error(llm_enabled, monkeypatch):
    monkeypatch.setattr(llm_agents, "stellenprofil_agent_llm", _raise_llm_error)

    run = analyze_job_profile("Python und SQL erforderlich")
    assert run.backend == "regelbasiert"
    assert "API timeout" in run.fallback_reason
    assert {r.label for r in run.result} >= {"Python", "SQL"}, "fallback must still produce results"


def test_cv_falls_back_to_rules_on_llm_error(llm_enabled, monkeypatch):
    monkeypatch.setattr(llm_agents, "cv_agent_llm", _raise_llm_error)

    run = analyze_cv("Test", "cv.txt", "Name: Test\nSkills: Python", 0)
    assert run.backend == "regelbasiert"
    assert "API timeout" in run.fallback_reason
    assert "Python" in run.result.skills


def test_matching_falls_back_to_rules_on_llm_error(llm_enabled, monkeypatch):
    monkeypatch.setattr(llm_agents, "matching_agent_llm", _raise_llm_error)
    cand = Candidate(id="c0", name="Test", source="t", raw_text="Skills: Python", skills=["Python"])
    reqs = [Requirement(id="r0", label="Python", kind="skill", value="Python")]

    run = match_candidate(cand, reqs)
    assert run.backend == "regelbasiert"
    assert "API timeout" in run.fallback_reason
    assert run.result[0].status == "erfuellt"


def test_an_llm_error_never_escapes_to_the_caller(llm_enabled, monkeypatch):
    """A failing API must degrade to the rule-based agent, never break the app."""
    monkeypatch.setattr(llm_agents, "cv_agent_llm", _raise_llm_error)
    run = analyze_cv("Test", "cv.txt", "Skills: Python", 0)
    assert run.result is not None


# --- Fallbacks reach the audit trail ----------------------------------------


def test_a_successful_run_logs_no_fallback():
    from api.orchestration import fallback_entries
    assert fallback_entries("CV-Agent", AgentRun(result=None, backend="LLM (x)")) == []


def test_a_failed_run_logs_the_reason():
    from api.orchestration import fallback_entries
    entries = fallback_entries(
        "CV-Agent", AgentRun(result=None, backend="regelbasiert", fallback_reason="boom")
    )
    assert [e.detail for e in entries] == ["boom"]
