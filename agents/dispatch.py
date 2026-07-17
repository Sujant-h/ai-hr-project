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
from i18n import DEFAULT_LANG, tr
from models import Candidate


def is_llm_active() -> bool:
    """Whether the LLM backend is the one that would run right now.

    The UI needs this as a boolean. `backend_label` is display text and gets
    translated, so comparing its output against a known string would break the
    "no LLM active" banner the moment the recruiter switched language.
    """
    return llm_agents.llm_available()


def backend_label(lang: str = DEFAULT_LANG) -> str:
    if llm_agents.llm_available():
        return tr("backend.llm", lang, model=llm_agents.DEFAULT_MODEL)
    return tr("backend.rule_based", lang)


def summarize_backends(backends: list, lang: str = DEFAULT_LANG) -> str:
    """Describe which backends actually produced the results, e.g.
    "2x LLM (gpt-4o-mini), 1x rule-based".

    Each item is dispatched independently and may fall back to the rule-based
    agent on its own LLMError, so a single label cannot describe a batch. The
    audit trail is this app's transparency record — it has to reflect what ran,
    not whichever backend happened to run last.
    """
    if not backends:
        return tr("backend.none", lang)
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


def analyze_job_profile(text: str, lang: str = DEFAULT_LANG) -> AgentRun:
    rule_based = tr("backend.rule_based", lang)
    if llm_agents.llm_available():
        try:
            return AgentRun(llm_agents.stellenprofil_agent_llm(text, lang), backend_label(lang))
        except llm_agents.LLMError as exc:
            return AgentRun(rules.stellenprofil_agent(text, lang), rule_based, str(exc))
    return AgentRun(rules.stellenprofil_agent(text, lang), rule_based)


def analyze_cv(name: str, source: str, text: str, idx: int, lang: str = DEFAULT_LANG) -> AgentRun:
    rule_based = tr("backend.rule_based", lang)
    if llm_agents.llm_available():
        try:
            return AgentRun(llm_agents.cv_agent_llm(name, source, text, idx, lang), backend_label(lang))
        except llm_agents.LLMError as exc:
            return AgentRun(rules.cv_agent(name, source, text, idx, lang), rule_based, str(exc))
    return AgentRun(rules.cv_agent(name, source, text, idx, lang), rule_based)


def match_candidate(candidate: Candidate, requirements: list, lang: str = DEFAULT_LANG) -> AgentRun:
    rule_based = tr("backend.rule_based", lang)
    if llm_agents.llm_available():
        try:
            return AgentRun(llm_agents.matching_agent_llm(candidate, requirements, lang), backend_label(lang))
        except llm_agents.LLMError as exc:
            return AgentRun(rules.matching_agent(candidate, requirements, lang), rule_based, str(exc))
    return AgentRun(rules.matching_agent(candidate, requirements, lang), rule_based)

