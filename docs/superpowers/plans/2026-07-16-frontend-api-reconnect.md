# Frontend API Reconnect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `web/` build and complete a real screening run against `api/`.

**Architecture:** The generated types in `web/src/api/types.ts` are correct and
already match `api/main.py` — they are the contract. Every hand-written layer
above them (`client.ts`, `session.ts`, the Workspace tabs) is rewritten to use
them instead of the imagined API it was written against. The store mirrors
backend shapes rather than inventing its own, audit entries come from server
responses, and an in-memory content-hashed cache spares repeat LLM calls.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Zustand 5, Tailwind 3, Radix,
Vitest + Testing Library (added by Task 1), FastAPI backend (unchanged).

**Spec:** `docs/superpowers/specs/2026-07-16-frontend-api-reconnect-design.md`

## Global Constraints

- **Never modify `api/`, `agents/`, `models.py`, or `llm_agents.py`.** This is a
  frontend plan. The backend is correct and has 18 passing test files.
- **Never hand-write a type that `types.ts` already generates.** Import from
  `src/api/types.ts`. If a shape is missing, the fix is `npm run gen:types`,
  not a hand-written interface.
- **No persistence.** No `localStorage`, no `sessionStorage`, no zustand
  `persist`. `README.md:436` and the `api/main.py` docstring state candidate data
  is cleared on reload. This is a privacy promise.
- **Never cache an analysis whose `fallback_reason` is non-null.**
- **Never key the cache on `Candidate.id`** — it is `f"cand_{idx}"`, a positional
  index (`agents/rules.py:261`).
- All user-facing copy is **German**. Match the existing tone.
- Run commands from `web/`. On this machine the repo is at a UNC path where
  `npx` fails; use `wsl.exe -d Ubuntu -- bash -lc 'cd ~/projects/ai-hr-project/web && <cmd>'`.
- The dev server proxies `/api` to `http://127.0.0.1:8000` (`vite.config.ts`).
  Backend: `uvicorn api.main:app --reload` from the repo root.

---

### Task 1: Test infrastructure

`web/` has no test runner. Nothing below can be TDD'd until it does.

**Files:**
- Modify: `web/package.json`
- Modify: `web/vite.config.ts`
- Create: `web/src/test/setup.ts`
- Create: `web/src/lib/cache.test.ts` (throwaway smoke test, deleted in Step 5)

**Interfaces:**
- Consumes: nothing
- Produces: `npm test` (watch) and `npm run test:run` (once) in `web/`

- [ ] **Step 1: Install dev dependencies**

```bash
npm i -D vitest@^3 @vitest/coverage-v8@^3 jsdom@^26 \
  @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14
```

- [ ] **Step 2: Add the setup file**

Create `web/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 3: Configure Vitest**

In `web/vite.config.ts`, add a `test` key to the existing `defineConfig` object
(keep the existing `plugins`, `resolve`, and `server` keys untouched). Change
the import on line 2 to `import { defineConfig } from 'vitest/config'`:

```ts
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
```

Add to `web/package.json` scripts:

```json
"test": "vitest",
"test:run": "vitest run",
"gen:types": "python ../scripts/export_openapi.py && openapi-typescript ../openapi.json -o src/api/types.ts"
```

- [ ] **Step 4: Write a smoke test and verify the runner works**

Create `web/src/lib/cache.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('vitest', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm run test:run`
Expected: PASS, 1 test.

- [ ] **Step 5: Delete the smoke test and commit**

```bash
rm src/lib/cache.test.ts
git add web/package.json web/package-lock.json web/vite.config.ts web/src/test/setup.ts
git commit -m "test: add vitest and testing-library to web/"
```

---

### Task 2: Unblock the build

Two independent blockers. Fix both; this task's deliverable is `npm run build`
exiting 0, which no later task can verify without it.

**Files:**
- Modify: `web/tsconfig.app.json:3`
- Modify: `web/src/api/client.ts:9-10`
- Modify: `web/src/store/session.ts:4-6`

**Interfaces:**
- Consumes: nothing
- Produces: a green `npm run build`. Tasks 3+ rely on `tsc` catching their errors.

- [ ] **Step 1: Verify the build fails, and how**

Run: `npm run build`
Expected: FAIL. `tsconfig.app.json:3:5 - error TS5101: Option 'baseUrl' is deprecated`.

- [ ] **Step 2: Remove the deprecated `baseUrl`**

In `web/tsconfig.app.json`, delete the `"baseUrl": "."` line. Leave `paths`
alone — under TypeScript 6 it resolves relative to the config file, so the
`@/*` alias keeps working without `baseUrl`. Do not add `ignoreDeprecations`;
that only defers the same failure to TypeScript 7.

- [ ] **Step 3: Run the build again to reveal the second blocker**

Run: `npm run build`
Expected: FAIL, but differently — `TS2339: Property 'PipelineResult' does not
exist`, plus `EmailDraftOut`, `CandidateAnalysis`, `JobRequirement`.

This is the point: the config error was masking four real errors.

- [ ] **Step 4: Point the dangling references at real schema names**

This is a deliberately minimal, compile-only fix — Tasks 4 and 5 rewrite both
files properly. The goal is a green build to test against, nothing more.

In `web/src/api/client.ts`, replace lines 9-10:

```ts
export type AnalysisOut = components['schemas']['AnalysisOut'];
export type EmailOut = components['schemas']['EmailOut'];
```

Update the two uses: `fetcher<PipelineResult>` → `fetcher<AnalysisOut>` (line
53), `fetcher<EmailDraftOut>` → `fetcher<EmailOut>` (line 59).

In `web/src/store/session.ts`, replace lines 4-6:

```ts
type CandidateAnalysisOut = components['schemas']['CandidateAnalysisOut'];
type RequirementOut = components['schemas']['RequirementOut'];
type AnalysisOut = components['schemas']['AnalysisOut'];
```

Update uses: `JobRequirement[]` → `RequirementOut[]` (line 22), `PipelineResult`
→ `AnalysisOut` (lines 32, 48). `CandidateAnalysisOut` is imported but unused
here for now; Task 5 uses it. Prefix it with `_` or leave it — `tsc` does not
error on unused types, but `oxlint` may warn.

- [ ] **Step 5: Verify the build passes**

Run: `npm run build`
Expected: PASS, exit 0.

Note: it now *compiles* but is still wrong at runtime — the client still posts
JSON to a multipart endpoint. Tasks 4-8 fix behaviour.

- [ ] **Step 6: Verify gen:types is a no-op on a clean tree**

Run: `npm run gen:types && git diff --exit-code src/api/types.ts`
Expected: exit 0, no diff. Proves the generated types are current and the
script is wired correctly.

- [ ] **Step 7: Commit**

```bash
git add web/tsconfig.app.json web/src/api/client.ts web/src/store/session.ts
git commit -m "fix(web): unblock the build

tsc -b failed on TS5101 (baseUrl deprecated under the pinned typescript 6),
which masked four TS2339 errors: client.ts and session.ts referenced schema
names that never existed in openapi.json."
```

---

### Task 3: The analysis cache

Pure logic, no React. Built first so Task 6 can consume it.

**Files:**
- Create: `web/src/lib/analysisCache.ts`
- Create: `web/src/lib/analysisCache.test.ts`

**Interfaces:**
- Consumes: `CandidateOut`, `RequirementOut`, `CandidateAnalysisOut` from `src/api/types.ts`
- Produces:
  - `cacheKey(candidate: CandidateOut, requirements: RequirementOut[]): string`
  - `class AnalysisCache` with:
    - `get(candidate, requirements): CandidateAnalysisOut | undefined`
    - `set(candidate, requirements, analysis: CandidateAnalysisOut): void` — a no-op when `analysis.fallback_reason` is non-null
    - `clear(): void`

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/analysisCache.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { AnalysisCache, cacheKey } from './analysisCache';
import type { components } from '../api/types';

type CandidateOut = components['schemas']['CandidateOut'];
type RequirementOut = components['schemas']['RequirementOut'];
type CandidateAnalysisOut = components['schemas']['CandidateAnalysisOut'];

const req: RequirementOut = {
  id: 'r0', label: 'Python', kind: 'skill', value: 'Python', importance: 'muss',
};

function candidate(over: Partial<CandidateOut> = {}): CandidateOut {
  return {
    id: 'cand_0', name: 'Lena', source: 'cv.txt', raw_text: 'Skills: Python',
    skills: ['Python'], years: null, education: 0, education_label: 'unbekannt',
    languages: [], email: null, matches: [], gaps: [], questions: [], ...over,
  };
}

function analysis(over: Partial<CandidateAnalysisOut> = {}): CandidateAnalysisOut {
  return { candidate: candidate(), backend: 'regelbasiert', fallback_reason: null, ...over };
}

describe('cacheKey', () => {
  it('is stable for identical content', () => {
    expect(cacheKey(candidate(), [req])).toBe(cacheKey(candidate(), [req]));
  });

  it('ignores id, because id is a positional index and not an identity', () => {
    const first = cacheKey(candidate({ id: 'cand_0' }), [req]);
    const second = cacheKey(candidate({ id: 'cand_7' }), [req]);
    expect(first).toBe(second);
  });

  it('changes when the CV text changes', () => {
    const a = cacheKey(candidate({ raw_text: 'Skills: Python' }), [req]);
    const b = cacheKey(candidate({ raw_text: 'Skills: Go' }), [req]);
    expect(a).not.toBe(b);
  });

  it('changes when the requirements change', () => {
    const other: RequirementOut = { ...req, id: 'r1', label: 'Go', value: 'Go' };
    expect(cacheKey(candidate(), [req])).not.toBe(cacheKey(candidate(), [other]));
  });

  it('does not depend on requirement order', () => {
    const other: RequirementOut = { ...req, id: 'r1', label: 'Go', value: 'Go' };
    expect(cacheKey(candidate(), [req, other])).toBe(cacheKey(candidate(), [other, req]));
  });
});

describe('AnalysisCache', () => {
  it('returns undefined on a miss', () => {
    expect(new AnalysisCache().get(candidate(), [req])).toBeUndefined();
  });

  it('round-trips a stored analysis', () => {
    const cache = new AnalysisCache();
    const stored = analysis();
    cache.set(candidate(), [req], stored);
    expect(cache.get(candidate(), [req])).toEqual(stored);
  });

  it('refuses to store a fallback, so one transient LLM failure cannot pin a candidate to rule-based output', () => {
    const cache = new AnalysisCache();
    cache.set(candidate(), [req], analysis({ fallback_reason: 'timeout' }));
    expect(cache.get(candidate(), [req])).toBeUndefined();
  });

  it('does not serve one candidate under another candidate name', () => {
    const cache = new AnalysisCache();
    cache.set(candidate({ name: 'Lena', raw_text: 'Skills: Python' }), [req], analysis());
    const different = candidate({ id: 'cand_0', name: 'Marc', raw_text: 'Skills: Go' });
    expect(cache.get(different, [req])).toBeUndefined();
  });

  it('clears', () => {
    const cache = new AnalysisCache();
    cache.set(candidate(), [req], analysis());
    cache.clear();
    expect(cache.get(candidate(), [req])).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run src/lib/analysisCache.test.ts`
Expected: FAIL — cannot resolve `./analysisCache`.

- [ ] **Step 3: Implement**

Create `web/src/lib/analysisCache.ts`:

```ts
import type { components } from '../api/types';

type CandidateOut = components['schemas']['CandidateOut'];
type RequirementOut = components['schemas']['RequirementOut'];
type CandidateAnalysisOut = components['schemas']['CandidateAnalysisOut'];

/** Hash the inputs to an analysis, mirroring the backend's own approach
 *  (README.md:114). Safe because the agents run at temperature=0.
 *
 *  Deliberately excludes `id`: it is `f"cand_{idx}"`, a positional index
 *  (agents/rules.py:261). Keying on it would serve a previous candidate's
 *  analysis under a new candidate's name after a re-upload. */
export function cacheKey(candidate: CandidateOut, requirements: RequirementOut[]): string {
  const reqs = [...requirements]
    .map(r => `${r.id} ${r.label} ${r.kind} ${String(r.value)} ${r.importance}`)
    .sort()
    .join('');
  return djb2(`${candidate.raw_text}${reqs}`);
}

function djb2(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

export class AnalysisCache {
  private entries = new Map<string, CandidateAnalysisOut>();

  get(candidate: CandidateOut, requirements: RequirementOut[]): CandidateAnalysisOut | undefined {
    return this.entries.get(cacheKey(candidate, requirements));
  }

  /** A result carrying a fallback_reason is never stored: otherwise one
   *  transient timeout pins a candidate to rule-based output for the whole
   *  session (api/schemas.py, CandidateAnalysisOut). */
  set(candidate: CandidateOut, requirements: RequirementOut[], analysis: CandidateAnalysisOut): void {
    if (analysis.fallback_reason) return;
    this.entries.set(cacheKey(candidate, requirements), analysis);
  }

  clear(): void {
    this.entries.clear();
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run src/lib/analysisCache.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/analysisCache.ts web/src/lib/analysisCache.test.ts
git commit -m "feat(web): add the content-hashed analysis cache

Keyed on raw_text plus the requirement set, never on Candidate.id, which is a
positional index. Refuses to store a result carrying a fallback_reason."
```

---

### Task 4: The API client

**Files:**
- Rewrite: `web/src/api/client.ts`
- Create: `web/src/api/client.test.ts`

**Interfaces:**
- Consumes: `components` from `src/api/types.ts`
- Produces:
  - `class ApiError extends Error` with `status: number`
  - `apiClient.getBackend(): Promise<BackendOut>`
  - `apiClient.getDemo(): Promise<DemoOut>`
  - `apiClient.parseJobProfile(text: string): Promise<JobProfileOut>`
  - `apiClient.uploadCv(input: { name: string; index: number; file?: File; text?: string }): Promise<CvOut>`
  - `apiClient.analyze(input: { requirements: RequirementOut[]; candidates: CandidateOut[]; cached_backends: string[] }): Promise<AnalysisOut>`
  - `apiClient.draftEmail(input: { candidate: CandidateOut; questions: string[] }): Promise<EmailOut>`

- [ ] **Step 1: Write the failing tests**

Create `web/src/api/client.test.ts`. These pin the exact contract asserted by
`tests/test_api_cv.py` and `tests/test_api_analysis.py`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, ApiError } from './client';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}
function err(status: number, body: unknown) {
  return Promise.resolve({ ok: false, status, statusText: 'x', json: () => Promise.resolve(body) });
}

describe('uploadCv', () => {
  it('posts multipart, because /api/cv reads Form fields not JSON', async () => {
    fetchMock.mockReturnValue(ok({ candidate: {}, audit: [], backend: 'regelbasiert' }));
    const file = new File(['Skills: Python'], 'cv.txt', { type: 'text/plain' });
    await apiClient.uploadCv({ name: 'Lena', index: 0, file });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/cv');
    expect(init.body).toBeInstanceOf(FormData);
    const body = init.body as FormData;
    expect(body.get('name')).toBe('Lena');
    expect(body.get('index')).toBe('0');
    expect(body.get('file')).toBe(file);
  });

  it('never sets Content-Type, so the browser can set the multipart boundary', async () => {
    fetchMock.mockReturnValue(ok({ candidate: {}, audit: [], backend: 'regelbasiert' }));
    await apiClient.uploadCv({ name: 'L', index: 0, file: new File(['x'], 'cv.txt') });

    const headers = fetchMock.mock.calls[0][1]?.headers ?? {};
    expect(Object.keys(headers).map(k => k.toLowerCase())).not.toContain('content-type');
  });

  it('sends pasted text as a Form field', async () => {
    fetchMock.mockReturnValue(ok({ candidate: {}, audit: [], backend: 'regelbasiert' }));
    await apiClient.uploadCv({ name: 'Lena', index: 2, text: 'Skills: Python' });

    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get('text')).toBe('Skills: Python');
    expect(body.get('index')).toBe('2');
    expect(body.has('file')).toBe(false);
  });

  it('surfaces the German 413 message for an oversized upload', async () => {
    fetchMock.mockReturnValue(err(413, { detail: 'Datei zu groß (max. 10 MB).' }));
    await expect(
      apiClient.uploadCv({ name: 'X', index: 0, file: new File(['x'], 'big.txt') }),
    ).rejects.toMatchObject({ status: 413, message: 'Datei zu groß (max. 10 MB).' });
  });
});

describe('analyze', () => {
  it('posts requirements and candidates, not job_text and cvs', async () => {
    fetchMock.mockReturnValue(ok({ analyses: [], audit: [] }));
    await apiClient.analyze({ requirements: [], candidates: [], cached_backends: ['regelbasiert'] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/analysis');
    expect(JSON.parse(init.body as string)).toEqual({
      requirements: [], candidates: [], cached_backends: ['regelbasiert'],
    });
  });
});

describe('draftEmail', () => {
  it('posts to /api/email with candidate and questions', async () => {
    fetchMock.mockReturnValue(ok({ to: 'a@b.c', subject: 's', body: 'b' }));
    await apiClient.draftEmail({ candidate: { id: 'c0' } as never, questions: ['Warum?'] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/email');
    expect(JSON.parse(init.body as string).questions).toEqual(['Warum?']);
  });
});

describe('errors', () => {
  it('raises ApiError with the status for a rate limit', async () => {
    fetchMock.mockReturnValue(err(429, { detail: 'Rate limit exceeded' }));
    const e = await apiClient.getBackend().catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).status).toBe(429);
  });

  it('survives an error body that is not JSON', async () => {
    fetchMock.mockReturnValue(
      Promise.resolve({ ok: false, status: 500, statusText: 'Server Error', json: () => Promise.reject(new Error('nope')) }),
    );
    await expect(apiClient.getBackend()).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run src/api/client.test.ts`
Expected: FAIL — `apiClient.uploadCv is not a function`, `ApiError` not exported.

- [ ] **Step 3: Rewrite the client**

Replace the whole of `web/src/api/client.ts`:

```ts
import type { components } from './types';

const API_BASE = '/api';

export type BackendOut = components['schemas']['BackendOut'];
export type DemoOut = components['schemas']['DemoOut'];
export type JobProfileOut = components['schemas']['JobProfileOut'];
export type CvOut = components['schemas']['CvOut'];
export type CandidateOut = components['schemas']['CandidateOut'];
export type RequirementOut = components['schemas']['RequirementOut'];
export type AnalysisOut = components['schemas']['AnalysisOut'];
export type CandidateAnalysisOut = components['schemas']['CandidateAnalysisOut'];
export type AuditEntryOut = components['schemas']['AuditEntryOut'];
export type EmailOut = components['schemas']['EmailOut'];
export type MatchResultOut = components['schemas']['MatchResultOut'];
export type GapOut = components['schemas']['GapOut'];

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  let message = res.statusText;
  try {
    const body = await res.json();
    if (body?.detail) {
      message = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
    }
  } catch {
    // A non-JSON error body (a proxy 502, say) still has to become an ApiError.
  }
  if (res.status === 429) {
    message = 'Zu viele Anfragen. Bitte einen Moment warten und erneut versuchen.';
  }
  return new ApiError(res.status, message);
}

async function getJson<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`);
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

async function postJson<T>(endpoint: string, payload: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

/** No Content-Type header: the browser must set it, because only the browser
 *  knows the multipart boundary. Setting it by hand breaks the upload. */
async function postForm<T>(endpoint: string, form: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', body: form });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

export const apiClient = {
  getBackend: () => getJson<BackendOut>('/backend'),

  getDemo: () => getJson<DemoOut>('/demo'),

  parseJobProfile: (text: string) => postJson<JobProfileOut>('/job-profile', { text }),

  uploadCv: (input: { name: string; index: number; file?: File; text?: string }) => {
    const form = new FormData();
    form.set('name', input.name);
    form.set('index', String(input.index));
    if (input.file) form.set('file', input.file);
    else if (input.text !== undefined) form.set('text', input.text);
    return postForm<CvOut>('/cv', form);
  },

  analyze: (input: {
    requirements: RequirementOut[];
    candidates: CandidateOut[];
    cached_backends: string[];
  }) => postJson<AnalysisOut>('/analysis', input),

  draftEmail: (input: { candidate: CandidateOut; questions: string[] }) =>
    postJson<EmailOut>('/email', input),
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run src/api/client.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add web/src/api/client.ts web/src/api/client.test.ts
git commit -m "fix(web): rewrite the API client against the real API

/api/cv is multipart, not JSON. /api/analysis takes requirements and
candidates, not job_text and cvs. /api/email-draft does not exist; the route
is /api/email. Adds typed 413 and 429 handling."
```

---

### Task 5: The store

**Files:**
- Rewrite: `web/src/store/session.ts`
- Create: `web/src/store/session.test.ts`

**Interfaces:**
- Consumes: types from `src/api/client.ts`, `AnalysisCache` from `src/lib/analysisCache.ts`
- Produces: `useSessionStore` with state
  `{ backendLabel: string | null, isLlmActive: boolean, jobText: string, requirements: RequirementOut[], candidates: CandidateOut[], analyses: CandidateAnalysisOut[], isAnalyzing: boolean, auditLog: AuditEntryOut[], selectedCandidateId: string | null, error: string | null }`
  and actions
  `{ setBackendLabel, setJobText, setRequirements, addCandidate, removeCandidate, setAnalyses, setIsAnalyzing, appendAudit, clearAuditLog, setSelectedCandidateId, setError, reset }`
- `appendAudit(entries: AuditEntryOut[])` takes **server** entries; there is no
  client-side entry construction.

- [ ] **Step 1: Write the failing tests**

Create `web/src/store/session.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from './session';
import type { components } from '../api/types';

type CandidateOut = components['schemas']['CandidateOut'];

function candidate(over: Partial<CandidateOut> = {}): CandidateOut {
  return {
    id: 'cand_0', name: 'Lena', source: 'cv.txt', raw_text: 'x', skills: [],
    years: null, education: 0, education_label: 'unbekannt', languages: [],
    email: null, matches: [], gaps: [], questions: [], ...over,
  };
}

beforeEach(() => useSessionStore.getState().reset());

describe('backend label', () => {
  it('treats the exact string regelbasiert as no LLM', () => {
    useSessionStore.getState().setBackendLabel('regelbasiert');
    expect(useSessionStore.getState().isLlmActive).toBe(false);
  });

  it('treats an LLM label as active', () => {
    useSessionStore.getState().setBackendLabel('LLM (gpt-4o-mini)');
    expect(useSessionStore.getState().isLlmActive).toBe(true);
  });

  it('is not active before the backend has been asked', () => {
    expect(useSessionStore.getState().backendLabel).toBeNull();
    expect(useSessionStore.getState().isLlmActive).toBe(false);
  });
});

describe('candidates', () => {
  it('adds and removes by id', () => {
    const { addCandidate, removeCandidate } = useSessionStore.getState();
    addCandidate(candidate({ id: 'cand_0' }));
    addCandidate(candidate({ id: 'cand_1', name: 'Marc' }));
    expect(useSessionStore.getState().candidates).toHaveLength(2);
    removeCandidate('cand_0');
    expect(useSessionStore.getState().candidates.map(c => c.id)).toEqual(['cand_1']);
  });
});

describe('audit', () => {
  it('appends server entries in order', () => {
    useSessionStore.getState().appendAudit([
      { timestamp: '1', agent: 'CV-Agent', action: 'a', detail: 'd' },
    ]);
    useSessionStore.getState().appendAudit([
      { timestamp: '2', agent: 'Matching-Agent', action: 'b', detail: 'e' },
    ]);
    expect(useSessionStore.getState().auditLog.map(e => e.agent)).toEqual([
      'CV-Agent', 'Matching-Agent',
    ]);
  });
});

describe('reset', () => {
  it('clears everything, because nothing survives a reload', () => {
    const s = useSessionStore.getState();
    s.setJobText('x');
    s.addCandidate(candidate());
    s.setError('boom');
    s.reset();
    const after = useSessionStore.getState();
    expect(after.jobText).toBe('');
    expect(after.candidates).toEqual([]);
    expect(after.error).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run src/store/session.test.ts`
Expected: FAIL — `reset is not a function`.

- [ ] **Step 3: Rewrite the store**

Replace the whole of `web/src/store/session.ts`:

```ts
import { create } from 'zustand';
import type {
  AuditEntryOut,
  CandidateAnalysisOut,
  CandidateOut,
  RequirementOut,
} from '../api/client';

/** agents/dispatch.py:28 returns exactly "regelbasiert" when no LLM is
 *  configured, and "LLM (<model>)" otherwise. */
const RULE_BASED_LABEL = 'regelbasiert';

interface SessionState {
  backendLabel: string | null;
  isLlmActive: boolean;
  jobText: string;
  requirements: RequirementOut[];
  candidates: CandidateOut[];
  analyses: CandidateAnalysisOut[];
  isAnalyzing: boolean;
  auditLog: AuditEntryOut[];
  selectedCandidateId: string | null;
  error: string | null;

  setBackendLabel: (label: string) => void;
  setJobText: (text: string) => void;
  setRequirements: (requirements: RequirementOut[]) => void;
  addCandidate: (candidate: CandidateOut) => void;
  removeCandidate: (id: string) => void;
  setAnalyses: (analyses: CandidateAnalysisOut[]) => void;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
  appendAudit: (entries: AuditEntryOut[]) => void;
  clearAuditLog: () => void;
  setSelectedCandidateId: (id: string | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initial = {
  backendLabel: null,
  isLlmActive: false,
  jobText: '',
  requirements: [],
  candidates: [],
  analyses: [],
  isAnalyzing: false,
  auditLog: [],
  selectedCandidateId: null,
  error: null,
} satisfies Partial<SessionState>;

// In memory only. README.md:436 and api/main.py both promise that candidate
// data is cleared on reload. Do not add persist middleware.
export const useSessionStore = create<SessionState>((set) => ({
  ...initial,

  setBackendLabel: (label) => set({ backendLabel: label, isLlmActive: label !== RULE_BASED_LABEL }),
  setJobText: (jobText) => set({ jobText }),
  setRequirements: (requirements) => set({ requirements }),
  addCandidate: (candidate) => set((s) => ({ candidates: [...s.candidates, candidate] })),
  removeCandidate: (id) => set((s) => ({ candidates: s.candidates.filter((c) => c.id !== id) })),
  setAnalyses: (analyses) => set({ analyses }),
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  appendAudit: (entries) => set((s) => ({ auditLog: [...s.auditLog, ...entries] })),
  clearAuditLog: () => set({ auditLog: [] }),
  setSelectedCandidateId: (selectedCandidateId) => set({ selectedCandidateId }),
  setError: (error) => set({ error }),
  reset: () => set(initial),
}));
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run src/store/session.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add web/src/store/session.ts web/src/store/session.test.ts
git commit -m "refactor(web): mirror backend shapes in the session store

Audit entries now come from server responses instead of being invented on the
client. The activeBackend union matched nothing backend_label() can return; it
is now the label string plus a derived isLlmActive."
```

---

### Task 6: The screening flow hook

Everything the tabs call. Isolated from rendering so it can be tested without
mounting a page.

**Files:**
- Create: `web/src/hooks/useScreening.ts`
- Create: `web/src/hooks/useScreening.test.ts`

**Interfaces:**
- Consumes: `apiClient`, `ApiError` (Task 4); `useSessionStore` (Task 5); `AnalysisCache` (Task 3)
- Produces: `useScreening()` returning
  `{ loadDemo(): Promise<void>, parseJob(): Promise<void>, uploadFiles(files: File[]): Promise<void>, runAnalysis(): Promise<void>, fetchBackendLabel(): Promise<void> }`

- [ ] **Step 1: Write the failing tests**

Create `web/src/hooks/useScreening.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScreening } from './useScreening';
import { useSessionStore } from '../store/session';
import { apiClient, ApiError } from '../api/client';
import type { components } from '../api/types';

type CandidateOut = components['schemas']['CandidateOut'];
type RequirementOut = components['schemas']['RequirementOut'];

const req: RequirementOut = {
  id: 'r0', label: 'Python', kind: 'skill', value: 'Python', importance: 'muss',
};

function candidate(over: Partial<CandidateOut> = {}): CandidateOut {
  return {
    id: 'cand_0', name: 'Lena', source: 'cv.txt', raw_text: 'Skills: Python',
    skills: ['Python'], years: null, education: 0, education_label: 'unbekannt',
    languages: [], email: null, matches: [], gaps: [], questions: [], ...over,
  };
}

beforeEach(() => {
  useSessionStore.getState().reset();
  vi.restoreAllMocks();
});

describe('parseJob', () => {
  it('stores requirements and the server audit trail', async () => {
    vi.spyOn(apiClient, 'parseJobProfile').mockResolvedValue({
      requirements: [req],
      audit: [{ timestamp: '1', agent: 'Stellenprofil-Agent', action: 'a', detail: 'd' }],
      backend: 'regelbasiert',
    });
    useSessionStore.getState().setJobText('Wir suchen Python.');

    const { result } = renderHook(() => useScreening());
    await act(() => result.current.parseJob());

    expect(useSessionStore.getState().requirements).toEqual([req]);
    expect(useSessionStore.getState().auditLog[0].agent).toBe('Stellenprofil-Agent');
  });

  it('surfaces a failure to the user rather than only the audit log', async () => {
    vi.spyOn(apiClient, 'parseJobProfile').mockRejectedValue(new ApiError(429, 'Zu viele Anfragen.'));
    useSessionStore.getState().setJobText('x');

    const { result } = renderHook(() => useScreening());
    await act(() => result.current.parseJob());

    expect(useSessionStore.getState().error).toBe('Zu viele Anfragen.');
  });
});

describe('uploadFiles', () => {
  it('sends each file and stores the returned candidate', async () => {
    const spy = vi.spyOn(apiClient, 'uploadCv').mockResolvedValue({
      candidate: candidate(), audit: [], backend: 'regelbasiert',
    });
    const { result } = renderHook(() => useScreening());
    await act(() => result.current.uploadFiles([new File(['x'], 'cv.txt')]));

    expect(spy).toHaveBeenCalledOnce();
    expect(useSessionStore.getState().candidates).toHaveLength(1);
  });

  it('indexes uploads by their position in the existing list', async () => {
    const spy = vi.spyOn(apiClient, 'uploadCv').mockImplementation(async ({ index }) => ({
      candidate: candidate({ id: `cand_${index}` }), audit: [], backend: 'regelbasiert',
    }));
    useSessionStore.getState().addCandidate(candidate({ id: 'cand_0' }));

    const { result } = renderHook(() => useScreening());
    await act(() => result.current.uploadFiles([new File(['y'], 'second.txt')]));

    expect(spy.mock.calls[0][0].index).toBe(1);
  });

  it('reports a rejected file without discarding the ones that worked', async () => {
    vi.spyOn(apiClient, 'uploadCv')
      .mockResolvedValueOnce({ candidate: candidate({ id: 'cand_0' }), audit: [], backend: 'regelbasiert' })
      .mockRejectedValueOnce(new ApiError(413, 'Datei zu groß (max. 10 MB).'));

    const { result } = renderHook(() => useScreening());
    await act(() => result.current.uploadFiles([
      new File(['a'], 'ok.txt'), new File(['b'], 'big.pdf'),
    ]));

    expect(useSessionStore.getState().candidates).toHaveLength(1);
    expect(useSessionStore.getState().error).toContain('Datei zu groß');
  });
});

describe('runAnalysis', () => {
  it('sends only uncached candidates and counts the cached ones', async () => {
    const cached = candidate({ id: 'cand_0', raw_text: 'Skills: Python' });
    const fresh = candidate({ id: 'cand_1', name: 'Marc', raw_text: 'Skills: Go' });

    const spy = vi.spyOn(apiClient, 'analyze').mockResolvedValue({
      analyses: [{ candidate: fresh, backend: 'regelbasiert', fallback_reason: null }],
      audit: [],
    });

    const store = useSessionStore.getState();
    store.setRequirements([req]);
    store.addCandidate(cached);
    store.addCandidate(fresh);

    const { result } = renderHook(() => useScreening());

    // First run populates the cache.
    spy.mockResolvedValueOnce({
      analyses: [
        { candidate: cached, backend: 'regelbasiert', fallback_reason: null },
        { candidate: fresh, backend: 'regelbasiert', fallback_reason: null },
      ],
      audit: [],
    });
    await act(() => result.current.runAnalysis());
    expect(spy.mock.calls[0][0].candidates).toHaveLength(2);

    // Second run sends nothing and reports both as cached.
    await act(() => result.current.runAnalysis());
    expect(spy.mock.calls[1][0].candidates).toHaveLength(0);
    expect(spy.mock.calls[1][0].cached_backends).toEqual(['regelbasiert', 'regelbasiert']);
    expect(useSessionStore.getState().analyses).toHaveLength(2);
  });

  it('re-sends a candidate whose analysis fell back', async () => {
    const c = candidate();
    const spy = vi.spyOn(apiClient, 'analyze').mockResolvedValue({
      analyses: [{ candidate: c, backend: 'regelbasiert', fallback_reason: 'timeout' }],
      audit: [],
    });
    const store = useSessionStore.getState();
    store.setRequirements([req]);
    store.addCandidate(c);

    const { result } = renderHook(() => useScreening());
    await act(() => result.current.runAnalysis());
    await act(() => result.current.runAnalysis());

    expect(spy.mock.calls[1][0].candidates).toHaveLength(1);
  });

  it('does nothing without requirements', async () => {
    const spy = vi.spyOn(apiClient, 'analyze');
    useSessionStore.getState().addCandidate(candidate());

    const { result } = renderHook(() => useScreening());
    await act(() => result.current.runAnalysis());

    expect(spy).not.toHaveBeenCalled();
  });

  it('always clears isAnalyzing, even on failure', async () => {
    vi.spyOn(apiClient, 'analyze').mockRejectedValue(new ApiError(500, 'boom'));
    const store = useSessionStore.getState();
    store.setRequirements([req]);
    store.addCandidate(candidate());

    const { result } = renderHook(() => useScreening());
    await act(() => result.current.runAnalysis());

    expect(useSessionStore.getState().isAnalyzing).toBe(false);
    expect(useSessionStore.getState().error).toBe('boom');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run src/hooks/useScreening.test.ts`
Expected: FAIL — cannot resolve `./useScreening`.

- [ ] **Step 3: Implement**

Create `web/src/hooks/useScreening.ts`:

```ts
import { useCallback, useRef } from 'react';
import { apiClient, ApiError } from '../api/client';
import type { CandidateAnalysisOut } from '../api/client';
import { useSessionStore } from '../store/session';
import { AnalysisCache } from '../lib/analysisCache';

function messageOf(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unbekannter Fehler.';
}

export function useScreening() {
  // One cache per mount. It is never persisted; a reload clears it, which is
  // the same promise the store keeps (README.md:436).
  const cacheRef = useRef<AnalysisCache>(null);
  cacheRef.current ??= new AnalysisCache();

  const fetchBackendLabel = useCallback(async () => {
    try {
      const { label } = await apiClient.getBackend();
      useSessionStore.getState().setBackendLabel(label);
    } catch {
      // A missing backend label must not block the workspace; the banner just
      // stays in its "unknown" state.
    }
  }, []);

  const loadDemo = useCallback(async () => {
    const store = useSessionStore.getState();
    store.setError(null);
    try {
      const demo = await apiClient.getDemo();
      store.setJobText(demo.job_text);
      for (const [index, cv] of demo.cvs.entries()) {
        const { candidate, audit } = await apiClient.uploadCv({
          name: cv.name,
          index,
          text: cv.text,
        });
        store.addCandidate(candidate);
        store.appendAudit(audit);
      }
    } catch (e) {
      store.setError(messageOf(e));
    }
  }, []);

  const parseJob = useCallback(async () => {
    const store = useSessionStore.getState();
    if (!store.jobText.trim()) return;
    store.setError(null);
    try {
      const { requirements, audit } = await apiClient.parseJobProfile(store.jobText);
      store.setRequirements(requirements);
      store.appendAudit(audit);
    } catch (e) {
      store.setError(messageOf(e));
    }
  }, []);

  const uploadFiles = useCallback(async (files: File[]) => {
    const store = useSessionStore.getState();
    store.setError(null);
    const failures: string[] = [];

    for (const file of files) {
      // The backend indexes candidates positionally, so the index must reflect
      // the list as it grows, not this batch.
      const index = useSessionStore.getState().candidates.length;
      try {
        const { candidate, audit } = await apiClient.uploadCv({
          name: file.name,
          index,
          file,
        });
        useSessionStore.getState().addCandidate(candidate);
        useSessionStore.getState().appendAudit(audit);
      } catch (e) {
        failures.push(`${file.name}: ${messageOf(e)}`);
      }
    }

    if (failures.length) useSessionStore.getState().setError(failures.join(' · '));
  }, []);

  const runAnalysis = useCallback(async () => {
    const store = useSessionStore.getState();
    const { requirements, candidates } = store;
    if (!requirements.length || !candidates.length) return;

    const cache = cacheRef.current!;
    const hits: CandidateAnalysisOut[] = [];
    const misses = [];
    for (const candidate of candidates) {
      const hit = cache.get(candidate, requirements);
      if (hit) hits.push(hit);
      else misses.push(candidate);
    }

    store.setError(null);
    store.setIsAnalyzing(true);
    try {
      const result = await apiClient.analyze({
        requirements,
        candidates: misses,
        // The server never sees the cached candidates, but the audit summary
        // has to count them (api/main.py, AnalysisIn.cached_backends).
        cached_backends: hits.map((h) => h.backend),
      });
      for (const analysis of result.analyses) {
        cache.set(analysis.candidate, requirements, analysis);
      }
      // Preserve the order the recruiter uploaded them in.
      const byKey = new Map(
        [...hits, ...result.analyses].map((a) => [a.candidate.raw_text, a]),
      );
      const ordered = candidates
        .map((c) => byKey.get(c.raw_text))
        .filter((a): a is CandidateAnalysisOut => Boolean(a));
      useSessionStore.getState().setAnalyses(ordered);
      useSessionStore.getState().appendAudit(result.audit);
    } catch (e) {
      useSessionStore.getState().setError(messageOf(e));
    } finally {
      useSessionStore.getState().setIsAnalyzing(false);
    }
  }, []);

  return { loadDemo, parseJob, uploadFiles, runAnalysis, fetchBackendLabel };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run src/hooks/useScreening.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add web/src/hooks/
git commit -m "feat(web): add the screening flow hook

Wires demo data, job parsing, multipart upload and cached analysis together.
Errors reach the store so the UI can show them, instead of vanishing into the
audit log on tab 6."
```

---

### Task 7: Split the Workspace shell

`Workspace.tsx` is 418 lines with six tabs inline, every one reading a shape
that does not exist. This task extracts the shell and moves tabs ① and ⑥ to it;
Tasks 8 and 9 handle the rest.

**Files:**
- Create: `web/src/pages/workspace/Workspace.tsx`
- Create: `web/src/pages/workspace/JobProfileTab.tsx`
- Create: `web/src/pages/workspace/ErrorBanner.tsx`
- Create: `web/src/pages/workspace/JobProfileTab.test.tsx`
- Modify: `web/src/App.tsx:3` (import path)
- Delete: `web/src/pages/Workspace.tsx`

**Interfaces:**
- Consumes: `useScreening` (Task 6), `useSessionStore` (Task 5)
- Produces:
  - `Workspace` (default export of `pages/workspace/Workspace.tsx`)
  - `ErrorBanner` — reads `error` from the store, renders nothing when null,
    has a dismiss button calling `setError(null)`
  - `JobProfileTab`

- [ ] **Step 1: Write the failing test**

Create `web/src/pages/workspace/JobProfileTab.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JobProfileTab } from './JobProfileTab';
import { useSessionStore } from '../../store/session';
import { apiClient } from '../../api/client';

beforeEach(() => {
  useSessionStore.getState().reset();
  vi.restoreAllMocks();
});

describe('JobProfileTab', () => {
  it('renders the requirements the server extracted', () => {
    useSessionStore.getState().setRequirements([
      { id: 'r0', label: 'Python', kind: 'skill', value: 'Python', importance: 'muss' },
      { id: 'r1', label: 'Go', kind: 'skill', value: 'Go', importance: 'kann' },
    ]);
    render(<JobProfileTab />);

    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('Muss')).toBeInTheDocument();
    expect(screen.getByText('Kann')).toBeInTheDocument();
  });

  it('disables analysis until there is text to analyse', async () => {
    render(<JobProfileTab />);
    expect(screen.getByRole('button', { name: /Profil analysieren/ })).toBeDisabled();

    await userEvent.type(screen.getByRole('textbox'), 'Wir suchen Python.');
    expect(screen.getByRole('button', { name: /Profil analysieren/ })).toBeEnabled();
  });

  it('shows a pending state while the agent works', async () => {
    let release: () => void;
    vi.spyOn(apiClient, 'parseJobProfile').mockReturnValue(
      new Promise((res) => {
        release = () => res({ requirements: [], audit: [], backend: 'regelbasiert' });
      }),
    );
    useSessionStore.getState().setJobText('Wir suchen Python.');
    render(<JobProfileTab />);

    await userEvent.click(screen.getByRole('button', { name: /Profil analysieren/ }));
    expect(screen.getByRole('button', { name: /Analysiere/ })).toBeDisabled();
    release!();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run src/pages/workspace/JobProfileTab.test.tsx`
Expected: FAIL — cannot resolve `./JobProfileTab`.

- [ ] **Step 3: Implement `ErrorBanner`**

Create `web/src/pages/workspace/ErrorBanner.tsx`:

```tsx
import { useSessionStore } from '../../store/session';

export function ErrorBanner() {
  const error = useSessionStore((s) => s.error);
  const setError = useSessionStore((s) => s.setError);
  if (!error) return null;

  return (
    <div
      role="alert"
      className="mb-6 flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50/80 px-6 py-4 text-red-900 shadow-sm backdrop-blur"
    >
      <p className="text-sm font-medium">{error}</p>
      <button
        onClick={() => setError(null)}
        className="shrink-0 rounded-lg px-2 py-1 text-sm font-bold text-red-700 hover:bg-red-100"
        aria-label="Fehlermeldung schließen"
      >
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Implement `JobProfileTab`**

Create `web/src/pages/workspace/JobProfileTab.tsx`:

```tsx
import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSessionStore } from '../../store/session';
import { useScreening } from '../../hooks/useScreening';

export function JobProfileTab() {
  const jobText = useSessionStore((s) => s.jobText);
  const setJobText = useSessionStore((s) => s.setJobText);
  const requirements = useSessionStore((s) => s.requirements);
  const { parseJob } = useScreening();
  const [isPending, setIsPending] = useState(false);

  const handleParse = async () => {
    setIsPending(true);
    try {
      await parseJob();
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h2 className="mb-2 text-2xl font-bold text-slate-900">Stellenprofil definieren</h2>
        <p className="text-slate-600">
          Füge die Anforderungen der Stelle ein, um sie von der KI strukturieren zu lassen.
        </p>
      </div>

      <textarea
        value={jobText}
        onChange={(e) => setJobText(e.target.value)}
        placeholder="Fügen Sie hier die Stellenbeschreibung ein..."
        aria-label="Stellenbeschreibung"
        className="mb-6 h-64 w-full resize-y rounded-2xl border border-slate-200 bg-white/80 p-5 font-medium text-slate-700 shadow-sm backdrop-blur transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
      />

      <Button
        onClick={handleParse}
        disabled={isPending || !jobText.trim()}
        size="lg"
        className="rounded-xl border-0 bg-gradient-to-r from-indigo-600 to-blue-600 px-8 text-base font-bold text-white shadow-lg shadow-indigo-200 hover:from-indigo-500 hover:to-blue-500"
      >
        {isPending ? 'Analysiere...' : '✨ Profil analysieren'}
      </Button>

      {requirements.length > 0 && (
        <div className="mt-12">
          <h3 className="mb-6 flex items-center gap-2 text-xl font-bold text-slate-900">
            <CheckCircle className="text-emerald-500" size={24} /> Extrahierte Anforderungen
          </h3>
          <div className="flex flex-col gap-3">
            {requirements.map((req) => (
              <Card key={req.id} className="rounded-xl border-slate-200/60 bg-white shadow-sm">
                <CardContent className="flex items-center justify-between gap-4 p-5">
                  <div className="text-slate-700">
                    <strong className="font-bold text-slate-900">{req.label}</strong>
                    <span className="ml-2 text-sm text-slate-500">{String(req.value)}</span>
                  </div>
                  <Badge
                    className={cn(
                      'whitespace-nowrap rounded-lg px-3 py-1 font-bold shadow-none',
                      req.importance === 'muss'
                        ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100'
                        : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
                    )}
                  >
                    {req.importance === 'muss' ? 'Muss' : 'Kann'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:run src/pages/workspace/JobProfileTab.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 6: Create the shell**

Create `web/src/pages/workspace/Workspace.tsx`. Tabs ②③④⑤ are placeholders that
Tasks 8 and 9 replace — this keeps the app compiling between tasks:

```tsx
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useSessionStore } from '../../store/session';
import { useScreening } from '../../hooks/useScreening';
import { AuditLog } from '../../components/AuditLog';
import { CandidateDetail } from '../../components/CandidateDetail';
import { ErrorBanner } from './ErrorBanner';
import { JobProfileTab } from './JobProfileTab';

const TABS = [
  { id: 1, label: '① Stellenprofil' },
  { id: 2, label: '② Bewerbungen' },
  { id: 3, label: '③ Kandidaten' },
  { id: 4, label: '④ Informationslücken' },
  { id: 5, label: '⑤ Rückfragen' },
  { id: 6, label: '⑥ Audit Log' },
];

export function Workspace() {
  const [activeTab, setActiveTab] = useState(1);
  const backendLabel = useSessionStore((s) => s.backendLabel);
  const isLlmActive = useSessionStore((s) => s.isLlmActive);
  const { fetchBackendLabel } = useScreening();

  useEffect(() => {
    void fetchBackendLabel();
  }, [fetchBackendLabel]);

  return (
    <>
      <div className="relative min-h-screen w-full bg-slate-50 pb-20 pt-4">
        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <div className="pb-12 pt-24">
            <div className="mb-4 text-sm font-extrabold uppercase tracking-widest text-indigo-700">
              Recruiting Workspace
            </div>
            <h2 className="mb-4 text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
              Dein Screening-Arbeitsbereich
            </h2>
            <p className="max-w-2xl text-xl leading-relaxed text-slate-700">
              Stellenprofil definieren, Bewerbungen analysieren und Ergebnisse transparent prüfen —
              die Entscheidung bleibt bei dir.
            </p>
          </div>

          {backendLabel !== null && !isLlmActive && (
            <div className="mb-8 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-6 py-4 text-amber-900 shadow-sm backdrop-blur">
              <span className="text-xl" aria-hidden="true">⚠️</span>
              <p className="text-sm font-medium">
                <b className="font-bold">Kein LLM aktiv:</b> Die Agenten laufen im regelbasierten
                Sandbox-Modus.
              </p>
            </div>
          )}

          <ErrorBanner />

          <div className="hide-scrollbar mb-8 flex overflow-x-auto border-b border-slate-200">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  '-mb-[1px] whitespace-nowrap border-b-2 px-6 py-4 text-[15px] font-semibold transition-all',
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="min-h-[600px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 1 && <JobProfileTab />}
                {activeTab === 6 && <AuditLog />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
      <CandidateDetail />
    </>
  );
}
```

- [ ] **Step 7: Point the router at it and delete the old page**

In `web/src/App.tsx` line 3, change:

```ts
import { Workspace } from './pages/workspace/Workspace';
```

Then:

```bash
rm web/src/pages/Workspace.tsx
```

`AuditLog.tsx` and `CandidateDetail.tsx` still read old shapes and will not
compile. Task 8 fixes `CandidateDetail`; fix `AuditLog` now — it reads
`entry.timestamp/agent/action/detail`, which `AuditEntryOut` supplies verbatim,
so the only change is its store selector: `useSessionStore(s => s.auditLog)`
already returns `AuditEntryOut[]`. Verify it compiles; if it constructs entries
itself, delete that code.

- [ ] **Step 8: Verify the build**

Run: `npm run build`
Expected: PASS. If `CandidateDetail.tsx` errors, stub its body to
`return null;` and leave a `// Task 8` comment — Task 8 rewrites it.

- [ ] **Step 9: Commit**

```bash
git add -A web/src
git commit -m "refactor(web): split the Workspace shell out of the 418-line page

Adds a visible ErrorBanner: failures previously reached only the audit log on
tab 6. The backend banner now waits for a real label instead of assuming the
sandbox."
```

---

### Task 8: Candidate rendering — tabs ③④ and the detail drawer

**Files:**
- Create: `web/src/pages/workspace/CandidatesTab.tsx`
- Create: `web/src/pages/workspace/GapsTab.tsx`
- Create: `web/src/pages/workspace/CandidatesTab.test.tsx`
- Rewrite: `web/src/components/CandidateDetail.tsx`
- Modify: `web/src/pages/workspace/Workspace.tsx` (wire tabs 3 and 4)

**Interfaces:**
- Consumes: `useSessionStore.analyses: CandidateAnalysisOut[]`
- Produces: `CandidatesTab`, `GapsTab`

The status vocabulary is `erfuellt | teilweise | offen | nicht_erfuellt`
(`api/schemas.py`). All four must render distinctly — the old UI collapsed
`offen` and `nicht_erfuellt` into one pill, losing the difference between
*unknown* and *known-absent*. There is no `decision.is_match` field; a
candidate's headline is derived from their `matches`.

- [ ] **Step 1: Write the failing tests**

Create `web/src/pages/workspace/CandidatesTab.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CandidatesTab } from './CandidatesTab';
import { useSessionStore } from '../../store/session';
import type { components } from '../../api/types';

type CandidateOut = components['schemas']['CandidateOut'];
type MatchResultOut = components['schemas']['MatchResultOut'];

function match(over: Partial<MatchResultOut> = {}): MatchResultOut {
  return {
    requirement_id: 'r0', label: 'Python', kind: 'skill',
    importance: 'muss', status: 'erfuellt', note: '', ...over,
  };
}

function candidate(over: Partial<CandidateOut> = {}): CandidateOut {
  return {
    id: 'cand_0', name: 'Lena', source: 'cv.txt', raw_text: 'x', skills: [],
    years: null, education: 0, education_label: 'unbekannt', languages: [],
    email: null, matches: [], gaps: [], questions: [], ...over,
  };
}

beforeEach(() => useSessionStore.getState().reset());

describe('CandidatesTab', () => {
  it('tells the recruiter to run an analysis when there is none', () => {
    render(<CandidatesTab />);
    expect(screen.getByText(/Noch keine Analyse/)).toBeInTheDocument();
  });

  it('shows the candidate name, not a filename', () => {
    useSessionStore.getState().setAnalyses([
      { candidate: candidate({ name: 'Lena Hoffmann' }), backend: 'regelbasiert', fallback_reason: null },
    ]);
    render(<CandidatesTab />);
    expect(screen.getByText('Lena Hoffmann')).toBeInTheDocument();
  });

  it('counts met requirements out of the total', () => {
    useSessionStore.getState().setAnalyses([
      {
        candidate: candidate({
          matches: [
            match({ status: 'erfuellt' }),
            match({ requirement_id: 'r1', status: 'offen' }),
            match({ requirement_id: 'r2', status: 'nicht_erfuellt' }),
          ],
        }),
        backend: 'regelbasiert',
        fallback_reason: null,
      },
    ]);
    render(<CandidatesTab />);
    expect(screen.getByText(/1\/3/)).toBeInTheDocument();
  });

  it('marks a fallback so a rule-based result is never mistaken for an LLM one', () => {
    useSessionStore.getState().setAnalyses([
      { candidate: candidate(), backend: 'regelbasiert', fallback_reason: 'timeout' },
    ]);
    render(<CandidatesTab />);
    expect(screen.getByText(/Fallback/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run src/pages/workspace/CandidatesTab.test.tsx`
Expected: FAIL — cannot resolve `./CandidatesTab`.

- [ ] **Step 3: Add the shared status vocabulary**

Create `web/src/lib/status.ts`:

```ts
import type { components } from '../api/types';

type Status = components['schemas']['MatchResultOut']['status'];

/** All four statuses render distinctly. Collapsing `offen` into
 *  `nicht_erfuellt` would hide the difference between "the CV does not say"
 *  and "the CV says no". */
export const STATUS_LABEL: Record<Status, string> = {
  erfuellt: 'Erfüllt',
  teilweise: 'Teilweise',
  offen: 'Offen',
  nicht_erfuellt: 'Nicht erfüllt',
};

export const STATUS_CLASS: Record<Status, string> = {
  erfuellt: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
  teilweise: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  offen: 'bg-slate-100 text-slate-700 hover:bg-slate-100',
  nicht_erfuellt: 'bg-red-100 text-red-800 hover:bg-red-100',
};

export function metCount(matches: components['schemas']['MatchResultOut'][]): number {
  return matches.filter((m) => m.status === 'erfuellt').length;
}
```

- [ ] **Step 4: Implement `CandidatesTab`**

Create `web/src/pages/workspace/CandidatesTab.tsx`:

```tsx
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSessionStore } from '../../store/session';
import { metCount } from '../../lib/status';

export function CandidatesTab() {
  const analyses = useSessionStore((s) => s.analyses);
  const isAnalyzing = useSessionStore((s) => s.isAnalyzing);
  const setSelectedCandidateId = useSessionStore((s) => s.setSelectedCandidateId);

  if (isAnalyzing) {
    return (
      <div className="flex animate-pulse items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/80 p-6 font-bold text-blue-800">
        <span className="text-xl" aria-hidden="true">⏳</span> Die Agenten arbeiten im Hintergrund...
      </div>
    );
  }

  if (!analyses.length) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-6 font-medium text-amber-800">
        Noch keine Analyse durchgeführt. (Gehe zu ② Bewerbungen)
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h2 className="mb-2 text-2xl font-bold text-slate-900">Kandidatenübersicht</h2>
        <p className="text-slate-600">
          Erfüllte Anforderungen je Bewerber. Keine Rangfolge, keine Empfehlung.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {analyses.map(({ candidate, backend, fallback_reason }) => (
          <Card
            key={candidate.id}
            className="flex flex-col rounded-2xl border-slate-200/60 bg-white/80 shadow-md backdrop-blur transition-all hover:-translate-y-1 hover:shadow-xl"
          >
            <CardContent className="flex flex-1 flex-col p-6">
              <div className="mb-4 flex items-start justify-between gap-2">
                <h3 className="truncate text-lg font-bold text-slate-900">{candidate.name}</h3>
                <Badge className="whitespace-nowrap rounded-md bg-indigo-100 px-2 py-0.5 font-bold text-indigo-800 shadow-none hover:bg-indigo-100">
                  {metCount(candidate.matches)}/{candidate.matches.length}
                </Badge>
              </div>

              <p className="mb-2 truncate text-sm text-slate-500">{candidate.source}</p>

              <p className="mb-6 flex-1 text-sm leading-relaxed text-slate-600">
                {candidate.gaps.length
                  ? `${candidate.gaps.length} Informationslücke(n) gefunden.`
                  : 'Keine Informationslücken.'}
              </p>

              <div className="mb-4 flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-md bg-slate-100 text-xs font-semibold text-slate-600">
                  {backend}
                </Badge>
                {fallback_reason && (
                  <Badge
                    variant="secondary"
                    className="rounded-md bg-amber-100 text-xs font-semibold text-amber-800"
                    title={fallback_reason}
                  >
                    Fallback
                  </Badge>
                )}
              </div>

              <Button
                variant="outline"
                onClick={() => setSelectedCandidateId(candidate.id)}
                className="mt-auto flex w-full items-center justify-center gap-1 rounded-xl border-slate-200 font-bold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
              >
                Profil ansehen <ChevronRight size={16} />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:run src/pages/workspace/CandidatesTab.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 6: Implement `GapsTab`**

Create `web/src/pages/workspace/GapsTab.tsx`. `GapOut` is
`{ requirement_label, description, importance }` — note `requirement_label`,
not `requirement`:

```tsx
import { Card, CardContent } from '@/components/ui/card';
import { useSessionStore } from '../../store/session';

export function GapsTab() {
  const analyses = useSessionStore((s) => s.analyses);

  if (!analyses.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-100/50 p-6 text-center font-medium text-slate-500">
        Noch keine Analyse durchgeführt.
      </div>
    );
  }

  const withGaps = analyses.filter((a) => a.candidate.gaps.length > 0);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h2 className="mb-2 text-2xl font-bold text-slate-900">Informationslücken</h2>
        <p className="text-slate-600">
          Fehlende Informationen aus den Lebensläufen, die für das Matching relevant sind.
        </p>
      </div>

      {!withGaps.length ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-6 text-center font-bold text-emerald-800">
          🎉 Keine Informationslücken gefunden!
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {withGaps.map(({ candidate }) => (
            <Card key={candidate.id} className="overflow-hidden rounded-2xl border-slate-200/60 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-6 py-4">
                <h3 className="font-bold text-slate-900">{candidate.name}</h3>
              </div>
              <CardContent className="p-6">
                <ul className="space-y-4">
                  {candidate.gaps.map((gap, i) => (
                    <li key={`${candidate.id}-${gap.requirement_label}-${i}`} className="flex gap-3">
                      <span className="mt-1 font-black text-amber-500" aria-hidden="true">•</span>
                      <div>
                        <div className="font-bold text-slate-900">{gap.requirement_label}</div>
                        <div className="mt-1 text-sm text-slate-600">{gap.description}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Rewrite `CandidateDetail`**

Replace the whole of `web/src/components/CandidateDetail.tsx`. Two fixes beyond
the shapes: `AnimatePresence` must wrap the condition (it currently returns
`null` above it, so the exit animation can never run), and it looks up by
`candidate.id`:

```tsx
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { cn } from '@/lib/utils';
import { useSessionStore } from '../store/session';
import { STATUS_CLASS, STATUS_LABEL, metCount } from '../lib/status';

export function CandidateDetail() {
  const analyses = useSessionStore((s) => s.analyses);
  const selectedCandidateId = useSessionStore((s) => s.selectedCandidateId);
  const setSelectedCandidateId = useSessionStore((s) => s.setSelectedCandidateId);

  const analysis = analyses.find((a) => a.candidate.id === selectedCandidateId);

  // AnimatePresence must own the condition, or the exit animation never runs.
  return (
    <AnimatePresence>
      {analysis && (
        <div
          className="fixed inset-0 z-[9999] flex justify-end bg-slate-900/40 backdrop-blur-sm"
          onClick={() => setSelectedCandidateId(null)}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-slate-50 p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="outline"
              onClick={() => setSelectedCandidateId(null)}
              className="mb-8 rounded-xl border-slate-200 bg-white font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
            >
              &larr; Zurück
            </Button>

            <div className="mb-8">
              <div className="mb-2 text-xs font-bold uppercase tracking-widest text-indigo-600">
                Kandidatenprofil
              </div>
              <h2 className="mb-2 text-4xl font-black text-slate-900">{analysis.candidate.name}</h2>
              <p className="text-lg font-medium text-slate-600">
                {metCount(analysis.candidate.matches)}/{analysis.candidate.matches.length}{' '}
                Anforderungen erfüllt &middot; {analysis.candidate.gaps.length} Informationslücke(n)
              </p>
            </div>

            <div className="mb-8 grid grid-cols-2 gap-4">
              <Card className="rounded-2xl border-slate-200/60 bg-white/60 shadow-md backdrop-blur">
                <CardContent className="p-6 text-center">
                  <div className="mb-1 bg-gradient-to-br from-indigo-600 to-blue-500 bg-clip-text text-4xl font-black text-transparent">
                    {analysis.candidate.skills.length}
                  </div>
                  <div className="text-sm font-medium uppercase tracking-wide text-slate-500">
                    Skills erkannt
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-slate-200/60 bg-white/60 shadow-md backdrop-blur">
                <CardContent className="p-6 text-center">
                  <div className="mb-1 bg-gradient-to-br from-blue-500 to-cyan-500 bg-clip-text text-4xl font-black text-transparent">
                    {analysis.candidate.languages.length}
                  </div>
                  <div className="text-sm font-medium uppercase tracking-wide text-slate-500">
                    Sprachen
                  </div>
                </CardContent>
              </Card>
            </div>

            {analysis.candidate.skills.length > 0 && (
              <div className="mb-10 flex flex-wrap gap-2">
                {analysis.candidate.skills.map((skill) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            )}

            <h4 className="mb-4 text-xl font-bold text-slate-900">Qualifikationscheckliste</h4>
            {analysis.candidate.matches.length ? (
              <div className="mb-10 flex flex-col gap-3">
                {analysis.candidate.matches.map((m) => (
                  <Card key={m.requirement_id} className="rounded-xl border-slate-200/60 bg-white shadow-sm">
                    <CardContent className="flex items-center justify-between gap-4 p-4">
                      <div>
                        <span className="font-bold text-slate-900">{m.label}</span>
                        {m.note && <span className="ml-2 text-sm text-slate-500">&middot; {m.note}</span>}
                      </div>
                      <Badge
                        className={cn(
                          'whitespace-nowrap rounded-lg px-3 py-1 font-bold shadow-none',
                          STATUS_CLASS[m.status],
                        )}
                      >
                        {STATUS_LABEL[m.status]}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="mb-10 italic text-slate-500">Keine Anforderungen zum Abgleich gefunden.</p>
            )}

            <div className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-6 text-sm text-indigo-900">
              ⚖️ <strong className="font-bold">Human-in-the-Loop:</strong> Diese Ansicht zeigt nur
              extrahierte Daten &mdash; keine Bewertung, keine Empfehlung. Die Entscheidung triffst du.
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 8: Wire tabs 3 and 4 into the shell**

In `web/src/pages/workspace/Workspace.tsx`, add the imports and the two lines:

```tsx
import { CandidatesTab } from './CandidatesTab';
import { GapsTab } from './GapsTab';
```

```tsx
                {activeTab === 3 && <CandidatesTab />}
                {activeTab === 4 && <GapsTab />}
```

- [ ] **Step 9: Verify build and full suite**

Run: `npm run build && npm run test:run`
Expected: both PASS.

- [ ] **Step 10: Commit**

```bash
git add -A web/src
git commit -m "feat(web): render candidates from real schema shapes

Replaces decision.is_match and extracted_profile, which no schema ever had,
with matches/gaps off CandidateOut. All four MatchResult statuses now render
distinctly: offen and nicht_erfuellt were collapsed, hiding the difference
between 'the CV does not say' and 'the CV says no'. Fixes CandidateDetail's
exit animation, which could never run."
```

---

### Task 9: Upload and questions — tabs ② and ⑤

**Files:**
- Create: `web/src/pages/workspace/UploadTab.tsx`
- Create: `web/src/pages/workspace/QuestionsTab.tsx`
- Create: `web/src/pages/workspace/UploadTab.test.tsx`
- Modify: `web/src/pages/workspace/Workspace.tsx` (wire tabs 2 and 5)

**Interfaces:**
- Consumes: `useScreening` (Task 6), `apiClient.draftEmail` (Task 4)
- Produces: `UploadTab`, `QuestionsTab`

Three long-standing bugs die here: the file input is `display:none` and so
unreachable by keyboard; the drop zone promises drag-and-drop and has no
handler; and PDF hits an `alert()` claiming the backend cannot take it, which
is false (`api/main.py:138`).

- [ ] **Step 1: Write the failing tests**

Create `web/src/pages/workspace/UploadTab.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UploadTab } from './UploadTab';
import { useSessionStore } from '../../store/session';
import { apiClient } from '../../api/client';
import type { components } from '../../api/types';

type CandidateOut = components['schemas']['CandidateOut'];

function candidate(over: Partial<CandidateOut> = {}): CandidateOut {
  return {
    id: 'cand_0', name: 'Lena', source: 'cv.txt', raw_text: 'x', skills: [],
    years: null, education: 0, education_label: 'unbekannt', languages: [],
    email: null, matches: [], gaps: [], questions: [], ...over,
  };
}

beforeEach(() => {
  useSessionStore.getState().reset();
  vi.restoreAllMocks();
});

describe('UploadTab', () => {
  it('exposes a keyboard-reachable file input', () => {
    render(<UploadTab />);
    const input = screen.getByLabelText(/Dateien auswählen/i);
    expect(input).toBeInTheDocument();
    // display:none would make it unreachable; sr-only must not.
    expect(input).toBeVisible();
  });

  it('accepts PDF, because the backend reads PDFs', () => {
    render(<UploadTab />);
    expect(screen.getByLabelText(/Dateien auswählen/i)).toHaveAttribute(
      'accept', expect.stringContaining('.pdf'),
    );
  });

  it('uploads a dropped file', async () => {
    const spy = vi.spyOn(apiClient, 'uploadCv').mockResolvedValue({
      candidate: candidate(), audit: [], backend: 'regelbasiert',
    });
    render(<UploadTab />);

    const file = new File(['Skills: Python'], 'cv.txt', { type: 'text/plain' });
    const zone = screen.getByTestId('dropzone');
    // fireEvent-style drop: userEvent has no drop helper.
    const dataTransfer = { files: [file], types: ['Files'] };
    zone.dispatchEvent(
      Object.assign(new Event('drop', { bubbles: true, cancelable: true }), { dataTransfer }),
    );

    await vi.waitFor(() => expect(spy).toHaveBeenCalledOnce());
  });

  it('lists uploaded candidates by name', () => {
    useSessionStore.getState().addCandidate(candidate({ name: 'Lena Hoffmann' }));
    render(<UploadTab />);
    expect(screen.getByText('Lena Hoffmann')).toBeInTheDocument();
  });

  it('says why analysis is blocked when no profile has been parsed', () => {
    useSessionStore.getState().addCandidate(candidate());
    render(<UploadTab />);
    expect(screen.getByRole('button', { name: /Gesamtanalyse starten/ })).toBeDisabled();
    expect(screen.getByText(/Stellenprofil/i)).toBeInTheDocument();
  });

  it('enables analysis once requirements exist', () => {
    useSessionStore.getState().addCandidate(candidate());
    useSessionStore.getState().setRequirements([
      { id: 'r0', label: 'Python', kind: 'skill', value: 'Python', importance: 'muss' },
    ]);
    render(<UploadTab />);
    expect(screen.getByRole('button', { name: /Gesamtanalyse starten/ })).toBeEnabled();
  });

  it('loads demo data', async () => {
    const spy = vi.spyOn(apiClient, 'getDemo').mockResolvedValue({
      job_text: 'Wir suchen Python.', cvs: [],
    });
    render(<UploadTab />);
    await userEvent.click(screen.getByRole('button', { name: /Demo-Daten laden/ }));
    expect(spy).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run src/pages/workspace/UploadTab.test.tsx`
Expected: FAIL — cannot resolve `./UploadTab`.

- [ ] **Step 3: Implement `UploadTab`**

Create `web/src/pages/workspace/UploadTab.tsx`:

```tsx
import { useState, type DragEvent, type ChangeEvent } from 'react';
import { FileText, Play, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useSessionStore } from '../../store/session';
import { useScreening } from '../../hooks/useScreening';

const ACCEPT = '.txt,.pdf';

export function UploadTab() {
  const candidates = useSessionStore((s) => s.candidates);
  const requirements = useSessionStore((s) => s.requirements);
  const isAnalyzing = useSessionStore((s) => s.isAnalyzing);
  const removeCandidate = useSessionStore((s) => s.removeCandidate);
  const { uploadFiles, runAnalysis, loadDemo } = useScreening();

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files || !files.length) return;
    setIsUploading(true);
    try {
      await uploadFiles(Array.from(files));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    void handleFiles(e.dataTransfer?.files ?? null);
  };

  const handleDemo = async () => {
    setIsLoadingDemo(true);
    try {
      await loadDemo();
    } finally {
      setIsLoadingDemo(false);
    }
  };

  const canAnalyse = candidates.length > 0 && requirements.length > 0 && !isAnalyzing;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h2 className="mb-2 text-2xl font-bold text-slate-900">Bewerbungen hochladen</h2>
        <p className="text-slate-600">Lade Lebensläufe hoch, um sie gegen das Profil zu prüfen.</p>
      </div>

      <div
        data-testid="dropzone"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'mb-6 rounded-3xl border-2 border-dashed p-12 text-center transition-colors',
          isDragging ? 'border-indigo-500 bg-indigo-50/60' : 'border-indigo-200/80 bg-white/40 backdrop-blur',
        )}
      >
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
          <Upload size={32} className="text-indigo-600" aria-hidden="true" />
        </div>
        <p className="mb-2 text-xl font-bold text-slate-900">Ziehe Lebensläufe hierher</p>
        <p className="mb-8 font-medium text-slate-500">PDF oder Text — oder wähle sie manuell aus</p>

        {/* sr-only, not hidden: display:none would make this unreachable by keyboard. */}
        <label
          htmlFor="cv-upload"
          className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-4 font-bold text-white shadow-xl shadow-indigo-200 transition-transform hover:scale-105 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2"
        >
          {isUploading ? 'Wird verarbeitet...' : 'Dateien durchsuchen...'}
          <input
            id="cv-upload"
            type="file"
            multiple
            accept={ACCEPT}
            aria-label="Dateien auswählen"
            disabled={isUploading}
            onChange={(e: ChangeEvent<HTMLInputElement>) => void handleFiles(e.target.files)}
            className="sr-only"
          />
        </label>
      </div>

      <div className="mb-10 text-center">
        <Button
          variant="outline"
          onClick={handleDemo}
          disabled={isLoadingDemo}
          className="rounded-xl border-slate-200 bg-white font-semibold text-slate-700"
        >
          {isLoadingDemo ? 'Lade...' : '✨ Demo-Daten laden'}
        </Button>
      </div>

      {candidates.length > 0 && (
        <>
          <h3 className="mb-4 text-xl font-bold text-slate-900">
            Aktuelle Kandidaten ({candidates.length})
          </h3>
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {candidates.map((c) => (
              <Card key={c.id} className="rounded-xl border-slate-200/60 bg-white shadow-sm">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                    <FileText size={20} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate font-semibold text-slate-900">{c.name}</strong>
                    <span className="block truncate text-xs text-slate-500">{c.source}</span>
                  </div>
                  <button
                    onClick={() => removeCandidate(c.id)}
                    aria-label={`${c.name} entfernen`}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X size={16} />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>

          {!requirements.length && (
            <p className="mb-4 text-sm font-medium text-amber-700">
              Zuerst ein Stellenprofil unter ① analysieren — ohne Anforderungen gibt es nichts
              abzugleichen.
            </p>
          )}

          <Button
            onClick={() => void runAnalysis()}
            disabled={!canAnalyse}
            size="lg"
            className="flex items-center gap-2 rounded-xl border-0 bg-gradient-to-r from-indigo-600 to-blue-600 px-8 text-base font-bold text-white shadow-lg shadow-indigo-200 hover:from-indigo-500 hover:to-blue-500"
          >
            <Play size={18} fill="currentColor" aria-hidden="true" />
            {isAnalyzing ? 'Analysiere...' : 'Gesamtanalyse starten'}
          </Button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run src/pages/workspace/UploadTab.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 5: Implement `QuestionsTab`**

Create `web/src/pages/workspace/QuestionsTab.tsx`. There is no `email_draft`
field: drafts are fetched per candidate from `POST /api/email`:

```tsx
import { useState } from 'react';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiClient, type EmailOut } from '../../api/client';
import { useSessionStore } from '../../store/session';

export function QuestionsTab() {
  const analyses = useSessionStore((s) => s.analyses);
  const setError = useSessionStore((s) => s.setError);
  const [drafts, setDrafts] = useState<Record<string, EmailOut>>({});
  const [pending, setPending] = useState<string | null>(null);

  if (!analyses.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-100/50 p-6 text-center font-medium text-slate-500">
        Noch keine Analyse durchgeführt.
      </div>
    );
  }

  const handleDraft = async (id: string) => {
    const analysis = analyses.find((a) => a.candidate.id === id);
    if (!analysis) return;
    setPending(id);
    try {
      const draft = await apiClient.draftEmail({
        candidate: analysis.candidate,
        questions: analysis.candidate.questions,
      });
      setDrafts((d) => ({ ...d, [id]: draft }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Entwurf fehlgeschlagen.');
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h2 className="mb-2 text-2xl font-bold text-slate-900">Rückfragen & E-Mails</h2>
        <p className="text-slate-600">
          Vorgeschlagene Fragen und Entwürfe. Nichts wird automatisch versendet.
        </p>
      </div>

      <div className="flex flex-col gap-8">
        {analyses.map(({ candidate }) => {
          const draft = drafts[candidate.id];
          return (
            <Card key={candidate.id} className="overflow-hidden rounded-2xl border-slate-200/60 bg-white shadow-md">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-6 py-4">
                <h3 className="text-lg font-bold text-slate-900">{candidate.name}</h3>
              </div>
              <CardContent className="p-6">
                {candidate.questions.length ? (
                  <div className="mb-8">
                    <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-indigo-700">
                      Vorgeschlagene Fragen
                    </h4>
                    <ul className="space-y-2">
                      {candidate.questions.map((q, i) => (
                        <li key={`${candidate.id}-q-${i}`} className="flex gap-2 font-medium text-slate-700">
                          <span className="font-bold text-indigo-400" aria-hidden="true">•</span>
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mb-8 italic text-slate-500">Keine offenen Rückfragen.</p>
                )}

                {!draft ? (
                  <Button
                    onClick={() => void handleDraft(candidate.id)}
                    disabled={pending === candidate.id || !candidate.questions.length}
                    className="rounded-xl bg-slate-900 font-semibold text-white shadow-md hover:bg-slate-800"
                  >
                    {pending === candidate.id ? 'Erstelle Entwurf...' : '✉️ Entwurf erstellen'}
                  </Button>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
                    <h4 className="mb-4 flex items-center gap-2 font-bold text-slate-900">
                      <Mail className="text-slate-400" size={18} aria-hidden="true" /> Entwurf (Vorschau)
                    </h4>
                    <p className="mb-2 text-sm text-slate-500">
                      <strong>An:</strong> {draft.to} &middot; <strong>Betreff:</strong> {draft.subject}
                    </p>
                    <pre className="mb-6 whitespace-pre-wrap rounded-lg border border-slate-100 bg-white p-4 font-sans text-sm leading-relaxed text-slate-600 shadow-sm">
                      {draft.body}
                    </pre>
                    <Button asChild className="rounded-xl bg-slate-900 font-semibold text-white shadow-md hover:bg-slate-800">
                      <a
                        href={`mailto:${encodeURIComponent(draft.to)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}
                      >
                        📧 In E-Mail-Programm öffnen
                      </a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Wire tabs 2 and 5 into the shell**

In `web/src/pages/workspace/Workspace.tsx`:

```tsx
import { UploadTab } from './UploadTab';
import { QuestionsTab } from './QuestionsTab';
```

```tsx
                {activeTab === 2 && <UploadTab />}
                {activeTab === 5 && <QuestionsTab />}
```

- [ ] **Step 7: Verify build and full suite**

Run: `npm run build && npm run test:run`
Expected: both PASS.

- [ ] **Step 8: Commit**

```bash
git add -A web/src
git commit -m "feat(web): restore upload, demo data and email drafts

PDF upload works — the alert() claiming the backend needed changes was false
(api/main.py:138 has read PDFs all along). The file input was display:none and
so unreachable by keyboard. The drop zone promised drag-and-drop and had no
handler. Adds the documented Demo-Daten button (README.md:31), which the
workspace already told users to press."
```

---

### Task 10: Cleanup and end-to-end verification

**Files:**
- Delete: `web/src/App.css`, `web/src/components/SplineScene.tsx`,
  `web/src/assets/hero.png`, `web/src/assets/react.svg`, `web/src/assets/vite.svg`
- Modify: `web/src/App.tsx` (drop `.stApp`)
- Modify: `web/src/index.css` (define `hide-scrollbar`)
- Modify: `web/src/components/Intro.tsx` (drop dangling animation references)

- [ ] **Step 1: Delete dead files**

```bash
cd web
rm src/App.css src/components/SplineScene.tsx src/assets/hero.png src/assets/react.svg src/assets/vite.svg
```

Verify nothing imported them:

```bash
grep -rn "App.css\|SplineScene\|hero.png\|react.svg\|vite.svg" src/ || echo "clean"
```

Expected: `clean`.

- [ ] **Step 2: Define the missing utility**

`hide-scrollbar` is used on the tab strip and the home gallery but defined
nowhere, so scrollbars show. Append to `web/src/index.css`:

```css
@layer utilities {
  .hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
}
```

- [ ] **Step 3: Remove the Streamlit leftover**

In `web/src/App.tsx`, change `<div className="stApp">` to `<div>`. The class is
defined nowhere and names a framework this app no longer uses.

- [ ] **Step 4: Drop the dangling animation references**

In `web/src/components/Intro.tsx`, remove `animation: 'fadeUp 1.1s ease both .4s'`
and `animation: 'bob 1.8s infinite ease-in-out'`, and the `hero`/`lift` class
names. Those keyframes and classes are defined nowhere (`.hero`/`.lift` lived in
the just-deleted `App.css`), so they have never done anything. Spec B replaces
this component wholesale; do not reimplement them.

- [ ] **Step 5: Verify the whole suite and the build**

Run: `npm run test:run && npm run build && npm run lint`
Expected: all PASS.

- [ ] **Step 6: End-to-end against the real backend**

Terminal 1, from the repo root:

```bash
uvicorn api.main:app --reload
```

Terminal 2:

```bash
cd web && npm run dev
```

In the browser at `http://localhost:5173/workspace`, verify each:

1. No "Kein LLM aktiv" banner flash before the label loads; it reflects reality.
2. "Demo-Daten laden" fills the job text and adds candidates.
3. ① "Profil analysieren" lists requirements with Muss/Kann badges.
4. ② Drag a `.txt` onto the zone — it uploads.
5. ② Upload a real `.pdf` — it uploads, no alert.
6. ② Tab to the upload control with the keyboard only and open the picker with
   Enter/Space.
7. ② "Gesamtanalyse starten" produces results.
8. ③ Cards show names and n/m counts. Open a profile; the drawer slides in and
   out.
9. ④ Gaps list; ⑤ "Entwurf erstellen" returns a draft with To/Subject/Body.
10. ⑥ Audit log shows server entries naming Stellenprofil-Agent, CV-Agent, etc.
11. Press "Gesamtanalyse starten" again: the Network tab shows
    `POST /api/analysis` with `candidates: []` and a populated `cached_backends`.
12. Reload: everything is gone. This is the privacy promise, not a bug.

- [ ] **Step 7: Commit**

```bash
git add -A web
git commit -m "chore(web): remove dead code and define hide-scrollbar

App.css was never imported, taking .hero/.lift with it, so the intro's lift
animation never ran. hide-scrollbar and the fadeUp/bob keyframes were
referenced but defined nowhere."
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| 1. Type generation (`gen:types`, no-op check) | 1, 2 |
| 2. API client (multipart, 413, 429) | 4 |
| 3. Store (backend shapes, server audit, no persistence) | 5 |
| 4. Client-side cache (content key, no fallback caching) | 3, 6 |
| 5. PDF upload | 9 |
| 5. Demo-Daten laden | 9 |
| 5. Backend label | 5, 7 |
| 6. Workspace split | 7, 8, 9 |
| 6. Email draft via `POST /api/email` | 9 |
| 7. Spline script hook | **Gap — see below** |
| 7. `CandidateDetail` `AnimatePresence` | 8 |
| 7. Visible errors | 7 |
| 7. Dead code | 10 |
| 7. Undefined CSS | 10 |
| Build blockers | 2 |
| Verification | 10 |

**Gap found and resolved:** the spec's `useSplineViewer()` hook has no task.
It is deliberately dropped. Spec B replaces the loading strategy entirely
(bundling `@splinetool/viewer` rather than injecting a script), and Spec A's
new `Workspace.tsx` shell no longer renders a `<spline-viewer>` at all — so the
bug it fixed (a blank scene when landing on `/workspace`) is gone by
construction. Writing the hook here would be code Spec B deletes. Noted in the
handoff below so it is a decision, not an oversight.

**Placeholder scan:** clean. Every code step carries complete code.

**Type consistency:** `CandidateAnalysisOut`, `CandidateOut`, `RequirementOut`,
`AuditEntryOut`, `MatchResultOut`, `GapOut`, `EmailOut` are used identically
across Tasks 3–9 and all come from `types.ts`. `appendAudit` (Task 5) is called
with `AuditEntryOut[]` in Task 6. `metCount`/`STATUS_LABEL`/`STATUS_CLASS`
(Task 8, Step 3) are consumed in Task 8 Steps 4 and 7. `useScreening`'s five
returned functions (Task 6) are consumed in Tasks 7 and 9.
