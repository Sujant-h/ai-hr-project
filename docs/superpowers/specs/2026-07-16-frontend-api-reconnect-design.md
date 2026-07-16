# Spec A — Reconnect the frontend to the API

**Date:** 2026-07-16
**Status:** Approved, ready to plan
**Depends on:** nothing
**Blocks:** [Spec B — Frontend UI/UX/performance pass](2026-07-16-frontend-ui-ux-performance-design.md)

## Problem

The React frontend in `web/` was written against an API that does not exist. It
does not compile, and three of the five endpoints it calls would fail at
runtime. The UI renders fields that appear in no backend schema. No screening
run can complete end to end today.

This was not visible from the frontend alone: `vite dev` does not typecheck, and
every API failure is swallowed into the audit log on tab 6, which a user has to
deliberately open to see.

### Evidence

**The build is broken — twice over.** `npm run build` runs `tsc -b && vite build`;
`tsc -b` exits 2. There are two independent blockers, and the first masks the
second.

*Blocker 1 — the config.* `tsc` refuses the project before typechecking a single
file:

```
tsconfig.app.json:3:5 - error TS5101: Option 'baseUrl' is deprecated and will
stop functioning in TypeScript 7.0. Specify compilerOption
'"ignoreDeprecations": "6.0"' to silence this error.
```

`package.json` pins `typescript: ~6.0.2`, where `baseUrl` is deprecated. Fix by
dropping `baseUrl` from `tsconfig.app.json` and letting the `paths` alias for
`@/*` resolve relative to the config file, which is the TS 6 behaviour and needs
no `baseUrl`. Do **not** silence it with `ignoreDeprecations` — that only defers
the same failure to TypeScript 7.

*Blocker 2 — the types.* Once the config parses, five references resolve to
nothing in the generated `web/src/api/types.ts` (confirmed: `TS2339`, exit 2):

| Reference | Site |
|---|---|
| `components['schemas']['PipelineResult']` | `api/client.ts:9`, `store/session.ts:6` |
| `components['schemas']['EmailDraftOut']` | `api/client.ts:10` |
| `components['schemas']['CandidateAnalysis']` | `store/session.ts:4` |
| `components['schemas']['JobRequirement']` | `store/session.ts:5` |

**The generated types are not at fault.** `openapi.json` matches `api/main.py`,
and `web/src/api/types.ts` is byte-identical to a fresh regeneration from it
(verified by re-running `openapi-typescript` and diffing). The pipeline in
`scripts/export_openapi.py` works and has been doing its job.

The four names above are not *stale* — they have **never existed** in this
schema. `client.ts` and `session.ts` were hand-written against an imagined API
and never wired to the real one. Nothing needs regenerating; the hand-written
layer needs replacing with the generated types it already imports and ignores.

**Three endpoints are wrong.**

| Client sends | Backend expects | Result |
|---|---|---|
| `POST /api/cv` JSON `{filename, text}` | multipart Form `name, index, text?, file?` | 422 |
| `POST /api/analysis` `{job_text, cvs}` | `{requirements, candidates, cached_backends}` | 422 |
| `POST /api/email-draft` | route is `/api/email`, body `{candidate, questions}` | 404 |

`GET /api/backend` and `GET /api/demo` match the backend but are never called.

**The UI reads fields that do not exist.** Against `api/schemas.py`:

| UI reads | Reality |
|---|---|
| `res.decision.is_match` (Match/Kein Match badge) | no `decision` field anywhere |
| `res.email_draft` (all of Tab 5's preview) | no such field; drafts come from `POST /api/email` |
| `result.extracted_profile.skills` | `candidate.skills` |
| `res.candidate_results[]` | `AnalysisOut.analyses[].candidate` |
| `g.requirement` | `GapOut.requirement_label` |
| `m.requirement` | `MatchResultOut.label` |
| `c.filename` | `CandidateOut.name` + `CandidateOut.source` |
| `activeBackend: 'Rule-Based Sandbox' \| 'LLM Intelligence'` | `BackendOut.label: string`, actual values `"regelbasiert"` or `"LLM (<model>)"` (`agents/dispatch.py:28`) |

The backend label deserves note: `backend_label()` returns a free-form German
display string, not a union. The two literals the store declares match nothing
the server can ever send, so even a wired-up `getBackend()` call would leave the
banner wrong. The banner condition becomes `label === "regelbasiert"` — reliable
because `dispatch.py:28` returns exactly that string when no LLM is available,
and an `LLM (...)` string otherwise.

## Goals

1. `npm run build` passes — both blockers cleared.
2. A full screening run completes against the real backend: job profile →
   CV upload (PDF and .txt) → analysis → candidate detail → email draft.
3. Types are generated from the Python schema, not hand-written, so they cannot
   drift again.
4. Re-running an analysis costs no LLM calls.

## Non-goals

Visual design, performance, and accessibility are Spec B. This spec changes what
the components render, not how they look. The one exception is the Workspace tab
split (below), which is included because those components are being rewritten
here anyway and splitting them later would mean editing every one twice.

## Design

### 1. Type generation

`types.ts` is already correct and needs no regeneration. But the two-step
pipeline (`python scripts/export_openapi.py`, then `openapi-typescript`) is
undocumented in `package.json` and must be run by hand, which is how the
hand-written layer drifted from it unnoticed. Add:

```json
"gen:types": "python ../scripts/export_openapi.py && openapi-typescript ../openapi.json -o src/api/types.ts"
```

`openapi-typescript` is already a devDependency with nothing invoking it. The
script must be a no-op diff on a clean tree; a task verifies that.

The `Literal` unions in `api/schemas.py` (`Status`, `Importance`, `Kind`) become
TypeScript unions. `schemas.py` states this is deliberate: an unhandled status
must be a compile error rather than a blank pill. The UI must therefore handle
all four `Status` values — `erfuellt`, `teilweise`, `offen`, `nicht_erfuellt`.
Today it collapses `offen` and `nicht_erfuellt` into one "Nicht erfüllt" pill,
losing the distinction between *unknown* and *known-absent*.

### 2. API client

Rewrite `web/src/api/client.ts` against `openapi.json`:

- `getBackend()` → `GET /api/backend` → `{label}`
- `getDemo()` → `GET /api/demo` → `{job_text, cvs[]}`
- `parseJobProfile(text)` → `POST /api/job-profile` → `{requirements, audit, backend}`
- `uploadCv({name, index, file?, text?})` → `POST /api/cv` as **`FormData`**,
  no `Content-Type` header (the browser must set the multipart boundary itself;
  the current code hardcodes `application/json` on every request, which would
  break this even with the right body)
- `analyze({requirements, candidates, cached_backends})` → `POST /api/analysis`
- `draftEmail({candidate, questions})` → `POST /api/email` → `{to, subject, body}`

Error handling gains two cases the backend can actually return:

- **429** from `slowapi` (`LLM_RATE_LIMIT`, default `30/minute`)
- **413** from `MAX_UPLOAD_BYTES` (10 MB), detail `"Datei zu groß (max. 10 MB)."`

These surface as typed errors so the UI can show the backend's German message
rather than a generic failure.

### 3. Store

`web/src/store/session.ts` changes shape to mirror the backend:

- `candidates: CandidateOut[]` keyed by `id`, not `{filename, content}`
- `requirements: RequirementOut[]` — `POST /api/analysis` needs the parsed
  requirements, not the raw job text. This is why the current call 422s.
- audit entries come **from the backend** (`AuditEntryOut[]` on every response)
  and are appended to the log, rather than being invented client-side. The
  backend already emits richer entries than the UI fabricates, including which
  agent ran and why a fallback happened.

**No persistence.** `README.md:436` and the `api/main.py` docstring both state
that candidate data is never stored and is cleared on reload. This is a privacy
promise, not an oversight. The store stays in memory. Do not add `persist`.

### 4. Client-side analysis cache

`api/main.py` states the client owns the cache; `AnalysisIn.cached_backends` and
`CandidateAnalysisOut.fallback_reason` exist solely to serve it and are dead
code without it.

- Key: a hash of `candidate.raw_text` plus the requirement set — the actual
  inputs to the analysis. This mirrors the backend's own documented approach
  ("caches each result on a hash of its input", `README.md:114`) and holds
  because the agents run at `temperature=0`, so identical input yields identical
  output.

  **The key must not be `candidate.id`.** `id` is `f"cand_{idx}"` — a
  positional index (`agents/rules.py:261`, `llm_agents.py:579`), not an
  identity. Remove a candidate and upload a different one, and `cand_0` now
  denotes a different person while hitting the same cache entry, showing one
  candidate's analysis under another's name. Hash the content.

  Note that `raw_text` is the redacted markdown on the LLM path
  (`llm_agents.py:583`), which is the correct thing to hash.
- On analyze: send only candidates with no cache entry. Pass the backend labels
  of the cached ones in `cached_backends`, so the audit summary reports "3
  Kandidat(en) geprüft" rather than "0" when everything was cached.
- **Never cache a result with a non-null `fallback_reason`.** `schemas.py` is
  explicit: a transient LLM failure must not pin a candidate to rule-based
  output for the rest of the session.
- In memory only, cleared on reload, per the privacy promise above.

### 5. Restoring documented features

- **PDF upload.** The backend handles it via `llm_agents.pdf_to_markdown`
  (pymupdf4llm, falling back to pypdf) with a 10 MB cap. Remove the
  `alert('PDF upload requires formData backend modification')` — it is simply
  false. Accept `.pdf` and `.txt`, send both as `FormData`. The landing page's
  "als PDF oder Text" copy becomes true and stays.
- **"Demo-Daten laden".** Documented at `README.md:31` and `README.md:410`,
  served by `GET /api/demo`, missing from the frontend. The workspace's own
  alert tells users to "Use Demo-Daten for now" — a button that does not exist.
  Add it to the Bewerbungen tab.
- **Backend label.** Call `getBackend()` on mount and store the result. The
  "Kein LLM aktiv" banner is currently hardcoded to always show, because
  `activeBackend` is initialized to `'Rule-Based Sandbox'` and never written to.

### 6. Workspace split

`web/src/pages/Workspace.tsx` is 418 lines holding six tabs inline. Every tab
reads a wrong data shape and must be rewritten regardless. Split into:

```
src/pages/workspace/
  Workspace.tsx        shell: tab state, backend banner, layout
  JobProfileTab.tsx    ① requirements
  UploadTab.tsx        ② upload + demo data + run analysis
  CandidatesTab.tsx    ③ ranking
  GapsTab.tsx          ④ gaps
  QuestionsTab.tsx     ⑤ questions + email draft
  AuditTab.tsx         ⑥ (existing AuditLog)
```

Each tab takes typed props and can be read and tested on its own. Tabs ③④⑤ all
map over the same `analyses` array and share a candidate-card component.

Tab ⑤'s email draft is a behavioural change, not a rename: there is no
`email_draft` field on any response. The draft is fetched from
`POST /api/email` per candidate, on demand, when the user asks for it. The
`mailto:` link is built from the returned `{to, subject, body}`.

### 7. Correctness fixes bundled here

These are cheap, sit in the files already being rewritten, and are prerequisites
for verifying the flow:

- **Spline script.** `Workspace.tsx:102` renders `<spline-viewer>`, but the
  script defining that element is injected only by `Intro.tsx` on Home. Landing
  directly on `/workspace` leaves the element un-upgraded and the scene blank.
  Extract a `useSplineViewer()` hook that loads it once, idempotently, and does
  not remove it on unmount — the current `document.head.removeChild(script)`
  cleanup also breaks under StrictMode's double-invoke. (Spec B replaces the
  loading *strategy*; this makes it correct first.)
- **`CandidateDetail`** returns `null` before `AnimatePresence` mounts, so the
  exit animation can never run. Move the condition inside.
- **Errors must be visible.** Every failure currently lands only in the audit
  log on tab 6. Surface an inline error on the acting tab.
- **Dead code.** Delete `App.css` (184 lines, never imported), `SplineScene.tsx`
  (an unused iframe), `src/assets/{hero,react,vite}.{png,svg}`, and the `.stApp`
  Streamlit leftover in `App.tsx`.
- **Undefined CSS.** `hide-scrollbar` (workspace tab strip, home gallery) and
  the `fadeUp`/`bob` keyframes (`Intro.tsx`) are referenced but defined nowhere;
  `.hero`/`.lift` live in the never-imported `App.css`, so the intro's lift
  animation does nothing and then blanks abruptly. Define `hide-scrollbar` in
  `index.css`. Delete the dangling `fadeUp`/`bob`/`.hero`/`.lift` references
  rather than implementing them: Spec B merges the intro into the hero and
  deletes `Intro.tsx` outright, so implementing them here would be wasted work.

## Verification

- `npm run build` exits 0.
- Full run against a live backend: load Demo-Daten → parse profile → upload one
  `.pdf` and one `.txt` → analyze → open a candidate → generate an email draft.
  Verify the audit log shows backend-sourced entries naming each agent.
- Re-run the analysis unchanged: confirm zero `POST /api/analysis` candidates
  sent and the audit summary still counts every candidate.
- Force a fallback (unset the OpenAI key): confirm the result is not cached and
  the banner reports the rule-based backend.
- Confirm a >10 MB file shows the backend's German 413 message.

## Deployment note

`ALLOWED_ORIGINS` defaults to `http://localhost:5173`. A public deployment must
set it to the real frontend origin or every request fails CORS. Out of scope
here; flagged because Spec B assumes a public link.
