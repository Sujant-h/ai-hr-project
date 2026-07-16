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
      // FastAPI sends a string for HTTPException, and an array of
      // {loc, msg, type} for a 422 validation failure.
      message = Array.isArray(body.detail)
        ? body.detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join('; ')
        : String(body.detail);
    }
  } catch {
    // A non-JSON error body (a proxy 502, say) still has to become an ApiError.
  }

  if (res.status === 429) {
    // slowapi's own message is English; everything user-facing here is German.
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

/**
 * No Content-Type header: only the browser knows the multipart boundary, so it
 * has to set the header itself. Setting it by hand breaks the upload.
 */
async function postForm<T>(endpoint: string, form: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', body: form });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

export const apiClient = {
  getBackend: () => getJson<BackendOut>('/backend'),

  getDemo: () => getJson<DemoOut>('/demo'),

  parseJobProfile: (text: string) => postJson<JobProfileOut>('/job-profile', { text }),

  /** POST /api/cv reads Form fields, not JSON (api/main.py:148). */
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
