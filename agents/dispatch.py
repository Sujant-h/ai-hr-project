"""
Backend dispatch: LLM first, deterministic rules as the fallback.

Each dispatcher tries the LLM backend (llm_agents.py) and falls back to the
rule-based agent (agents/rules.py) if no API key is set or the call fails.

The dispatchers are pure — they return which backend produced the result and
why a fallback happened, rather than logging it themselves. The caller records
that in the audit log. Keeping Streamlit out of this module is what makes the
fallback path testable.

Recording the backend per result is an EU AI Act transparency requirement: a
batch can mix backends when one item's LLM call fails and the next succeeds.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Optional

import llm_agents
from agents import rules
from models import Candidate


def backend_label() -> str:
    return f"LLM ({llm_agents.DEFAULT_MODEL})" if llm_agents.llm_available() else "regelbasiert"


def summarize_backends(backends: list) -> str:
    """Describe which backends actually produced the results, e.g.
    "2x LLM (gpt-4o-mini), 1x regelbasiert".

    Each item is dispatched independently and may fall back to the rule-based
    agent on its own LLMError, so a single label cannot describe a batch. The
    audit trail is this app's transparency record — it has to reflect what ran,
    not whichever backend happened to run last.
    """
    if not backends:
        return "keine"
    counts = Counter(backends)
    return ", ".join(f"{count}x {label}" for label, count in counts.most_common())


@dataclass
class AgentRun:
    """What a dispatcher produced, and which backend actually produced it.

    `fallback_reason` is set when the LLM backend was available but failed, so
    the caller can record the fallback in the audit log. The dispatchers stay
    pure — they never touch Streamlit state — which is what makes the fallback
    path testable without a Streamlit runtime.
    """

    result: object
    backend: str
    fallback_reason: Optional[str] = None


def analyze_job_profile(text: str) -> AgentRun:
    if llm_agents.llm_available():
        try:
            return AgentRun(llm_agents.stellenprofil_agent_llm(text), backend_label())
        except llm_agents.LLMError as exc:
            return AgentRun(rules.stellenprofil_agent(text), "regelbasiert", str(exc))
    return AgentRun(rules.stellenprofil_agent(text), "regelbasiert")


def analyze_cv(name: str, source: str, text: str, idx: int) -> AgentRun:
    if llm_agents.llm_available():
        try:
            return AgentRun(llm_agents.cv_agent_llm(name, source, text, idx), backend_label())
        except llm_agents.LLMError as exc:
            return AgentRun(rules.cv_agent(name, source, text, idx), "regelbasiert", str(exc))
    return AgentRun(rules.cv_agent(name, source, text, idx), "regelbasiert")


def match_candidate(candidate: Candidate, requirements: list) -> AgentRun:
    if llm_agents.llm_available():
        try:
            return AgentRun(llm_agents.matching_agent_llm(candidate, requirements), backend_label())
        except llm_agents.LLMError as exc:
            return AgentRun(rules.matching_agent(candidate, requirements), "regelbasiert", str(exc))
    return AgentRun(rules.matching_agent(candidate, requirements), "regelbasiert")

