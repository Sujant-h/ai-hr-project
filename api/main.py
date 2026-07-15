"""The HTTP layer: a stateless API over the recruiting agents.

Stateless is the design, not an accident. Nothing about a candidate is stored
here — no session, no cache, no database. The React client holds the session and
owns the cache, which is what preserves the app's promise that everything is
cleared on reload.

This module must never import Streamlit.
"""

from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel

import llm_agents
from agents.dispatch import analyze_cv, analyze_job_profile, backend_label
from agents.rules import generate_email
from api.demo_data import DEMO_CVS, DEMO_JOB
from api.orchestration import analyze_candidates, audit_entry, batch_summary_entries, fallback_entries
from api.schemas import (
    AuditEntryOut,
    CandidateAnalysisOut,
    CandidateOut,
    RequirementOut,
    audit_to_out,
    candidate_from_in,
    candidate_to_out,
    requirement_from_in,
    requirement_to_out,
)

app = FastAPI(title="Recruiting AI API", version="1.0.0")

import os

from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# Locked to the frontend origin. Never "*": with a paid key behind this API,
# an open CORS policy lets any site spend it from a visitor's browser.
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# MAX_INPUT_CHARS caps the cost of one call; this caps the number of calls.
# The other half of the mitigation is a hard monthly spend cap on the OpenAI
# account itself — set it, it is not optional.
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

LLM_RATE_LIMIT = os.getenv("LLM_RATE_LIMIT", "30/minute")


class BackendOut(BaseModel):
    label: str


class DemoCvOut(BaseModel):
    name: str
    text: str


class DemoOut(BaseModel):
    job_text: str
    cvs: list[DemoCvOut]


@app.get("/api/backend", response_model=BackendOut)
def get_backend() -> BackendOut:
    """Which backend is active, for the header badge."""
    return BackendOut(label=backend_label())


@app.get("/api/demo", response_model=DemoOut)
def get_demo() -> DemoOut:
    """Seed data for the "Demo-Daten laden" button."""
    return DemoOut(
        job_text=DEMO_JOB,
        cvs=[DemoCvOut(name=name, text=text) for name, text in DEMO_CVS],
    )


class JobProfileIn(BaseModel):
    text: str


class JobProfileOut(BaseModel):
    requirements: list[RequirementOut]
    audit: list[AuditEntryOut]
    backend: str


@app.post("/api/job-profile", response_model=JobProfileOut)
@limiter.limit(LLM_RATE_LIMIT)
def post_job_profile(request: Request, payload: JobProfileIn) -> JobProfileOut:
    """① Stellenprofil-Agent: job ad -> measurable requirements."""
    run = analyze_job_profile(payload.text)
    entries = fallback_entries("Stellenprofil-Agent", run)
    entries.append(
        audit_entry(
            "Stellenprofil-Agent",
            "Stellenprofil analysiert",
            f"{len(run.result)} Anforderungen erkannt (Backend: {run.backend}).",
        )
    )
    return JobProfileOut(
        requirements=[requirement_to_out(r) for r in run.result],
        audit=[audit_to_out(e) for e in entries],
        backend=run.backend,
    )


MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # pymupdf must not be handed unbounded input


class CvOut(BaseModel):
    candidate: CandidateOut
    audit: list[AuditEntryOut]
    backend: str


def _upload_to_markdown(upload: UploadFile, data: bytes) -> str:
    """Read an uploaded PDF or TXT as clean Markdown.

    PDFs go through llm_agents.pdf_to_markdown, which tries pymupdf4llm first
    and falls back to pypdf itself: Markdown preserves document structure for
    the LLM while costing far fewer tokens than raw layout text.
    """
    if (upload.filename or "").lower().endswith(".pdf"):
        return llm_agents.pdf_to_markdown(data)
    try:
        return llm_agents.clean_markdown(data.decode("utf-8", errors="ignore"))
    except Exception:
        return ""


@app.post("/api/cv", response_model=CvOut)
@limiter.limit(LLM_RATE_LIMIT)
async def post_cv(
    request: Request,
    name: str = Form(...),
    index: int = Form(0),
    text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
) -> CvOut:
    """② CV-Agent: an uploaded or pasted CV -> a structured Candidate."""
    if file is not None:
        data = await file.read()
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Datei zu groß (max. 10 MB).")
        source = file.filename or "upload"
        cv_text = _upload_to_markdown(file, data)
    elif text:
        source = "Eingefügter Text"
        cv_text = llm_agents.clean_markdown(text)
    else:
        raise HTTPException(status_code=422, detail="Weder Datei noch Text übermittelt.")

    run = analyze_cv(name, source, cv_text, index)
    entries = fallback_entries("CV-Agent", run)
    entries.append(
        audit_entry("CV-Agent", "Lebenslauf analysiert", f"{name} verarbeitet (Backend: {run.backend}).")
    )
    return CvOut(
        candidate=candidate_to_out(run.result),
        audit=[audit_to_out(e) for e in entries],
        backend=run.backend,
    )


class AnalysisIn(BaseModel):
    requirements: list[RequirementOut]
    candidates: list[CandidateOut]
    # Backend labels for the candidates the client served from its own cache.
    # The server never sees those candidates, but the audit summary has to
    # count them: a recruiter looking at 3 candidates must not read "0
    # Kandidat(en) geprüft" just because nothing needed recomputing.
    cached_backends: list[str] = []


class AnalysisOut(BaseModel):
    analyses: list[CandidateAnalysisOut]
    audit: list[AuditEntryOut]


@app.post("/api/analysis", response_model=AnalysisOut)
@limiter.limit(LLM_RATE_LIMIT)
def post_analysis(request: Request, payload: AnalysisIn) -> AnalysisOut:
    """③④⑤ Matching + gaps + follow-up questions for every candidate sent.

    The client sends only the candidates it has no cached result for, so there
    is nothing to cache here — and nothing to remember.
    """
    requirements = [requirement_from_in(r) for r in payload.requirements]
    candidates = [candidate_from_in(c) for c in payload.candidates]
    analyses, entries = analyze_candidates(requirements, candidates)
    entries.extend(
        batch_summary_entries(
            requirements, [a.backend for a in analyses] + payload.cached_backends
        )
    )
    return AnalysisOut(
        analyses=[
            CandidateAnalysisOut(
                candidate=candidate_to_out(a.candidate),
                backend=a.backend,
                fallback_reason=a.fallback_reason,
            )
            for a in analyses
        ],
        audit=[audit_to_out(e) for e in entries],
    )


class EmailIn(BaseModel):
    candidate: CandidateOut
    questions: list[str]


class EmailOut(BaseModel):
    to: str
    subject: str
    body: str


@app.post("/api/email", response_model=EmailOut)
def post_email(payload: EmailIn) -> EmailOut:
    """⑤ Draft a follow-up email. Local only — this never reaches OpenAI.

    The draft is never sent automatically; it is prepared for human review.
    """
    to, subject, body = generate_email(candidate_from_in(payload.candidate), payload.questions)
    return EmailOut(to=to, subject=subject, body=body)
