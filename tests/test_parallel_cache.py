"""Tests for the parallel dispatch helper and the content-hash cache.

Candidates are analysed concurrently, so ordering and cache semantics are the
things most likely to break silently: a zip against the wrong list attaches one
candidate's results to another candidate.
"""

from __future__ import annotations

import time

import pytest

import app
import llm_agents
from api import orchestration
from models import Requirement


# --- _run_parallel -----------------------------------------------------------


def test_results_keep_input_order_not_completion_order(monkeypatch):
    """The failure this guards against is silent and severe: results attached to
    the wrong candidate. Later items finish first here."""
    monkeypatch.setattr(llm_agents, "llm_available", lambda: True)

    def slow_for_early_items(n: int) -> int:
        time.sleep((5 - n) * 0.02)
        return n

    assert orchestration._run_parallel(slow_for_early_items, [0, 1, 2, 3, 4]) == [0, 1, 2, 3, 4]


def test_empty_input_is_handled():
    assert orchestration._run_parallel(lambda x: x, []) == []


def test_single_item_runs_inline(monkeypatch):
    monkeypatch.setattr(llm_agents, "llm_available", lambda: True)
    assert orchestration._run_parallel(lambda x: x * 2, [21]) == [42]


def test_rule_based_backend_runs_inline(monkeypatch):
    """No I/O to overlap without an API key — threads would only add overhead."""
    monkeypatch.setattr(llm_agents, "llm_available", lambda: False)
    assert orchestration._run_parallel(lambda x: x + 1, [1, 2, 3]) == [2, 3, 4]


def test_exceptions_propagate(monkeypatch):
    monkeypatch.setattr(llm_agents, "llm_available", lambda: True)

    def boom(n):
        raise ValueError("boom")

    with pytest.raises(ValueError):
        orchestration._run_parallel(boom, [1, 2])


# --- cache keys --------------------------------------------------------------


def _reqs(value="Python"):
    return [Requirement(id="r0", label=value, kind="skill", value=value, importance="muss")]


def test_same_content_yields_the_same_key():
    assert app.cache_key("cv text", app.requirements_key(_reqs())) == app.cache_key(
        "cv text", app.requirements_key(_reqs())
    )


def test_different_cv_yields_a_different_key():
    reqs_key = app.requirements_key(_reqs())
    assert app.cache_key("cv one", reqs_key) != app.cache_key("cv two", reqs_key)


def test_changed_requirements_invalidate_the_key():
    """Re-analysing against a new job profile must not reuse old matches."""
    assert app.cache_key("cv", app.requirements_key(_reqs("Python"))) != app.cache_key(
        "cv", app.requirements_key(_reqs("Java"))
    )


def test_requirements_key_is_order_stable():
    a = [
        Requirement(id="r0", label="Python", kind="skill", value="Python"),
        Requirement(id="r1", label="SQL", kind="skill", value="SQL"),
    ]
    assert app.requirements_key(a) == app.requirements_key(list(a))


# --- cache put/get -----------------------------------------------------------


@pytest.fixture
def fake_session(monkeypatch):
    class FakeState(dict):
        __getattr__ = dict.get

        def __setattr__(self, key, value):
            self[key] = value

    state = FakeState()
    state["analysis_cache"] = {}
    monkeypatch.setattr(app.st, "session_state", state)
    return state


def test_successful_run_is_cached(fake_session):
    run = app.AgentRun(result="matches", backend="LLM (x)", fallback_reason=None)
    app.cache_put("k", run)
    assert app.cache_get("k") is run


def test_a_fallback_run_is_never_cached(fake_session):
    """A transient API timeout must not pin this candidate to rule-based results
    for the rest of the session — the next run should retry the LLM."""
    app.cache_put("k", app.AgentRun(result="matches", backend="regelbasiert", fallback_reason="timeout"))
    assert app.cache_get("k") is None


def test_missing_key_returns_none(fake_session):
    assert app.cache_get("nope") is None
