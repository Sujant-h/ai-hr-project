import i18n, { currentLanguage } from '../i18n/config';
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
  // A plain field rather than a constructor parameter property: this project
  // sets erasableSyntaxOnly, which forbids parameter properties.
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  let message = res.statusText;
  try {
    const body = await res.json();
    if (body?.detail) {
      // FastAPI sends a string for HTTPException, and an array of
      // {loc, msg, type} for a 422 validation failure.
      message = Array.isArray(body.detail)
        ? body.detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join('; ')
        : String(body.detail);
    }
  } catch {
    // A non-JSON error body (a proxy 502, say) still has to become an ApiError.
  }

  // Raised by slowapi middleware that never sees our `lang`, so its English
  // wording is replaced here rather than translated on the server.
  if (res.status === 429) {
    message = i18n.t('errors.rateLimited');
  }

  return new ApiError(res.status, message);
}

function getClientId(): string {
  let id = localStorage.getItem('clientId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('clientId', id);
  }
  return id;
}

function getAuthHeaders(): Record<string, string> {
  return { 'X-Client-ID': getClientId() };
}

/** Append the active language to a GET endpoint's query string. */
function withLang(endpoint: string): string {
  const sep = endpoint.includes('?') ? '&' : '?';
  return `${endpoint}${sep}lang=${currentLanguage()}`;
}

async function getJson<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

async function postJson<T>(endpoint: string, payload: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

/**
 * No Content-Type header: only the browser knows the multipart boundary, so it
 * has to set the header itself. Setting it by hand breaks the upload.
 */
async function postForm<T>(endpoint: string, form: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, { 
    method: 'POST', 
    headers: getAuthHeaders(),
    body: form 
  });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

/**
 * Every call carries the active language: the agents write prose the recruiter
 * reads (match notes, gaps, follow-up questions, the audit trail), and it has to
 * come back in the language they picked. It is read at call time rather than
 * captured once, so a switch takes effect on the very next request.
 */
export const apiClient = {
  getBackend: () => getJson<BackendOut>(withLang('/backend')),

  getDemo: () => getJson<DemoOut>(withLang('/demo')),

  parseJobProfile: (text: string) =>
    postJson<JobProfileOut>('/job-profile', { text, lang: currentLanguage() }),

  /** POST /api/cv reads Form fields, not JSON (api/main.py:148). */
  uploadCv: (input: { name: string; index: number; file?: File; text?: string }) => {
    const form = new FormData();
    form.set('name', input.name);
    form.set('index', String(input.index));
    form.set('lang', currentLanguage());
    if (input.file) form.set('file', input.file);
    else if (input.text !== undefined) form.set('text', input.text);
    return postForm<CvOut>('/cv', form);
  },

  analyze: (input: {
    requirements: RequirementOut[];
    candidates: CandidateOut[];
    cached_backends: string[];
  }) => postJson<AnalysisOut>('/analysis', { ...input, lang: currentLanguage() }),

  draftEmail: (input: { candidate: CandidateOut; questions: string[] }) =>
    postJson<EmailOut>('/email', { ...input, lang: currentLanguage() }),
};
