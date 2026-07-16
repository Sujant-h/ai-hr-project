import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from './session';
import type { components } from '../api/types';

type CandidateOut = components['schemas']['CandidateOut'];

function candidate(over: Partial<CandidateOut> = {}): CandidateOut {
  return {
    id: 'cand_0',
    name: 'Lena',
    source: 'cv.txt',
    raw_text: 'x',
    skills: [],
    years: null,
    education: 0,
    education_label: 'unbekannt',
    languages: [],
    email: null,
    matches: [],
    gaps: [],
    questions: [],
    ...over,
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

  it('is unknown before the backend has been asked, so the banner cannot assume', () => {
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
    expect(useSessionStore.getState().candidates.map((c) => c.id)).toEqual(['cand_1']);
  });
});

describe('audit', () => {
  it('appends server entries in order', () => {
    useSessionStore
      .getState()
      .appendAudit([{ timestamp: '1', agent: 'CV-Agent', action: 'a', detail: 'd' }]);
    useSessionStore
      .getState()
      .appendAudit([{ timestamp: '2', agent: 'Matching-Agent', action: 'b', detail: 'e' }]);

    expect(useSessionStore.getState().auditLog.map((e) => e.agent)).toEqual([
      'CV-Agent',
      'Matching-Agent',
    ]);
  });
});

describe('reset', () => {
  it('clears everything, because nothing survives a reload', () => {
    const s = useSessionStore.getState();
    s.setJobText('x');
    s.addCandidate(candidate());
    s.setError('boom');
    s.setBackendLabel('LLM (gpt-4o-mini)');
    s.reset();

    const after = useSessionStore.getState();
    expect(after.jobText).toBe('');
    expect(after.candidates).toEqual([]);
    expect(after.error).toBeNull();
    expect(after.backendLabel).toBeNull();
  });
});
