"""Orchestration for the recruiting agents: parallel dispatch and the audit trail.

Everything here is pure with respect to the UI — functions return their audit
entries rather than writing them anywhere. That is what lets the dispatchers run
on worker threads, and what lets the API stay stateless: the caller (Streamlit
session, or an HTTP response) decides where the record goes.

This module must never import Streamlit.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

import llm_agents
from agents.dispatch import AgentRun, match_candidate, summarize_backends
from agents.rules import informationsluecken_agent, rueckfragen_agent
from models import AuditEntry, Candidate


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


# --- Candidate analysis ------------------------------------------------------


@dataclass
class CandidateAnalysis:
    """One candidate's analysis, plus which backend actually produced it.

    `fallback_reason` is reported per candidate, not per batch: each item is
    dispatched independently and may fall back on its own LLMError. The client
    owns the cache and must never store a fallback, so it needs this per item.
    """

    candidate: Candidate
    backend: str
    fallback_reason: Optional[str] = None


def derive_gaps_and_questions(candidate: Candidate) -> None:
    """Run the two local-only agents over a candidate's matches, in place."""
    candidate.gaps = informationsluecken_agent(candidate, candidate.matches)
    candidate.questions = rueckfragen_agent(candidate, candidate.gaps)


def analyze_candidates(
    requirements: list, candidates: list
) -> tuple[list[CandidateAnalysis], list[AuditEntry]]:
    """Match every candidate given against every requirement, then derive gaps
    and follow-up questions.

    Returns the analyses in input order plus the audit entries this function can
    vouch for — per-candidate fallbacks only. Callers pass just their uncached
    candidates, so this function never sees the whole batch: composing the batch
    summary is the caller's job (see batch_summary_entries).

    Nothing is stored here — that is what keeps the API stateless.
    """
    runs = _run_parallel(lambda cand: match_candidate(cand, requirements), candidates)

    entries: list[AuditEntry] = []
    analyses: list[CandidateAnalysis] = []
    for cand, run in zip(candidates, runs):
        entries.extend(fallback_entries("Matching-Agent", run))
        cand.matches = run.result
        derive_gaps_and_questions(cand)
        analyses.append(CandidateAnalysis(cand, run.backend, run.fallback_reason))

    return analyses, entries


def batch_summary_entries(requirements: list, backends: list) -> list[AuditEntry]:
    """Summarise a completed analysis run for the audit trail.

    `backends` must cover EVERY candidate the user sees, including those served
    from cache — the caller is the only party holding cached and fresh results
    together. Passing only the freshly computed ones would log "0 Kandidat(en)
    geprüft" on a cached re-run, and the audit log is this app's transparency
    record: it has to state what actually produced each displayed result.
    """
    return [
        audit_entry(
            "Matching-Agent",
            "Anforderungsabgleich durchgeführt",
            f"{len(backends)} Kandidat(en) gegen {len(requirements)} "
            f"Anforderung(en) geprüft (Backend: {summarize_backends(backends)}).",
        ),
        audit_entry(
            "Informationslücken-Agent", "Lücken analysiert", "Fehlende Angaben pro Kandidat ermittelt."
        ),
        audit_entry(
            "Rückfragen-Agent", "Rückfragen generiert", "Höfliche Rückfragen je Informationslücke erstellt."
        ),
    ]
