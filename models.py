"""
Shared data structures for the Recruiting AI demo.

These dataclasses are the *contract* between the backend agents (rule-based
or LLM-based) and the Streamlit UI. Both `app.py` and `llm_agents.py` import
from here, so the two backends stay interchangeable.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional

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

# The vocabularies the agents and the UI agree on. Spelled out as Literals so a
# typo in a status or importance is caught by a type checker, rather than by a
# recruiter noticing a blank pill in the UI.
Kind = Literal["skill", "experience", "education", "language"]
Importance = Literal["muss", "kann"]
Status = Literal["erfuellt", "teilweise", "offen", "nicht_erfuellt"]


@dataclass
class Requirement:
    """A single, measurable requirement extracted from a job profile."""

    id: str
    label: str
    kind: Kind
    # str for skill/language, int for experience years and education level
    value: str | int
    importance: Importance = "muss"


@dataclass
class Candidate:
    """Structured candidate information extracted from a CV."""

    id: str
    name: str
    source: str
    raw_text: str
    skills: list[str] = field(default_factory=list)
    years: Optional[int] = None
    education: int = 0
    education_label: str = "unbekannt"
    languages: list[str] = field(default_factory=list)
    email: Optional[str] = None
    # Computed by later agents:
    matches: list[MatchResult] = field(default_factory=list)
    gaps: list[Gap] = field(default_factory=list)
    questions: list[str] = field(default_factory=list)


@dataclass
class MatchResult:
    requirement_id: str
    label: str
    kind: Kind
    importance: Importance
    status: Status
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
