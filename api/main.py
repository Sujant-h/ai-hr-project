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
from agents.dispatch import analyze_cv, analyze_job_profile, backend_label, is_llm_active
from agents.rules import generate_email
from api.demo_data import demo_cvs, demo_job
from api.orchestration import analyze_candidates, audit_entry, batch_summary_entries, fallback_entries
from api.schemas import (
    AuditEntryOut,
    CandidateAnalysisOut,
    CandidateOut,
    Lang,
    RequirementOut,
    audit_to_out,
    candidate_from_in,
    candidate_to_out,
    requirement_from_in,
    requirement_to_out,
)
from i18n import AGENT_CV, AGENT_JOB_PROFILE, DEFAULT_LANG, tr

app = FastAPI(title="Recruiting AI API", version="1.0.0")

import os
from dotenv import load_dotenv
load_dotenv(override=True)

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
def get_client_id_or_ip(request: Request) -> str:
    return request.headers.get("X-Client-ID") or get_remote_address(request)

limiter = Limiter(key_func=get_client_id_or_ip)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

LIMIT_JOB_PROFILE = os.getenv("LIMIT_JOB_PROFILE", "3/day")
LIMIT_CV = os.getenv("LIMIT_CV", "15/day")
LIMIT_ANALYSIS = os.getenv("LIMIT_ANALYSIS", "3/day")


class BackendOut(BaseModel):
    label: str
    # `label` is display text and follows `lang`, so the client must not decide
    # "is the LLM on?" by comparing it against a known string — that check would
    # silently invert the moment the recruiter switched language.
    is_llm: bool


class DemoCvOut(BaseModel):
    name: str
    text: str


class DemoOut(BaseModel):
    job_text: str
    cvs: list[DemoCvOut]


@app.get("/api/health")
def get_health() -> dict[str, str]:
    """Liveness probe for the container healthcheck. Touches nothing else on purpose."""
    return {"status": "ok"}


@app.get("/api/backend", response_model=BackendOut)
def get_backend(lang: Lang = DEFAULT_LANG) -> BackendOut:
    """Which backend is active, for the header badge."""
    return BackendOut(label=backend_label(lang), is_llm=is_llm_active())


@app.get("/api/demo", response_model=DemoOut)
def get_demo(lang: Lang = DEFAULT_LANG) -> DemoOut:
    """Seed data for the "Load demo data" button, in the recruiter's language."""
    return DemoOut(
        job_text=demo_job(lang),
        cvs=[DemoCvOut(name=name, text=text) for name, text in demo_cvs(lang)],
    )


class JobProfileIn(BaseModel):
    text: str
    # Governs the prose the agents write back — requirement labels, notes, the
    # audit trail. Never what gets extracted.
    lang: Lang = DEFAULT_LANG


class JobProfileOut(BaseModel):
    requirements: list[RequirementOut]
    audit: list[AuditEntryOut]
    backend: str


@app.post("/api/job-profile", response_model=JobProfileOut)
@limiter.limit(LIMIT_JOB_PROFILE)
def post_job_profile(request: Request, payload: JobProfileIn) -> JobProfileOut:
    """① Stellenprofil-Agent: job ad -> measurable requirements."""
    lang = payload.lang
    run = analyze_job_profile(payload.text, lang)
    entries = fallback_entries(AGENT_JOB_PROFILE, run, lang)
    entries.append(
        audit_entry(
            AGENT_JOB_PROFILE,
            tr("audit.job_profile.action", lang),
            tr("audit.job_profile.detail", lang, count=len(run.result), backend=run.backend),
            lang,
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
@limiter.limit(LIMIT_CV)
async def post_cv(
    request: Request,
    name: str = Form(...),
    index: int = Form(0),
    text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    lang: Lang = Form(DEFAULT_LANG),
) -> CvOut:
    """② CV-Agent: an uploaded or pasted CV -> a structured Candidate."""
    if file is not None:
        data = await file.read()
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail=tr("error.file_too_large", lang))
        source = file.filename or "upload"
        cv_text = _upload_to_markdown(file, data)
    elif text:
        source = tr("source.pasted_text", lang)
        cv_text = llm_agents.clean_markdown(text)
    else:
        raise HTTPException(status_code=422, detail=tr("error.no_input", lang))

    run = analyze_cv(name, source, cv_text, index, lang)
    entries = fallback_entries(AGENT_CV, run, lang)
    entries.append(
        audit_entry(
            AGENT_CV,
            tr("audit.cv.action", lang),
            tr("audit.cv.detail", lang, name=name, backend=run.backend),
            lang,
        )
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
    # candidate(s) checked" just because nothing needed recomputing.
    cached_backends: list[str] = []
    lang: Lang = DEFAULT_LANG


class AnalysisOut(BaseModel):
    analyses: list[CandidateAnalysisOut]
    audit: list[AuditEntryOut]


@app.post("/api/analysis", response_model=AnalysisOut)
@limiter.limit(LIMIT_ANALYSIS)
def post_analysis(request: Request, payload: AnalysisIn) -> AnalysisOut:
    """③④⑤ Matching + gaps + follow-up questions for every candidate sent.

    The client sends only the candidates it has no cached result for, so there
    is nothing to cache here — and nothing to remember.
    """
    lang = payload.lang
    requirements = [requirement_from_in(r) for r in payload.requirements]
    candidates = [candidate_from_in(c) for c in payload.candidates]
    analyses, entries = analyze_candidates(requirements, candidates, lang)
    entries.extend(
        batch_summary_entries(
            requirements, [a.backend for a in analyses] + payload.cached_backends, lang
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
    lang: Lang = DEFAULT_LANG


class EmailOut(BaseModel):
    to: str
    subject: str
    body: str


@app.post("/api/email", response_model=EmailOut)
def post_email(payload: EmailIn) -> EmailOut:
    """⑤ Draft a follow-up email. Local only — this never reaches OpenAI.

    The draft is never sent automatically; it is prepared for human review.
    """
    to, subject, body = generate_email(
        candidate_from_in(payload.candidate), payload.questions, payload.lang
    )
    return EmailOut(to=to, subject=subject, body=body)
