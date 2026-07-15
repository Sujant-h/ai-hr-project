"""Orchestration for the recruiting agents: parallel dispatch and the audit trail.

Everything here is pure with respect to the UI — functions return their audit
entries rather than writing them anywhere. That is what lets the dispatchers run
on worker threads, and what lets the API stay stateless: the caller (Streamlit
session, or an HTTP response) decides where the record goes.

This module must never import Streamlit.
"""

from __future__ import annotations

from datetime import datetime

from agents.dispatch import AgentRun
from models import AuditEntry


def audit_entry(agent: str, action: str, detail: str = "") -> AuditEntry:
    """Build a timestamped processing record."""
    return AuditEntry(
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        agent=agent,
        action=action,
        detail=detail,
    )


def fallback_entries(agent: str, run: AgentRun) -> list[AuditEntry]:
    """Record an LLM->rules fallback, if one happened. Empty list if not."""
    if run.fallback_reason:
        return [audit_entry(agent, "LLM-Fehler — Fallback auf Regeln", run.fallback_reason)]
    return []
