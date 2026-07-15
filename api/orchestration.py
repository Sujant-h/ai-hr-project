"""Orchestration for the recruiting agents: parallel dispatch and the audit trail.

Everything here is pure with respect to the UI — functions return their audit
entries rather than writing them anywhere. That is what lets the dispatchers run
on worker threads, and what lets the API stay stateless: the caller (Streamlit
session, or an HTTP response) decides where the record goes.

This module must never import Streamlit.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

import llm_agents
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


# --- Parallelism & caching --------------------------------------------------
#
# Each LLM call is an independent HTTP request that can take seconds, and the
# agents are pure, so candidates can be processed concurrently instead of one
# after another. Two rules keep this safe:
#
#   * Only the dispatchers run on worker threads. Streamlit's session state is
#     not thread-safe, so audit(), the cache and every st.* call stay on the
#     main thread — which is exactly why the dispatchers were made pure.
#   * Results are re-ordered back onto the input order, never zipped by
#     completion time.
#
# The cache is keyed on content, not identity: at temperature=0 the same CV and
# the same requirements always yield the same answer, so re-running an analysis
# should cost nothing. Only successful runs are cached — caching a fallback
# would pin a candidate to rule-based results for the rest of the session
# because of one transient API timeout.

MAX_PARALLEL_CALLS = 4  # keep well clear of API rate limits


def _run_parallel(fn, items: list) -> list:
    """Map `fn` over `items`, concurrently when that can actually help.

    Results are returned in the order of `items`. With the rule-based backend
    there is no I/O to overlap, so the work runs inline.
    """
    if len(items) <= 1 or not llm_agents.llm_available():
        return [fn(item) for item in items]
    with ThreadPoolExecutor(max_workers=min(len(items), MAX_PARALLEL_CALLS)) as pool:
        return list(pool.map(fn, items))  # pool.map preserves input order
