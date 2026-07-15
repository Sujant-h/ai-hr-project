import type { components } from './types';

const API_BASE = '/api';

export type BackendOut = components['schemas']['BackendOut'];
export type DemoOut = components['schemas']['DemoOut'];
export type JobProfileOut = components['schemas']['JobProfileOut'];
export type CandidateOut = components['schemas']['CandidateOut'];
export type PipelineResult = components['schemas']['PipelineResult'];
export type EmailDraftOut = components['schemas']['EmailDraftOut'];

async function fetcher<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let errMessage = res.statusText;
    try {
      const errBody = await res.json();
      if (errBody.detail) errMessage = typeof errBody.detail === 'string' ? errBody.detail : JSON.stringify(errBody.detail);
    } catch (e) {
      // ignore
    }
    throw new Error(`API Error: ${res.status} - ${errMessage}`);
  }

  return res.json();
}

export const apiClient = {
  getBackend: () => fetcher<BackendOut>('/backend'),
  
  getDemoData: () => fetcher<DemoOut>('/demo'),
  
  parseJobProfile: (text: string) => 
    fetcher<JobProfileOut>('/job-profile', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
    
  extractCv: (filename: string, text: string) => 
    fetcher<CandidateOut>('/cv', {
      method: 'POST',
      body: JSON.stringify({ filename, text }),
    }),
    
  runAnalysis: (jobProfileText: string, candidates: { filename: string; text: string }[]) => 
    fetcher<PipelineResult>('/analysis', {
      method: 'POST',
      body: JSON.stringify({ job_text: jobProfileText, cvs: candidates }),
    }),
    
  draftEmail: (jobProfileText: string, candidate: CandidateOut) => 
    fetcher<EmailDraftOut>('/email-draft', {
      method: 'POST',
      body: JSON.stringify({ job_text: jobProfileText, candidate }),
    }),
};
