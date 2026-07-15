"""The HTTP layer: a stateless API over the recruiting agents.

Stateless is the design, not an accident. Nothing about a candidate is stored
here — no session, no cache, no database. The React client holds the session and
owns the cache, which is what preserves the app's promise that everything is
cleared on reload.

This module must never import Streamlit.
"""

from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel

from agents.dispatch import analyze_job_profile, backend_label
from api.demo_data import DEMO_CVS, DEMO_JOB
from api.orchestration import audit_entry, fallback_entries
from api.schemas import AuditEntryOut, RequirementOut, audit_to_out, requirement_to_out

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
