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

from agents.dispatch import backend_label
from api.demo_data import DEMO_CVS, DEMO_JOB

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
