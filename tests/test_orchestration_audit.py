"""The audit helpers must be pure: they build entries, they never store them.

This is what lets matching run on worker threads and lets the API return its
transparency record in the response instead of keeping server-side state.
"""

from __future__ import annotations

from agents.dispatch import AgentRun
from api.orchestration import audit_entry, fallback_entries


def test_audit_entry_carries_all_four_fields():
    entry = audit_entry("CV-Agent", "Lebenslauf analysiert", "1 Kandidat")
    assert entry.agent == "CV-Agent"
    assert entry.action == "Lebenslauf analysiert"
    assert entry.detail == "1 Kandidat"
    assert entry.timestamp


def test_detail_is_optional():
    assert audit_entry("CV-Agent", "etwas passiert").detail == ""


def test_a_successful_run_produces_no_fallback_entry():
    run = AgentRun(result=None, backend="LLM (gpt-4o-mini)", fallback_reason=None)
    assert fallback_entries("CV-Agent", run) == []


def test_a_fallback_is_recorded_with_its_reason():
    """The audit log is the EU AI Act transparency record: a fallback must say
    why it happened, not just that it did."""
    run = AgentRun(result=None, backend="regelbasiert", fallback_reason="API timeout")
    entries = fallback_entries("CV-Agent", run)
    assert len(entries) == 1
    assert entries[0].agent == "CV-Agent"
    assert entries[0].detail == "API timeout"
