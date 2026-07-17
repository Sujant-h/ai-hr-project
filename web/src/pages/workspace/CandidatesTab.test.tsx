import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CandidatesTab } from './CandidatesTab';
import { useSessionStore } from '../../store/session';
import type { components } from '../../api/types';

type CandidateOut = components['schemas']['CandidateOut'];
type MatchResultOut = components['schemas']['MatchResultOut'];

function match(over: Partial<MatchResultOut> = {}): MatchResultOut {
  return {
    requirement_id: 'r0',
    label: 'Python',
    kind: 'skill',
    importance: 'muss',
    status: 'erfuellt',
    note: '',
    value: 'Python',
    ...over,
  };
}

function candidate(over: Partial<CandidateOut> = {}): CandidateOut {
  return {
    id: 'cand_0',
    name: 'Lena',
    source: 'cv.txt',
    raw_text: 'x',
    skills: [],
    years: null,
    education: 0,
    education_label: 'unknown',
    languages: [],
    email: null,
    matches: [],
    gaps: [],
    questions: [],
    ...over,
  };
}

beforeEach(() => useSessionStore.getState().reset());

describe('CandidatesTab', () => {
  it('tells the recruiter to run an analysis when there is none', () => {
    render(<CandidatesTab />);
    expect(screen.getByText(/No analysis performed yet/)).toBeInTheDocument();
  });

  it('shows the candidate name, not a filename', () => {
    useSessionStore.getState().setAnalyses([
      { candidate: candidate({ name: 'Lena Hoffmann' }), backend: 'rule-based', fallback_reason: null },
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
        backend: 'rule-based',
        fallback_reason: null,
      },
    ]);
    render(<CandidatesTab />);
    expect(screen.getByText(/1\/3/)).toBeInTheDocument();
  });

  it('marks a fallback so a rule-based result is never mistaken for an LLM one', () => {
    useSessionStore.getState().setAnalyses([
      { candidate: candidate(), backend: 'rule-based', fallback_reason: 'timeout' },
    ]);
    render(<CandidatesTab />);
    expect(screen.getByText(/Fallback/)).toBeInTheDocument();
  });
});
