# API Extraction Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a stateless FastAPI service over the existing pure agents, while the Streamlit app keeps working unchanged.

**Architecture:** Orchestration logic (`_run_parallel`, matching, audit) moves out of `app.py` into `api/orchestration.py` as pure functions that *return* `AuditEntry` lists instead of appending to `st.session_state`. `app.py` is rewired to consume those same functions, so both UIs share one core and nothing is duplicated. The cache stays in `app.py` for now — it moves to the React client in Phase 3 and is deleted in Phase 5.

**Tech Stack:** Python 3.9+, FastAPI, Pydantic v2, uvicorn, slowapi, pytest.

## Global Constraints

- **Never modify** `agents/rules.py`, `agents/dispatch.py`, `llm_agents.py`, or `models.py`. This phase adds a layer; it does not change agent behaviour.
- `models.py` dataclasses remain the contract. `api/schemas.py` mirrors them; it never replaces them.
- **No Streamlit import in `api/`.** Ever. That is the property this whole project is built on.
- The test suite must need **no API key and no network**. Preserve this.
- All user-facing German strings are copied **verbatim**. This phase changes no copy.
- `MAX_PARALLEL_CALLS = 4`. Do not change.
- Streamlit stays runnable and behaviourally identical until Phase 5.
- After every task: `pytest` must be green.

---

### Task 1: Create the `api/` package and move the demo data

**Files:**
- Create: `api/__init__.py`
- Create: `api/demo_data.py`
- Modify: `app.py:194-236` (delete `DEMO_JOB` / `DEMO_CVS`, import them instead)
- Test: `tests/test_demo_pipeline.py:15,17,27,38`

**Interfaces:**
- Consumes: nothing
- Produces: `api.demo_data.DEMO_JOB: str`, `api.demo_data.DEMO_CVS: list[tuple[str, str]]`

- [ ] **Step 1: Create the package**

Create `api/__init__.py` as an empty file.

- [ ] **Step 2: Move the demo data verbatim**

Create `api/demo_data.py`. Copy `DEMO_JOB` and `DEMO_CVS` from `app.py:194-236` **exactly** — same German text, same three candidates, same escapes:

```python
"""Seed data for the "Demo-Daten laden" flow.

Lives outside app.py so both the Streamlit UI and the API can serve it without
either importing the other.
"""

from __future__ import annotations

DEMO_JOB = """Senior Backend Entwickler (m/w/d)

Wir suchen eine erfahrene Persönlichkeit für unser Produktteam.

Anforderungen:
- Mindestens 5 Jahre Berufserfahrung in der Softwareentwicklung
- Sehr gute Kenntnisse in Python und SQL
- Erfahrung mit AWS und Docker
- Abgeschlossenes Studium (Bachelor) im Bereich Informatik
- Sehr gute Deutsch- und Englischkenntnisse
- Projektmanagement und Scrum wünschenswert
"""

DEMO_CVS = [
    (
        "Lena Hoffmann",
        """Name: Lena Hoffmann
E-Mail: lena.hoffmann@example.com
Berufserfahrung: 7 Jahre als Softwareentwicklerin
Skills: Python, SQL, AWS, Docker, Scrum
Ausbildung: Master Informatik
Sprachen: Deutsch, Englisch
""",
    ),
    (
        "Tomáš Novák",
        """Name: Tomas Novak
Berufserfahrung: 3 Jahre Backend
Skills: Python, JavaScript
Ausbildung: Bachelor
Sprachen: Englisch
""",
    ),
    (
        "Sarah Klein",
        """Name: Sarah Klein
E-Mail: sarah.klein@example.com
Skills: Java, SQL, Kubernetes
Ausbildung: Bachelor Wirtschaftsinformatik
Sprachen: Deutsch, Englisch, Französisch
""",
    ),
]
```

- [ ] **Step 3: Point `app.py` at the new module**

In `app.py`, delete lines 194-236 (the `DEMO_JOB` and `DEMO_CVS` literals) and add to the import block near line 48:

```python
from api.demo_data import DEMO_CVS, DEMO_JOB
```

The names `DEMO_JOB` / `DEMO_CVS` stay valid inside `app.py`, so `load_demo_data()` needs no change.

- [ ] **Step 4: Retarget the demo pipeline test**

In `tests/test_demo_pipeline.py`, replace `import app` with:

```python
from api.demo_data import DEMO_CVS, DEMO_JOB
```

Then replace every `app.DEMO_JOB` with `DEMO_JOB` and every `app.DEMO_CVS` with `DEMO_CVS` (lines 15, 17, 27, 38).

- [ ] **Step 5: Run the tests**

Run: `pytest tests/test_demo_pipeline.py -v`
Expected: PASS. This test no longer imports Streamlit at all.

- [ ] **Step 6: Verify the app still runs**

Run: `streamlit run app.py`, click "✨ Demo-Daten laden".
Expected: three candidates load exactly as before. Ctrl-C to stop.

- [ ] **Step 7: Commit**

```bash
git add api/__init__.py api/demo_data.py app.py tests/test_demo_pipeline.py
git commit -m "Move the demo seed data out of the Streamlit layer"
```

---

### Task 2: Pure audit helpers

**Files:**
- Create: `api/orchestration.py`
- Create: `tests/test_orchestration_audit.py`
- Modify: `app.py:66-84` (`audit_fallback`, `audit`)
- Modify: `tests/test_audit.py:10`, `tests/test_dispatch.py:12,99-104`

**Interfaces:**
- Consumes: `api.demo_data` (no), `models.AuditEntry`, `agents.dispatch.AgentRun`
- Produces:
  - `api.orchestration.audit_entry(agent: str, action: str, detail: str = "") -> AuditEntry`
  - `api.orchestration.fallback_entries(agent: str, run: AgentRun) -> list[AuditEntry]`

**Why:** `audit()` writes to `st.session_state`, which is exactly why it cannot run on a worker thread. These replacements build entries and return them. Callers decide where they go — the same pattern `AgentRun` already applies to the dispatchers.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_orchestration_audit.py`:

```python
"""The audit helpers must be pure: they build entries, they never store them.

This is what lets matching run on worker threads and lets the API return its
transparency record in the response instead of keeping server-side state.
"""

from __future__ import annotations

from agents.dispatch import AgentRun
from api.orchestration import audit_entry, fallback_entries


def test_audit_entry_carries_all_four_fields():
    entry = audit_entry("CV-Agent", "Lebenslauf analysiert", "1 Kandidat")
    assert entry.agent == "CV-Agent"
    assert entry.action == "Lebenslauf analysiert"
    assert entry.detail == "1 Kandidat"
    assert entry.timestamp


def test_detail_is_optional():
    assert audit_entry("CV-Agent", "etwas passiert").detail == ""


def test_a_successful_run_produces_no_fallback_entry():
    run = AgentRun(result=None, backend="LLM (gpt-4o-mini)", fallback_reason=None)
    assert fallback_entries("CV-Agent", run) == []


def test_a_fallback_is_recorded_with_its_reason():
    """The audit log is the EU AI Act transparency record: a fallback must say
    why it happened, not just that it did."""
    run = AgentRun(result=None, backend="regelbasiert", fallback_reason="API timeout")
    entries = fallback_entries("CV-Agent", run)
    assert len(entries) == 1
    assert entries[0].agent == "CV-Agent"
    assert entries[0].detail == "API timeout"
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest tests/test_orchestration_audit.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'api.orchestration'`

- [ ] **Step 3: Write the implementation**

Create `api/orchestration.py`:

```python
"""Orchestration for the recruiting agents: parallel dispatch and the audit trail.

Everything here is pure with respect to the UI — functions return their audit
entries rather than writing them anywhere. That is what lets the dispatchers run
on worker threads, and what lets the API stay stateless: the caller (Streamlit
session, or an HTTP response) decides where the record goes.

This module must never import Streamlit.
"""

from __future__ import annotations

from datetime import datetime

from agents.dispatch import AgentRun
from models import AuditEntry


def audit_entry(agent: str, action: str, detail: str = "") -> AuditEntry:
    """Build a timestamped processing record."""
    return AuditEntry(
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        agent=agent,
        action=action,
        detail=detail,
    )


def fallback_entries(agent: str, run: AgentRun) -> list[AuditEntry]:
    """Record an LLM->rules fallback, if one happened. Empty list if not."""
    if run.fallback_reason:
        return [audit_entry(agent, "LLM-Fehler — Fallback auf Regeln", run.fallback_reason)]
    return []
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/test_orchestration_audit.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Rewire `app.py` onto the helper**

Replace `audit_fallback` in `app.py:66-70` with:

```python
def audit_fallback(agent: str, run: AgentRun) -> None:
    """Record an LLM->rules fallback, if one happened, in the audit log."""
    for entry in fallback_entries(agent, run):
        st.session_state.audit.append(entry)
```

And rewrite `audit()` at `app.py:75-84` to reuse the builder:

```python
def audit(agent: str, action: str, detail: str = "") -> None:
    """Append a tamper-evident processing record to the audit log."""
    st.session_state.audit.append(audit_entry(agent, action, detail))
```

Add to the import block:

```python
from api.orchestration import audit_entry, fallback_entries
```

The `datetime` import in `app.py:37` may now be unused — remove it only if nothing else references it.

- [ ] **Step 6: Retarget `tests/test_audit.py`**

It only uses `summarize_backends`, which `app.py` merely re-exports from `agents.dispatch`. Replace `import app` (line 10) with:

```python
from agents.dispatch import summarize_backends
```

Then replace all four `app.summarize_backends(` calls with `summarize_backends(`.

- [ ] **Step 7: Retarget `tests/test_dispatch.py`**

Replace `import app` (line 12) with:

```python
from agents.dispatch import AgentRun, analyze_cv, analyze_job_profile, match_candidate
```

Replace `app.analyze_job_profile` → `analyze_job_profile`, `app.analyze_cv` → `analyze_cv`, `app.match_candidate` → `match_candidate`, `app.AgentRun` → `AgentRun`.

Then replace the `audit_fallback` test at lines 99-104 — it monkeypatched `app.audit`, which no longer makes sense for a pure function:

```python
def test_a_successful_run_logs_no_fallback():
    from api.orchestration import fallback_entries
    assert fallback_entries("CV-Agent", AgentRun(result=None, backend="LLM (x)")) == []


def test_a_failed_run_logs_the_reason():
    from api.orchestration import fallback_entries
    entries = fallback_entries(
        "CV-Agent", AgentRun(result=None, backend="regelbasiert", fallback_reason="boom")
    )
    assert [e.detail for e in entries] == ["boom"]
```

- [ ] **Step 8: Run the full suite**

Run: `pytest -v`
Expected: all PASS. `test_audit.py` and `test_dispatch.py` no longer import Streamlit.

- [ ] **Step 9: Commit**

```bash
git add api/orchestration.py tests/test_orchestration_audit.py app.py tests/test_audit.py tests/test_dispatch.py
git commit -m "Make the audit helpers pure so they can leave the Streamlit layer"
```

---

### Task 3: Move `_run_parallel` into the orchestration layer

**Files:**
- Modify: `api/orchestration.py`
- Modify: `app.py:105-117` (delete `MAX_PARALLEL_CALLS`, `_run_parallel`)
- Modify: `tests/test_parallel_cache.py:14,22-56`

**Interfaces:**
- Consumes: `llm_agents.llm_available`
- Produces: `api.orchestration._run_parallel(fn, items: list) -> list`, `api.orchestration.MAX_PARALLEL_CALLS = 4`

- [ ] **Step 1: Move the code verbatim**

Add to `api/orchestration.py` (imports first: `from concurrent.futures import ThreadPoolExecutor`, `import llm_agents`). Copy the function and **its full comment block** from `app.py:87-117` — the comment explains why this design exists and is worth more than the code:

```python
MAX_PARALLEL_CALLS = 4  # keep well clear of API rate limits


def _run_parallel(fn, items: list) -> list:
    """Map `fn` over `items`, concurrently when that can actually help.

    Results are returned in the order of `items`. With the rule-based backend
    there is no I/O to overlap, so the work runs inline.
    """
    if len(items) <= 1 or not llm_agents.llm_available():
        return [fn(item) for item in items]
    with ThreadPoolExecutor(max_workers=min(len(items), MAX_PARALLEL_CALLS)) as pool:
        return list(pool.map(fn, items))  # pool.map preserves input order
```

- [ ] **Step 2: Delete the originals from `app.py`**

Remove `MAX_PARALLEL_CALLS` and `_run_parallel` from `app.py:105-117`, and add to the import block:

```python
from api.orchestration import _run_parallel
```

Remove the now-unused `from concurrent.futures import ThreadPoolExecutor` at `app.py:36`.

- [ ] **Step 3: Retarget the parallelism tests**

In `tests/test_parallel_cache.py`, add after `import app` (line 14):

```python
from api import orchestration
```

Replace the four `app._run_parallel(` calls (lines 31, 35, 40, 46, 56) with `orchestration._run_parallel(`. **Leave the cache tests (lines 62-123) pointing at `app`** — the cache stays in `app.py` until Phase 5.

- [ ] **Step 4: Run the tests**

Run: `pytest tests/test_parallel_cache.py -v`
Expected: all PASS, including `test_results_keep_input_order_not_completion_order`.

- [ ] **Step 5: Commit**

```bash
git add api/orchestration.py app.py tests/test_parallel_cache.py
git commit -m "Move parallel dispatch into the orchestration layer"
```

---

### Task 4: `analyze_candidates` — the pure core of `run_full_analysis`

**Files:**
- Modify: `api/orchestration.py`
- Create: `tests/test_analyze_candidates.py`

**Interfaces:**
- Consumes: `_run_parallel`, `audit_entry`, `fallback_entries`, `agents.dispatch.match_candidate`, `agents.dispatch.summarize_backends`, `agents.rules.informationsluecken_agent`, `agents.rules.rueckfragen_agent`
- Produces:
  - `api.orchestration.CandidateAnalysis` — dataclass with `candidate: Candidate`, `backend: str`, `fallback_reason: Optional[str]`
  - `api.orchestration.analyze_candidates(requirements: list, candidates: list) -> tuple[list[CandidateAnalysis], list[AuditEntry]]`
  - `api.orchestration.batch_summary_entries(requirements: list, backends: list) -> list[AuditEntry]`

**Why `CandidateAnalysis` exists:** the React client owns the cache, and `cache_put`'s rule is that a fallback is never cached. The client can only honour that if the response says, *per candidate*, whether that result was a fallback. A single batch-level backend label cannot express a mixed batch — which is the exact bug `test_audit.py` was written to prevent.

**Why the caller composes the batch summary:** callers send only their *uncached*
candidates, so `analyze_candidates` never sees the full batch and cannot describe
it. If it tried, a fully-cached re-run would log "0 Kandidat(en) geprüft" while N
analyzed candidates sit on screen. The caller — `app.py` now, the React store in
Phase 3 — is the only party holding cached and fresh results together, so it
builds the summary and passes in the complete backend list. `analyze_candidates`
emits only what it can vouch for: per-candidate fallbacks. Same instinct as
`AgentRun`: the function reports, the caller records.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_analyze_candidates.py`. Note there is no `FakeState` fixture — that is the point of this refactor:

```python
"""Tests for the pure analysis core.

This is where parallelism and the audit trail meet, so it is where a mistake
would be both severe and quiet: results attached to the wrong candidate, or a
per-candidate fallback hidden behind a batch-level label.
"""

from __future__ import annotations

import pytest

import llm_agents
from agents.dispatch import AgentRun
from api import orchestration
from api.orchestration import analyze_candidates
from models import Candidate, MatchResult, Requirement


@pytest.fixture(autouse=True)
def no_api_key(monkeypatch):
    monkeypatch.setattr(llm_agents, "llm_available", lambda: False)


@pytest.fixture
def reqs():
    return [Requirement(id="r0", label="Python", kind="skill", value="Python", importance="muss")]


@pytest.fixture
def candidates():
    return [
        Candidate(id=f"c{i}", name=f"Cand {i}", source="t", raw_text=f"CV number {i}")
        for i in range(3)
    ]


def _match_for(cand: Candidate, fallback: str = None) -> AgentRun:
    """A dispatcher stub whose output identifies the candidate it was given."""
    return AgentRun(
        result=[
            MatchResult(
                requirement_id="r0",
                label="Python",
                kind="skill",
                importance="muss",
                status="erfuellt",
                note=f"evidence from {cand.raw_text}",
            )
        ],
        backend="regelbasiert",
        fallback_reason=fallback,
    )


def test_each_candidate_gets_its_own_matches(monkeypatch, reqs, candidates):
    """Guards the parallel path: every candidate must receive the result computed
    from its own CV, not a neighbour's."""
    monkeypatch.setattr(orchestration, "match_candidate", lambda c, r: _match_for(c))

    analyses, _ = analyze_candidates(reqs, candidates)

    for analysis in analyses:
        cand = analysis.candidate
        assert cand.matches[0].note == f"evidence from {cand.raw_text}"


def test_downstream_agents_ran(monkeypatch, reqs, candidates):
    monkeypatch.setattr(orchestration, "match_candidate", lambda c, r: _match_for(c))

    analyses, _ = analyze_candidates(reqs, candidates)

    for analysis in analyses:
        # informationsluecken_agent + rueckfragen_agent ran: no e-mail in these
        # CVs, so each candidate has a contact-details gap and a question.
        assert any(g.requirement_label == "Kontaktdaten" for g in analysis.candidate.gaps)
        assert analysis.candidate.questions


def test_a_fallback_is_reported_per_candidate(monkeypatch, reqs, candidates):
    """The client's cache must never store a fallback, so it needs to know which
    individual candidates fell back — a batch label cannot say that."""
    def sometimes_fails(cand, _reqs):
        return _match_for(cand, fallback="API timeout" if cand.id == "c1" else None)

    monkeypatch.setattr(orchestration, "match_candidate", sometimes_fails)

    analyses, _ = analyze_candidates(reqs, candidates)

    assert [a.fallback_reason for a in analyses] == [None, "API timeout", None]


def test_fallbacks_reach_the_audit_entries(monkeypatch, reqs, candidates):
    monkeypatch.setattr(orchestration, "match_candidate", lambda c, r: _match_for(c, "API timeout"))

    _, entries = analyze_candidates(reqs, candidates)

    assert any("API timeout" in e.detail for e in entries)


def test_analyze_candidates_does_not_claim_a_batch_it_cannot_see(monkeypatch, reqs, candidates):
    """Callers pass only their uncached candidates, so this function never sees
    the whole batch and must not describe one."""
    monkeypatch.setattr(orchestration, "match_candidate", lambda c, r: _match_for(c))

    _, entries = analyze_candidates(reqs, candidates)

    assert not any(e.action == "Anforderungsabgleich durchgeführt" for e in entries)


def test_no_candidates_is_handled(monkeypatch, reqs):
    analyses, entries = analyze_candidates(reqs, [])
    assert analyses == []
    assert entries == []


def test_the_batch_summary_counts_every_backend_it_is_given(reqs):
    """The caller holds cached and fresh results together, so it passes the full
    backend list — including the backends that produced cached results."""
    entries = orchestration.batch_summary_entries(reqs, ["regelbasiert"] * 3)

    summary = [e for e in entries if e.action == "Anforderungsabgleich durchgeführt"]
    assert len(summary) == 1
    assert "3 Kandidat(en)" in summary[0].detail
    assert "1 Anforderung(en)" in summary[0].detail
    assert "3x regelbasiert" in summary[0].detail


def test_the_batch_summary_reports_a_mixed_batch_honestly(reqs):
    """The exact bug test_audit.py guards: one candidate falling back must not be
    hidden behind whichever backend ran last."""
    entries = orchestration.batch_summary_entries(reqs, ["regelbasiert", "LLM (gpt-4o-mini)"])

    detail = entries[0].detail
    assert "1x regelbasiert" in detail
    assert "1x LLM (gpt-4o-mini)" in detail


def test_the_batch_summary_includes_the_local_agent_entries(reqs):
    entries = orchestration.batch_summary_entries(reqs, ["regelbasiert"])
    actions = [e.action for e in entries]
    assert "Lücken analysiert" in actions
    assert "Rückfragen generiert" in actions
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest tests/test_analyze_candidates.py -v`
Expected: FAIL — `ImportError: cannot import name 'analyze_candidates'`

- [ ] **Step 3: Write the implementation**

Add to `api/orchestration.py`. Extend the imports:

```python
from dataclasses import dataclass
from typing import Optional

from agents.dispatch import AgentRun, match_candidate, summarize_backends
from agents.rules import informationsluecken_agent, rueckfragen_agent
from models import AuditEntry, Candidate
```

Then:

```python
@dataclass
class CandidateAnalysis:
    """One candidate's analysis, plus which backend actually produced it.

    `fallback_reason` is reported per candidate, not per batch: each item is
    dispatched independently and may fall back on its own LLMError. The client
    owns the cache and must never store a fallback, so it needs this per item.
    """

    candidate: Candidate
    backend: str
    fallback_reason: Optional[str] = None


def derive_gaps_and_questions(candidate: Candidate) -> None:
    """Run the two local-only agents over a candidate's matches, in place."""
    candidate.gaps = informationsluecken_agent(candidate, candidate.matches)
    candidate.questions = rueckfragen_agent(candidate, candidate.gaps)


def analyze_candidates(
    requirements: list, candidates: list
) -> tuple[list[CandidateAnalysis], list[AuditEntry]]:
    """Match every candidate given against every requirement, then derive gaps
    and follow-up questions.

    Returns the analyses in input order plus the audit entries this function can
    vouch for — per-candidate fallbacks only. Callers pass just their uncached
    candidates, so this function never sees the whole batch: composing the batch
    summary is the caller's job (see batch_summary_entries).

    Nothing is stored here — that is what keeps the API stateless.
    """
    runs = _run_parallel(lambda cand: match_candidate(cand, requirements), candidates)

    entries: list[AuditEntry] = []
    analyses: list[CandidateAnalysis] = []
    for cand, run in zip(candidates, runs):
        entries.extend(fallback_entries("Matching-Agent", run))
        cand.matches = run.result
        derive_gaps_and_questions(cand)
        analyses.append(CandidateAnalysis(cand, run.backend, run.fallback_reason))

    return analyses, entries


def batch_summary_entries(requirements: list, backends: list) -> list[AuditEntry]:
    """Summarise a completed analysis run for the audit trail.

    `backends` must cover EVERY candidate the user sees, including those served
    from cache — the caller is the only party holding cached and fresh results
    together. Passing only the freshly computed ones would log "0 Kandidat(en)
    geprüft" on a cached re-run, and the audit log is this app's transparency
    record: it has to state what actually produced each displayed result.
    """
    return [
        audit_entry(
            "Matching-Agent",
            "Anforderungsabgleich durchgeführt",
            f"{len(backends)} Kandidat(en) gegen {len(requirements)} "
            f"Anforderung(en) geprüft (Backend: {summarize_backends(backends)}).",
        ),
        audit_entry(
            "Informationslücken-Agent", "Lücken analysiert", "Fehlende Angaben pro Kandidat ermittelt."
        ),
        audit_entry(
            "Rückfragen-Agent", "Rückfragen generiert", "Höfliche Rückfragen je Informationslücke erstellt."
        ),
    ]
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/test_analyze_candidates.py -v`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add api/orchestration.py tests/test_analyze_candidates.py
git commit -m "Extract the analysis core as a pure function"
```

---

### Task 5: Rewire `app.py`'s `run_full_analysis` onto the shared core

**Files:**
- Modify: `app.py:158-189`
- Test: `tests/test_run_full_analysis.py` (unchanged — it must still pass)

**Interfaces:**
- Consumes: `api.orchestration.analyze_candidates`, `api.orchestration.derive_gaps_and_questions`, `api.orchestration.batch_summary_entries`
- Produces: nothing new

**Why:** this is the task that proves the extraction is correct. `test_run_full_analysis.py` is **not modified** — if the Streamlit path still passes its existing tests against the new core, the core is faithful. The cache and session writes stay in `app.py`; only the shared logic is delegated.

**The `backends` list is the subtle part.** It must carry one entry per candidate
*the user sees*, in candidate order, pulling each cached candidate's original
backend back out of the cache. Build it from only the freshly computed ones and a
cached re-run logs "0 Kandidat(en) geprüft" while N candidates sit on screen.

- [ ] **Step 1: Rewrite `run_full_analysis`**

Replace `app.py:158-189` entirely:

```python
def run_full_analysis() -> None:
    """Run the matching, gap and follow-up agents for every candidate.

    The analysis itself lives in api/orchestration.py, shared with the API. This
    wrapper owns only what is Streamlit's: the session cache and the audit log.
    """
    reqs = st.session_state.requirements
    candidates = st.session_state.candidates
    reqs_key = requirements_key(reqs)
    keys = [cache_key(cand.raw_text, reqs_key) for cand in candidates]

    # Only candidates without a cached result reach the backend.
    todo = [cand for cand, key in zip(candidates, keys) if cache_get(key) is None]
    analyses, entries = analyze_candidates(reqs, todo)
    for analysis in analyses:
        cache_put(
            cache_key(analysis.candidate.raw_text, reqs_key),
            AgentRun(analysis.candidate.matches, analysis.backend, analysis.fallback_reason),
        )

    # One backend per candidate the user sees, in candidate order: freshly
    # computed ones from this run, the rest recovered from the cache. Cached
    # candidates also need their matches reattached and their (cheap, never
    # cached) gaps and questions re-derived.
    fresh = {id(a.candidate): a.backend for a in analyses}
    backends: list = []
    for cand, key in zip(candidates, keys):
        if id(cand) in fresh:
            backends.append(fresh[id(cand)])
            continue
        run = cache_get(key)
        cand.matches = run.result
        derive_gaps_and_questions(cand)
        backends.append(run.backend)

    entries.extend(batch_summary_entries(reqs, backends))
    for entry in entries:
        st.session_state.audit.append(entry)
    st.session_state.analysis_done = True
```

Add to the import block:

```python
from api.orchestration import analyze_candidates, batch_summary_entries, derive_gaps_and_questions
```

`app.py` no longer needs `informationsluecken_agent` / `rueckfragen_agent` / `summarize_backends` imported for this function — remove them from the import block **only if** no other code in `app.py` uses them (`_tab_rueckfragen` and `load_demo_data` may).

- [ ] **Step 2: Run the unmodified integration tests**

Run: `pytest tests/test_run_full_analysis.py -v`
Expected: all 6 PASS, unchanged. Including `test_second_run_is_served_from_cache` and `test_a_failed_llm_call_is_retried_on_the_next_run` — the cache semantics must survive the delegation exactly.

- [ ] **Step 3: Run the whole suite**

Run: `pytest -v`
Expected: all PASS.

- [ ] **Step 4: Verify the app end to end**

Run: `streamlit run app.py`, click "✨ Demo-Daten laden", open the Audit Log tab.
Expected: three candidates with matches, gaps and questions; the audit log shows "3 Kandidat(en) gegen N Anforderung(en) geprüft (Backend: 3x regelbasiert)". Ctrl-C.

- [ ] **Step 5: Commit**

```bash
git add app.py
git commit -m "Rewire the Streamlit analysis onto the shared core"
```

---

### Task 6: Pydantic schemas

**Files:**
- Create: `api/schemas.py`
- Create: `tests/test_schemas.py`
- Modify: `requirements.txt`

**Interfaces:**
- Consumes: `models.py` dataclasses
- Produces: `RequirementOut`, `CandidateOut`, `MatchResultOut`, `GapOut`, `AuditEntryOut`, `CandidateAnalysisOut`, plus `candidate_to_out`, `candidate_from_in`, `requirement_to_out`, `requirement_from_in`, `audit_to_out`

**Why:** `models.py` stays the contract. These mirror it at the HTTP boundary so `web/src/api/types.ts` can be generated from OpenAPI rather than hand-copied. The `Literal` vocabularies carry through to TypeScript unions — which is what finally makes `models.py`'s type-safety comment true in the UI.

- [ ] **Step 1: Add the dependencies**

Add to `requirements.txt`:

```
fastapi==0.121.2
uvicorn==0.42.0
slowapi==0.1.9
```

Run: `pip install -r requirements.txt`

- [ ] **Step 2: Write the failing tests**

Create `tests/test_schemas.py`:

```python
"""The HTTP boundary must round-trip the models.py dataclasses exactly.

Anything lost here is lost silently: a dropped field shows up as a blank pill in
the UI, not as an error.
"""

from __future__ import annotations

from api.schemas import candidate_from_in, candidate_to_out, requirement_to_out
from models import Candidate, Gap, MatchResult, Requirement


def test_requirement_round_trips():
    req = Requirement(id="r0", label="Python", kind="skill", value="Python", importance="muss")
    out = requirement_to_out(req)
    assert out.id == "r0"
    assert out.kind == "skill"
    assert out.importance == "muss"


def test_candidate_round_trips_including_derived_fields():
    cand = Candidate(id="c0", name="Lena", source="cv.pdf", raw_text="CV text", skills=["Python"])
    cand.matches = [
        MatchResult(requirement_id="r0", label="Python", kind="skill",
                    importance="muss", status="erfuellt", note="gefunden")
    ]
    cand.gaps = [Gap(requirement_label="Kontaktdaten", description="fehlt", importance="muss")]
    cand.questions = ["Wie erreichen wir Sie?"]

    out = candidate_to_out(cand)
    assert out.name == "Lena"
    assert out.matches[0].status == "erfuellt"
    assert out.gaps[0].importance == "muss"
    assert out.questions == ["Wie erreichen wir Sie?"]


def test_candidate_survives_a_full_round_trip():
    """The client sends candidates back for analysis, so raw_text must survive."""
    cand = Candidate(id="c0", name="Lena", source="cv.pdf", raw_text="CV text", skills=["Python"])
    restored = candidate_from_in(candidate_to_out(cand))
    assert restored.raw_text == "CV text"
    assert restored.id == "c0"
    assert restored.skills == ["Python"]
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pytest tests/test_schemas.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'api.schemas'`

- [ ] **Step 4: Write the implementation**

Create `api/schemas.py`:

```python
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


class GapOut(BaseModel):
    requirement_label: str
    description: str
    importance: Importance = "muss"


class CandidateOut(BaseModel):
    id: str
    name: str
    source: str
    raw_text: str
    skills: list[str] = []
    years: Optional[int] = None
    education: int = 0
    education_label: str = "unbekannt"
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pytest tests/test_schemas.py -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add api/schemas.py tests/test_schemas.py requirements.txt
git commit -m "Mirror the model dataclasses at the HTTP boundary"
```

---

### Task 7: The FastAPI app, with the two read-only endpoints

**Files:**
- Create: `api/main.py`
- Create: `tests/test_api_read_endpoints.py`

**Interfaces:**
- Consumes: `api.demo_data`, `api.schemas`, `agents.dispatch.backend_label`
- Produces: `api.main.app` (FastAPI instance), `GET /api/backend`, `GET /api/demo`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_api_read_endpoints.py`:

```python
"""The API must work with no API key and no network — same as the rest of the
suite. These two endpoints never touch OpenAI at all."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import llm_agents
from api.main import app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(llm_agents, "llm_available", lambda: False)
    return TestClient(app)


def test_backend_endpoint_reports_the_rule_based_backend(client):
    response = client.get("/api/backend")
    assert response.status_code == 200
    assert response.json() == {"label": "regelbasiert"}


def test_demo_endpoint_serves_the_seed_data(client):
    response = client.get("/api/demo")
    assert response.status_code == 200
    body = response.json()
    assert "Senior Backend Entwickler" in body["job_text"]
    assert len(body["cvs"]) == 3
    assert body["cvs"][0]["name"] == "Lena Hoffmann"
    assert "lena.hoffmann@example.com" in body["cvs"][0]["text"]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest tests/test_api_read_endpoints.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'api.main'`

- [ ] **Step 3: Write the implementation**

Create `api/main.py`:

```python
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/test_api_read_endpoints.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: See it run**

Run: `uvicorn api.main:app --reload --port 8000`
Open `http://localhost:8000/docs`.
Expected: Swagger UI listing both endpoints. Try `GET /api/demo`. Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add api/main.py tests/test_api_read_endpoints.py
git commit -m "Add the API app and its read-only endpoints"
```

---

### Task 8: `POST /api/job-profile`

**Files:**
- Modify: `api/main.py`
- Create: `tests/test_api_job_profile.py`

**Interfaces:**
- Consumes: `agents.dispatch.analyze_job_profile`, `api.orchestration.audit_entry`/`fallback_entries`, `api.schemas`
- Produces: `POST /api/job-profile` → `{requirements: RequirementOut[], audit: AuditEntryOut[], backend: str}`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_api_job_profile.py`:

```python
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import llm_agents
from api.main import app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(llm_agents, "llm_available", lambda: False)
    return TestClient(app)


def test_requirements_are_extracted_from_a_job_ad(client):
    response = client.post("/api/job-profile", json={"text": "Python und SQL erforderlich"})
    assert response.status_code == 200
    body = response.json()
    labels = [r["label"] for r in body["requirements"]]
    assert "Python" in labels
    assert body["backend"] == "regelbasiert"


def test_the_response_carries_its_own_audit_trail(client):
    """The API is stateless: the transparency record travels in the response,
    because there is nowhere on the server to keep it."""
    response = client.post("/api/job-profile", json={"text": "Python erforderlich"})
    entries = response.json()["audit"]
    assert any(e["agent"] == "Stellenprofil-Agent" for e in entries)
    assert all(e["timestamp"] for e in entries)


def test_empty_input_is_accepted_and_yields_no_requirements(client):
    response = client.post("/api/job-profile", json={"text": ""})
    assert response.status_code == 200
    assert response.json()["requirements"] == []
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest tests/test_api_job_profile.py -v`
Expected: FAIL — 404, the route does not exist.

- [ ] **Step 3: Write the implementation**

Add to `api/main.py` (extend imports with `analyze_job_profile` from `agents.dispatch`, the schema helpers, and the orchestration helpers):

```python
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/test_api_job_profile.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add api/main.py tests/test_api_job_profile.py
git commit -m "Add the job-profile endpoint"
```

---

### Task 9: `POST /api/cv`, with an upload cap

**Files:**
- Modify: `api/main.py`
- Create: `tests/test_api_cv.py`

**Interfaces:**
- Consumes: `agents.dispatch.analyze_cv`, `llm_agents.pdf_to_markdown`, `llm_agents.clean_markdown`
- Produces: `POST /api/cv` (multipart: `file`, or form fields `name` + `text`) → `{candidate: CandidateOut, audit: AuditEntryOut[], backend: str}`; `api.main.MAX_UPLOAD_BYTES = 10 * 1024 * 1024`

**Why the cap:** Streamlit enforced a default upload limit; that disappears with Streamlit. This endpoint hands bytes to pymupdf. `MAX_INPUT_CHARS` caps what reaches the LLM but does not cap parsing work.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_api_cv.py`:

```python
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import llm_agents
from api.main import MAX_UPLOAD_BYTES, app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(llm_agents, "llm_available", lambda: False)
    return TestClient(app)


CV_TEXT = "Name: Lena Hoffmann\nE-Mail: lena@example.com\nSkills: Python, SQL\n"


def test_a_pasted_cv_becomes_a_structured_candidate(client):
    response = client.post("/api/cv", data={"name": "Lena Hoffmann", "text": CV_TEXT, "index": 0})
    assert response.status_code == 200
    body = response.json()
    assert body["candidate"]["email"] == "lena@example.com"
    assert "Python" in body["candidate"]["skills"]
    assert body["backend"] == "regelbasiert"


def test_an_uploaded_text_file_becomes_a_candidate(client):
    response = client.post(
        "/api/cv",
        files={"file": ("cv.txt", CV_TEXT.encode("utf-8"), "text/plain")},
        data={"name": "Lena Hoffmann", "index": 0},
    )
    assert response.status_code == 200
    assert "Python" in response.json()["candidate"]["skills"]


def test_the_response_carries_its_own_audit_trail(client):
    response = client.post("/api/cv", data={"name": "Lena", "text": CV_TEXT, "index": 0})
    assert any(e["agent"] == "CV-Agent" for e in response.json()["audit"])


def test_an_oversized_upload_is_rejected(client):
    """Streamlit's upload cap disappears with Streamlit; pymupdf must not be
    handed unbounded input."""
    oversized = b"x" * (MAX_UPLOAD_BYTES + 1)
    response = client.post(
        "/api/cv",
        files={"file": ("big.txt", oversized, "text/plain")},
        data={"name": "X", "index": 0},
    )
    assert response.status_code == 413


def test_neither_file_nor_text_is_a_client_error(client):
    response = client.post("/api/cv", data={"name": "X", "index": 0})
    assert response.status_code == 422
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest tests/test_api_cv.py -v`
Expected: FAIL — `ImportError: cannot import name 'MAX_UPLOAD_BYTES'`

- [ ] **Step 3: Write the implementation**

Add to `api/main.py` (extend imports: `from fastapi import FastAPI, File, Form, HTTPException, UploadFile`, `from typing import Optional`, plus `analyze_cv`, `candidate_to_out`, `llm_agents`):

```python
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/test_api_cv.py -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add api/main.py tests/test_api_cv.py
git commit -m "Add the CV endpoint with an upload cap"
```

---

### Task 10: `POST /api/analysis`

**Files:**
- Modify: `api/main.py`
- Create: `tests/test_api_analysis.py`

**Interfaces:**
- Consumes: `api.orchestration.analyze_candidates`, `api.orchestration.batch_summary_entries`, `api.schemas.candidate_from_in`
- Produces: `POST /api/analysis`, body `{requirements, candidates, cached_backends}` → `{analyses: CandidateAnalysisOut[], audit: AuditEntryOut[]}`

**Why no cache here:** the client sends only its uncached candidates. The server has no memory of any of them.

**Why `cached_backends` exists:** because of that, the server cannot see the full
batch — but the audit summary must describe every candidate the user sees, or a
cached re-run reports "0 Kandidat(en) geprüft". The client sends the backend
labels of the candidates it served from its own cache, and the server composes
the summary over both halves. This keeps every German audit string in one place
rather than duplicating them into TypeScript — which matters for Project 2, where
they all have to be translated.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_api_analysis.py`:

```python
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import llm_agents
from api.main import app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(llm_agents, "llm_available", lambda: False)
    return TestClient(app)


def _payload():
    return {
        "requirements": [
            {"id": "r0", "label": "Python", "kind": "skill", "value": "Python", "importance": "muss"}
        ],
        "candidates": [
            {
                "id": "c0",
                "name": "Lena",
                "source": "cv.txt",
                "raw_text": "Skills: Python\nBerufserfahrung: 7 Jahre",
                "skills": ["Python"],
            }
        ],
    }


def test_a_candidate_comes_back_matched_with_gaps_and_questions(client):
    response = client.post("/api/analysis", json=_payload())
    assert response.status_code == 200
    analysis = response.json()["analyses"][0]
    assert analysis["candidate"]["matches"][0]["requirement_id"] == "r0"
    assert analysis["candidate"]["gaps"] is not None
    assert analysis["backend"] == "regelbasiert"


def test_every_analysis_reports_its_own_backend(client):
    """The client owns the cache and must never store a fallback, so the backend
    is reported per candidate rather than once per batch."""
    analysis = client.post("/api/analysis", json=_payload()).json()["analyses"][0]
    assert "backend" in analysis
    assert "fallback_reason" in analysis


def test_the_response_carries_the_batch_audit_trail(client):
    entries = client.post("/api/analysis", json=_payload()).json()["audit"]
    actions = [e["action"] for e in entries]
    assert "Anforderungsabgleich durchgeführt" in actions
    assert "Lücken analysiert" in actions
    assert "Rückfragen generiert" in actions


def test_the_summary_counts_the_clients_cached_candidates_too(client):
    """The client sends only uncached candidates, so it reports the backends of
    the ones it served from cache. Otherwise the audit trail would describe only
    part of what the recruiter is looking at."""
    payload = _payload()
    payload["cached_backends"] = ["LLM (gpt-4o-mini)", "LLM (gpt-4o-mini)"]

    entries = client.post("/api/analysis", json=payload).json()["audit"]

    summary = next(e for e in entries if e["action"] == "Anforderungsabgleich durchgeführt")
    assert "3 Kandidat(en)" in summary["detail"]
    assert "2x LLM (gpt-4o-mini)" in summary["detail"]
    assert "1x regelbasiert" in summary["detail"]


def test_a_fully_cached_rerun_still_reports_every_candidate(client):
    """The regression this guards: nothing to recompute must not mean "0
    Kandidat(en) geprüft" while N candidates sit on screen."""
    payload = _payload()
    payload["candidates"] = []
    payload["cached_backends"] = ["regelbasiert"] * 3

    response = client.post("/api/analysis", json=payload)

    assert response.status_code == 200
    assert response.json()["analyses"] == []
    summary = next(
        e for e in response.json()["audit"] if e["action"] == "Anforderungsabgleich durchgeführt"
    )
    assert "3 Kandidat(en)" in summary["detail"]


def test_cached_backends_defaults_to_empty(client):
    """A first run has nothing cached; the field must be optional."""
    response = client.post("/api/analysis", json=_payload())
    assert response.status_code == 200
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest tests/test_api_analysis.py -v`
Expected: FAIL — 404.

- [ ] **Step 3: Write the implementation**

Add to `api/main.py`:

```python
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
def post_analysis(payload: AnalysisIn) -> AnalysisOut:
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/test_api_analysis.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add api/main.py tests/test_api_analysis.py
git commit -m "Add the analysis endpoint"
```

---

### Task 11: `POST /api/email`

**Files:**
- Modify: `api/main.py`
- Create: `tests/test_api_email.py`

**Interfaces:**
- Consumes: `agents.rules.generate_email(candidate, selected_questions) -> tuple[str, str, str]` — returns `(to, subject, body)` in that order. Note it is **three** values: `to` falls back to `"bewerber@example.com"` when the CV had no email.
- Produces: `POST /api/email` → `{to: str, subject: str, body: str}`

**Why:** `generate_email` is local-only and never reaches OpenAI. The README says so explicitly; keep it that way.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_api_email.py`:

```python
from __future__ import annotations

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_an_email_draft_is_generated_from_the_selected_questions():
    response = client.post(
        "/api/email",
        json={
            "candidate": {
                "id": "c0", "name": "Lena", "source": "cv.txt",
                "raw_text": "text", "email": "lena@example.com",
            },
            "questions": ["Wie viele Jahre Python?"],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["to"] == "lena@example.com"
    assert body["subject"] == "Rückfragen zu Ihrer Bewerbung"
    assert "Sehr geehrte/r Lena," in body["body"]
    assert "1. Wie viele Jahre Python?" in body["body"]


def test_a_candidate_without_an_email_gets_the_placeholder_recipient():
    """cv_agent leaves email None when the CV never stated one; the draft is for
    human review, so it carries a placeholder rather than failing."""
    response = client.post(
        "/api/email",
        json={
            "candidate": {"id": "c0", "name": "Lena", "source": "cv.txt", "raw_text": "text"},
            "questions": ["Frage?"],
        },
    )
    assert response.json()["to"] == "bewerber@example.com"


def test_no_selected_questions_still_produces_a_draft():
    response = client.post(
        "/api/email",
        json={
            "candidate": {"id": "c0", "name": "Lena", "source": "cv.txt", "raw_text": "text"},
            "questions": [],
        },
    )
    assert response.status_code == 200
    assert "Mit freundlichen Grüßen" in response.json()["body"]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest tests/test_api_email.py -v`
Expected: FAIL — 404.

- [ ] **Step 3: Write the implementation**

Add to `api/main.py` (import `generate_email` from `agents.rules`):

```python
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/test_api_email.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add api/main.py tests/test_api_email.py
git commit -m "Add the email-draft endpoint"
```

---

### Task 12: CORS, rate limiting, and the OpenAPI export

**Files:**
- Modify: `api/main.py`
- Create: `tests/test_api_limits.py`
- Create: `scripts/export_openapi.py`
- Create: `.env.example`

**Interfaces:**
- Consumes: `slowapi`
- Produces: rate-limited `/api/job-profile`, `/api/cv`, `/api/analysis`; `scripts/export_openapi.py` writing `openapi.json`

**Why:** a public API carrying `OPENAI_API_KEY` is an open LLM proxy — trivially scriptable, unlike the Streamlit UI. `MAX_INPUT_CHARS` caps cost per call; nothing caps calls. This is the code half of the mitigation; the other half is a hard monthly spend cap set in the OpenAI dashboard, which is **not optional**.

`openapi.json` is the input to Phase 2: `web/src/api/types.ts` is generated from it.

- [ ] **Step 1: Write the failing test**

Create `tests/test_api_limits.py`:

```python
"""A public API on a paid key is an open LLM proxy without these limits."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import llm_agents
from api.main import app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(llm_agents, "llm_available", lambda: False)
    return TestClient(app)


def test_cors_is_not_open_to_every_origin(client):
    """`*` would let any site spend the key from a visitor's browser."""
    response = client.options(
        "/api/job-profile",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert response.headers.get("access-control-allow-origin") != "*"


def test_the_configured_origin_is_allowed(client):
    response = client.options(
        "/api/job-profile",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"},
    )
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_llm_endpoints_are_rate_limited(client):
    """Burst past the limit and expect a 429 rather than an unbounded bill."""
    codes = [
        client.post("/api/job-profile", json={"text": "Python"}).status_code
        for _ in range(35)
    ]
    assert 429 in codes, "no rate limit: the key is an open proxy"
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest tests/test_api_limits.py -v`
Expected: FAIL — CORS headers absent, no 429.

- [ ] **Step 3: Add CORS and rate limiting**

Add to `api/main.py`, directly after `app = FastAPI(...)`:

```python
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
```

Then decorate the three LLM-backed endpoints. Each handler must take `request: Request` as its first parameter (slowapi requires it — add `from fastapi import Request`):

```python
@app.post("/api/job-profile", response_model=JobProfileOut)
@limiter.limit(LLM_RATE_LIMIT)
def post_job_profile(request: Request, payload: JobProfileIn) -> JobProfileOut:
```

Apply the same two changes to `post_cv` and `post_analysis`. **Do not** rate-limit `/api/email`, `/api/demo`, or `/api/backend` — none of them reach OpenAI.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/test_api_limits.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the whole suite**

Run: `pytest -v`
Expected: all PASS. If the rate limit leaks between test files, give the limiter a per-test reset via `limiter.reset()` in the `client` fixture.

- [ ] **Step 6: Add the OpenAPI export**

Create `scripts/export_openapi.py`:

```python
"""Dump the OpenAPI schema to openapi.json.

web/src/api/types.ts is generated from this file, so the TypeScript types cannot
drift from the Python ones. Re-run this whenever a schema changes.
"""

from __future__ import annotations

import json
from pathlib import Path

from api.main import app

target = Path(__file__).parent.parent / "openapi.json"
target.write_text(json.dumps(app.openapi(), indent=2, ensure_ascii=False), encoding="utf-8")
print(f"wrote {target}")
```

Run: `python scripts/export_openapi.py`
Expected: `wrote .../openapi.json`. Open it and confirm `Status` appears as an enum of the four German values.

- [ ] **Step 7: Document the configuration**

Create `.env.example`:

```bash
# Optional: enables the LLM backend. Unset = rule-based, no data leaves the machine.
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# Comma-separated. Never "*" — a paid key sits behind this API.
ALLOWED_ORIGINS=http://localhost:5173

# Per-IP limit on the three LLM-backed endpoints.
LLM_RATE_LIMIT=30/minute
```

- [ ] **Step 8: Commit**

```bash
git add api/main.py tests/test_api_limits.py scripts/export_openapi.py .env.example openapi.json
git commit -m "Lock down CORS, rate-limit the LLM endpoints, export the schema"
```

---

## Phase 1 exit criteria

Before writing the Phase 2 plan, verify all of these:

- [ ] `pytest` fully green
- [ ] `grep -rn "streamlit" api/` returns **nothing**
- [ ] `streamlit run app.py` still works: demo data loads, matching runs, the audit log reads identically to before Task 1
- [ ] `uvicorn api.main:app` serves `/docs` with all six endpoints
- [ ] `openapi.json` exists and contains the `Status` / `Importance` / `Kind` enums
- [ ] A hard monthly spend cap is set on the OpenAI account (dashboard, not code)

**Still deliberately in `app.py`, to be deleted in Phase 5:** `cache_key`, `requirements_key`, `cache_get`, `cache_put`, `_h`, and every `render_*` function. The cache tests in `tests/test_parallel_cache.py:62-123` still point at `app.py` and stay valid until the React store takes over in Phase 3.

## What Phase 2 inherits

`openapi.json` is the input to `web/src/api/types.ts`. The Phase 2 plan is written **after** this phase lands, against the real generated type names rather than guessed ones.

The three cache tests in `tests/test_run_full_analysis.py` (`test_second_run_is_served_from_cache`, `test_changing_the_job_profile_invalidates_the_cache`, `test_a_failed_llm_call_is_retried_on_the_next_run`) are the specification for the React store's cache. Port them to Vitest in Phase 3, especially the last one: a fallback must never be cached, or one transient timeout pins a candidate to rule-based output for the whole session.
