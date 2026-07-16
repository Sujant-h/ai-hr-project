import { describe, it, expect } from 'vitest';
import { AnalysisCache, cacheKey } from './analysisCache';
import type { components } from '../api/types';

type CandidateOut = components['schemas']['CandidateOut'];
type RequirementOut = components['schemas']['RequirementOut'];
type CandidateAnalysisOut = components['schemas']['CandidateAnalysisOut'];

const req: RequirementOut = {
  id: 'r0',
  label: 'Python',
  kind: 'skill',
  value: 'Python',
  importance: 'muss',
};

function candidate(over: Partial<CandidateOut> = {}): CandidateOut {
  return {
    id: 'cand_0',
    name: 'Lena',
    source: 'cv.txt',
    raw_text: 'Skills: Python',
    skills: ['Python'],
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

  it('does not collide when content is shuffled across the boundary', () => {
    // A naive concat would let "ab"+"c" and "a"+"bc" hash alike.
    const a = cacheKey(candidate({ raw_text: 'ab' }), []);
    const b = cacheKey(candidate({ raw_text: 'a' }), [
      { ...req, id: 'b', label: '', kind: 'skill', value: '', importance: 'muss' },
    ]);
    expect(a).not.toBe(b);
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

  it('misses when the requirements changed, because last run answered a different question', () => {
    const cache = new AnalysisCache();
    cache.set(candidate(), [req], analysis());
    const other: RequirementOut = { ...req, id: 'r1', label: 'Go', value: 'Go' };
    expect(cache.get(candidate(), [req, other])).toBeUndefined();
  });

  it('clears', () => {
    const cache = new AnalysisCache();
    cache.set(candidate(), [req], analysis());
    cache.clear();
    expect(cache.get(candidate(), [req])).toBeUndefined();
  });
});
