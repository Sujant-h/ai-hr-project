"""
Shared data structures for the Recruiting AI demo.

These dataclasses are the *contract* between the backend agents (rule-based
or LLM-based) and the Streamlit UI. Both `app.py` and `llm_agents.py` import
from here, so the two backends stay interchangeable.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional

# The keys are the words the rule-based agent scans a document for, so they stay
# lowercase and untranslated. The human-readable name for a level lives in
# i18n.edu_label — it is display text and follows the recruiter's language.
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

# The vocabularies the agents and the UI agree on. Spelled out as Literals so a
# typo in a status or importance is caught by a type checker, rather than by a
# recruiter noticing a blank pill in the UI.
#
# These are codes, not labels: they are compared in Python and rendered through
# the frontend's own catalogue. They must never be translated here — a German
# "erfuellt" that becomes "met" under an English UI stops matching every branch
# that tests for it.
Kind = Literal["skill", "experience", "education", "language"]
Importance = Literal["muss", "kann"]
Status = Literal["erfuellt", "teilweise", "offen", "nicht_erfuellt"]

# Which follow-up question a gap deserves. Derived from the requirement's `kind`,
# except for the two gaps that no requirement produces: a missing e-mail address
# ("contact") and a CV that never states how long the candidate has worked
# ("experience_years" — "how many years in total?" rather than "describe your
# experience"). Keying the question generator on this instead of on the gap's
# label is what lets the label be translated at all.
GapKind = Literal["skill", "experience", "education", "language", "contact", "experience_years"]


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
    # Display text, filled in the language the CV was parsed under. `education`
    # is the authority: anything that has to phrase a sentence about the level
    # later re-derives the label via i18n.edu_label, so a language switch after
    # upload does not leave a stale word inside a freshly generated note.
    education_label: str = ""
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
    # The requirement's own value, carried through so the agents downstream can
    # phrase a question about it ("At what level do you speak English?") without
    # parsing it back out of `label` — which is prose, and translated.
    value: str | int = ""


@dataclass
class Gap:
    requirement_label: str
    description: str
    # Carried over from the requirement that produced the gap, so the UI can
    # tell a missing must-have apart from a missing nice-to-have instead of
    # asking the candidate about both with equal urgency.
    importance: Importance = "muss"
    # See GapKind: the stable code the follow-up question is chosen by.
    kind: GapKind = "skill"
    value: str | int = ""


@dataclass
class AuditEntry:
    timestamp: str
    agent: str
    action: str
    detail: str
