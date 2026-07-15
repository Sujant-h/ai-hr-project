"""The HTTP layer: a stateless API over the recruiting agents.

Stateless is the design, not an accident. Nothing about a candidate is stored
here — no session, no cache, no database. The React client holds the session and
owns the cache, which is what preserves the app's promise that everything is
cleared on reload.

This module must never import Streamlit.
"""

from __future__ import annotations

from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

import llm_agents
from agents.dispatch import analyze_cv, analyze_job_profile, backend_label
from api.demo_data import DEMO_CVS, DEMO_JOB
from api.orchestration import audit_entry, fallback_entries
from api.schemas import (
    AuditEntryOut,
    CandidateOut,
    RequirementOut,
    audit_to_out,
    candidate_to_out,
    requirement_to_out,
)

app = FastAPI(title="Recruiting AI API", version="1.0.0")


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
def post_job_profile(payload: JobProfileIn) -> JobProfileOut:
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
async def post_cv(
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
