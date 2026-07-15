# Design: Stateless API + React rewrite

**Date:** 2026-07-15
**Status:** Approved, not yet implemented
**Scope:** Project 1 of 2. Replace the Streamlit UI with a FastAPI service and a
Vite/React/TypeScript frontend. German-only; DE/EN i18n is Project 2.

---

## Why

The app is a portfolio piece meant to demonstrate both AI systems work and
frontend craft. A Streamlit UI cannot support the second claim, and the code
shows the app has already outgrown the framework:

| Signal | Count |
|---|---|
| `unsafe_allow_html=True` in `app.py` | 32 |
| `st.markdown` calls | 42 |
| `static/styles.css` rules targeting Streamlit internals (`data-testid`, `.stApp`) | 19 |
| `static/styles.css` | 405 lines |

The app hand-writes HTML and CSS anyway — paying React's costs without its
benefits — while styling against undocumented internals that can break on any
Streamlit minor release. `render_scroll_reveal()` runs a 0-height iframe that
reaches into `window.parent.document` to attach an `IntersectionObserver`, with
a safety timeout that force-reveals everything in case the hack fails. In React
that is a ten-line hook with nothing to fail open.

**Rejected alternatives:** Astro (optimizes static content; this app is a
stateful, upload-driven workspace — nearly all islands, no static content).
Angular (defensible but heavy; only pays off when targeting Angular shops).
Next.js (SSR buys little for a client-state-heavy workspace behind an intro
page, and costs a second runtime to deploy).

## Non-goals

- Persistence, auth, multi-user, or a database. The app is ephemeral by design
  and that is a compliance property, not a gap.
- i18n. Project 2.
- Any change to agent behaviour, prompts, or extraction logic.
- Visual redesign. This is a faithful port; the existing design is the target.

---

## Architecture

```
ai-hr-project/
├── api/                  # NEW — the only new Python
│   ├── main.py           # FastAPI app, CORS, rate limits, routes
│   ├── schemas.py        # Pydantic mirrors of models.py dataclasses
│   ├── orchestration.py  # from app.py: _run_parallel, run_full_analysis
│   └── demo_data.py      # DEMO_JOB, DEMO_CVS
├── agents/               # UNCHANGED (rules.py, dispatch.py)
├── llm_agents.py         # UNCHANGED
├── models.py             # UNCHANGED — still the contract
├── tests/                # retargeted, see Testing
├── web/                  # NEW — Vite + React + TS
└── app.py                # deleted in Phase 5
```

`models.py` remains the contract. `schemas.py` mirrors those dataclasses as
Pydantic models so `web/src/api/types.ts` is **generated from the OpenAPI
schema**, never hand-copied. Hand-copied types drift; generated types make the
`Literal` vocabularies in `models.py` enforceable all the way into the UI.

### Endpoints

Each wraps a function that already exists. All are stateless.

| Endpoint | Wraps | Returns |
|---|---|---|
| `POST /api/job-profile` | `analyze_job_profile` | `requirements[]`, `audit[]`, `backend` |
| `POST /api/cv` | `extract_text_from_upload` + `analyze_cv` | `candidate`, `audit[]`, `backend` |
| `POST /api/analysis` | `run_full_analysis` | matches/gaps/questions per candidate, `audit[]` |
| `POST /api/email` | `generate_email` | draft (never reaches OpenAI) |
| `GET /api/demo` | `DEMO_JOB` / `DEMO_CVS` | seed data |
| `GET /api/backend` | `backend_label` | header badge label |

### Decision: the audit log moves into the responses

`audit()` currently appends to `st.session_state`, which is precisely why it
cannot run on a worker thread. Instead each endpoint **returns** its
`AuditEntry` list and the client accumulates them in order.

This applies the `AgentRun` pattern one layer up: the dispatchers were made pure
so the caller could record what happened. The orchestration layer now does the
same. Same transparency record, no server state.

### Decision: the cache moves to the client

The obvious move is a server-side LRU keyed on a content hash. It is rejected.

The README claims: *"No candidate data is persisted — everything lives in the
session and is cleared when you reload or restart."* A server-side cache
silently breaks that — CV-derived results would outlive the session inside the
API process.

Putting the `Map` in the React store instead:

- preserves the current semantics exactly (per-session, cleared on reload)
- keeps `cache_put`'s rule intact: **a fallback is never cached**, so one
  transient timeout cannot pin a candidate to rule-based output
- leaves the server with **zero memory of any candidate, ever** — a stronger
  privacy claim than the app makes today, at no cost

The client sends only its uncached candidates to `POST /api/analysis`, mirroring
today's `todo = [cand for cand, key in zip(...) if cache_get(key) is None]`.
Parallelism stays server-side, where the LLM calls are: the server receives N
uncached candidates and fans out via `ThreadPoolExecutor` capped at
`MAX_PARALLEL_CALLS = 4`, preserving input order.

The client's cache key mirrors `cache_key(cand.raw_text, requirements_key(reqs))`.

---

## Frontend

```
web/src/
├── api/
│   ├── client.ts        # typed fetch wrappers
│   └── types.ts         # GENERATED from OpenAPI — do not hand-edit
├── store/session.ts     # the 10 session keys + the analysis cache Map
├── routes/
│   ├── Intro.tsx        │ Home.tsx
│   └── Workspace.tsx    │ CandidateDetail.tsx
├── features/            # stellenprofil, bewerbungen, kandidaten,
│                        # luecken, rueckfragen, audit
├── components/
│   ├── StatusPill.tsx   # STATUS_META
│   ├── Nav.tsx          │ BrandMark.tsx
│   ├── SplineScene.tsx  # replaces the masked iframe
│   └── Reveal.tsx       # replaces the parent-document hack
└── styles/              # CSS Modules
```

**State — Zustand.** The ten `session_state` keys (`job_text`, `requirements`,
`candidates`, `audit`, `analysis_cache`, `analysis_done`, `intro_done`, `page`,
`selected_candidate`, `email_drafts`) map to one small store. The
cache-and-filter logic from `run_full_analysis` ports almost literally.

**Routing — React Router.** Four routes replace `session_state.page`, with
`intro_done` as a guard on `/`.

**Styling — CSS Modules.** `static/styles.css` ports over largely intact, minus
the 19 selectors reaching into Streamlit internals, which are deleted. Tailwind
is rejected: it would mean rewriting all 405 lines to gain nothing the existing
stylesheet does not already provide.

**Type safety end to end.** `models.py` explains that the vocabularies are
`Literal`s "so a typo in a status or importance is caught by a type checker,
rather than by a recruiter noticing a blank pill in the UI." Today that
guarantee stops at the Python boundary — `STATUS_META` is a plain dict and an
unknown status still renders a blank pill. Generated types carry `Status`
through as a TS union, so `StatusPill`'s switch is exhaustiveness-checked at
compile time.

---

## Security

### The escaping guarantee

`_h()` disappears because JSX escapes by default; the bug class is structurally
gone for ordinary rendering. It returns through `dangerouslySetInnerHTML`. The
pressure points are `SplineScene` and any markdown rendering of a
`MatchResult.note` — model-controlled text in an HTML sink. `_kann_marker()`
already returns markdown (`*(Kann-Anforderung)*`), which is how that pressure
starts.

The guarantee is carried by three things that do not rely on vigilance:

1. **ESLint `react/no-danger` as an error.** `dangerouslySetInnerHTML` becomes a
   reviewed exception, not a quiet convenience.
2. **`test_cv_agent_name_is_attacker_controlled` stays in Python, untouched.**
   The hazard — `cv_agent` lifting a display name straight out of an uploaded
   document — is unchanged by this rewrite.
3. **A new React regression test** rendering a candidate named
   `<img src=x onerror=alert(1)>` and asserting it appears as literal text.

Do not render `MatchResult.note`, `Candidate.name`, `Gap.description`, or
`source` through a markdown renderer. Prefer a component over markdown for
`_kann_marker`'s role.

### New surface introduced by the split

A single-process Streamlit app becomes an HTTP API. Three consequences:

- **CORS** pinned to the frontend origin. Never `*`.
- **Upload cap** on `POST /api/cv`. Streamlit's default upload limit disappears
  with Streamlit, and the endpoint hands uploads to pymupdf. `MAX_INPUT_CHARS`
  caps tokens per call but does not cap parsing work.
- **Rate limiting.** A public API carrying `OPENAI_API_KEY` is an open LLM proxy
  — trivially scriptable, unlike the Streamlit UI. `MAX_INPUT_CHARS` caps cost
  per call; nothing caps calls. Mitigation: per-IP rate limit (`slowapi`) on the
  three LLM-backed endpoints, plus a hard monthly spend cap at the OpenAI
  account level. Worst case is a capped bill rather than an unbounded one.

---

## Testing

Six of nine test files currently import `app`. They cover logic that **moves**
rather than disappears, so they move with it.

| Test | Fate |
|---|---|
| `test_extraction.py` | Untouched — already Streamlit-free |
| `test_gaps.py` | Untouched |
| `test_prompt_safety.py` | Untouched |
| `test_dispatch.py` | Retarget import `app` → `api` |
| `test_audit.py` | Retarget: assert endpoints *return* audit entries |
| `test_parallel_cache.py` | Parallelism half → `api/orchestration`; cache half → Vitest |
| `test_run_full_analysis.py` | Retarget → `api/orchestration` |
| `test_demo_pipeline.py` | Becomes an API-level end-to-end via `TestClient` |
| `test_escaping.py` | Hazard test stays Python; escaping assertions → React test |

**New Python:** FastAPI `TestClient` tests. These must need **no API key and no
network**, preserving the suite's current property.

**New TypeScript:** Vitest + React Testing Library covering the store —
specifically the cache-filter and the "never cache a fallback" rule, since that
logic crosses into the client — plus `StatusPill` and the escaping regression.

---

## Migration sequence

The app stays runnable at every step until the last. The Python side is proven
before a line of React exists.

**Phase 1 — Extract the API; Streamlit still running.**
Move `_run_parallel`, `run_full_analysis`, `cache_*` and `audit` into
`api/orchestration.py`, rewritten as pure functions returning
`(result, audit_entries)`. **`app.py` keeps working by importing from `api/`.**
Add FastAPI routes, `schemas.py`, and `TestClient` tests. Retarget the five
affected tests. Exit: existing suite green, Streamlit app still behaves
identically. If the extraction is wrong, it surfaces here rather than while also
debugging React.

**Phase 2 — React scaffold + visual pages.**
Vite, TS, router, store, generated `types.ts`. Port the CSS. Build `Intro` and
`Home`, including `SplineScene` and `Reveal`. Highest portfolio value, minimal
API dependency.

**Phase 3 — Workspace.** Six tabs against the live API. Store cache-and-filter
logic. `StatusPill` with exhaustive `Status` handling.

**Phase 4 — Candidate detail and polish.**

**Phase 5 — Delete `app.py`.** Remove Streamlit from `requirements.txt`. Deploy
config: CORS, upload cap, rate limits, spend cap.

---

## Definition of done

- Streamlit is gone from the repo and from `requirements.txt`
- `pytest` green; `vitest` green; `react/no-danger` clean
- The app runs **with and without** `OPENAI_API_KEY`, and the LLM→rules fallback
  remains visible in the UI and the audit log — the transparency property
  survives the port
- README updated, specifically:
  - the cache is now client-side (a stronger privacy claim than today)
  - "only `app.py` imports Streamlit" becomes "no Python imports Streamlit"
  - the regex-redaction limits section carries over **unchanged** — still true,
    and one of the most valuable things in the repo

---

## Follow-on

**Project 2 — Full DE/EN i18n.** German is not only in the UI: it is in
`rueckfragen_agent()` templates, `informationsluecken_agent()` descriptions,
`generate_email()`, `MatchResult.note` (both backends, and prompt-instructed for
the LLM), `audit()` strings, `summarize_backends()`, and `EDU_LABELS` in
`models.py`. It requires threading a `lang` parameter through the dispatchers
into both backends, English few-shots in every prompt, and duplicated templates.

It is sequenced second deliberately: doing it first would mean internationalizing
every German string in `app.py` and then deleting that work. On the new stack the
UI strings get internationalized once, in their final home.
