"""Pydantic mirrors of the models.py dataclasses, for the HTTP boundary only.

models.py stays the contract between the agents and everything else. These types
exist so FastAPI can emit an OpenAPI schema, from which web/src/api/types.ts is
generated. Hand-copied types drift; generated ones cannot.

The Literal vocabularies are mirrored deliberately: they become TypeScript
unions, which is what makes an unknown status a compile error in the UI rather
than a blank pill a recruiter has to notice.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel

from models import AuditEntry, Candidate, Gap, MatchResult, Requirement

Kind = Literal["skill", "experience", "education", "language"]
Importance = Literal["muss", "kann"]
Status = Literal["erfuellt", "teilweise", "offen", "nicht_erfuellt"]
GapKind = Literal["skill", "experience", "education", "language", "contact", "experience_years"]
Lang = Literal["en", "de"]


class RequirementOut(BaseModel):
    id: str
    label: str
    kind: Kind
    value: str | int
    importance: Importance


class MatchResultOut(BaseModel):
    requirement_id: str
    label: str
    kind: Kind
    importance: Importance
    status: Status
    note: str = ""
    value: str | int = ""


class GapOut(BaseModel):
    requirement_label: str
    description: str
    importance: Importance = "muss"
    kind: GapKind = "skill"
    value: str | int = ""


class CandidateOut(BaseModel):
    id: str
    name: str
    source: str
    raw_text: str
    skills: list[str] = []
    years: Optional[int] = None
    education: int = 0
    education_label: str = ""
    languages: list[str] = []
    email: Optional[str] = None
    matches: list[MatchResultOut] = []
    gaps: list[GapOut] = []
    questions: list[str] = []


class AuditEntryOut(BaseModel):
    timestamp: str
    agent: str
    action: str
    detail: str


class CandidateAnalysisOut(BaseModel):
    """One candidate's analysis plus the backend that produced it.

    backend/fallback_reason are per candidate because the client owns the cache
    and must never store a fallback.
    """

    candidate: CandidateOut
    backend: str
    fallback_reason: Optional[str] = None


def requirement_to_out(req: Requirement) -> RequirementOut:
    return RequirementOut(**req.__dict__)


def requirement_from_in(req: RequirementOut) -> Requirement:
    return Requirement(**req.model_dump())


def audit_to_out(entry: AuditEntry) -> AuditEntryOut:
    return AuditEntryOut(**entry.__dict__)


def candidate_to_out(cand: Candidate) -> CandidateOut:
    return CandidateOut(
        **{k: v for k, v in cand.__dict__.items() if k not in ("matches", "gaps", "questions")},
        matches=[MatchResultOut(**m.__dict__) for m in cand.matches],
        gaps=[GapOut(**g.__dict__) for g in cand.gaps],
        questions=list(cand.questions),
    )


def candidate_from_in(cand: CandidateOut) -> Candidate:
    data = cand.model_dump()
    matches = [MatchResult(**m) for m in data.pop("matches")]
    gaps = [Gap(**g) for g in data.pop("gaps")]
    questions = data.pop("questions")
    restored = Candidate(**data)
    restored.matches = matches
    restored.gaps = gaps
    restored.questions = questions
    return restored
