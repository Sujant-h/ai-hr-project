"""
Shared data structures for the Recruiting AI demo.

These dataclasses are the *contract* between the backend agents (rule-based
or LLM-based) and the Streamlit UI. Both `app.py` and `llm_agents.py` import
from here, so the two backends stay interchangeable.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

EDU_LEVELS = {
    "kein abschluss": 0,
    "ausbildung": 1,
    "bachelor": 2,
    "master": 3,
    "diplom": 3,
    "mba": 3,
    "phd": 4,
    "promotion": 4,
    "doktor": 4,
}
EDU_LABELS = {0: "kein Abschluss", 1: "Ausbildung", 2: "Bachelor", 3: "Master / Diplom", 4: "Promotion"}


@dataclass
class Requirement:
    """A single, measurable requirement extracted from a job profile."""

    id: str
    label: str
    kind: str  # 'skill' | 'experience' | 'education' | 'language'
    value: object  # str for skill/language, int for experience years / education level
    importance: str = "muss"  # 'muss' | 'kann'


@dataclass
class Candidate:
    """Structured candidate information extracted from a CV."""

    id: str
    name: str
    source: str
    raw_text: str
    skills: list = field(default_factory=list)
    years: Optional[int] = None
    education: int = 0
    education_label: str = "unbekannt"
    languages: list = field(default_factory=list)
    email: Optional[str] = None
    # Computed by later agents:
    matches: list = field(default_factory=list)  # list[MatchResult]
    gaps: list = field(default_factory=list)  # list[Gap]
    questions: list = field(default_factory=list)  # list[str]


@dataclass
class MatchResult:
    requirement_id: str
    label: str
    kind: str
    importance: str
    status: str  # 'erfuellt' | 'teilweise' | 'offen' | 'nicht_erfuellt'
    note: str = ""


@dataclass
class Gap:
    requirement_label: str
    description: str


@dataclass
class AuditEntry:
    timestamp: str
    agent: str
    action: str
    detail: str
