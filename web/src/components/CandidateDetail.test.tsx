import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CandidateDetail } from './CandidateDetail';
import { useSessionStore } from '../store/session';
import type { components } from '../api/types';

type CandidateOut = components['schemas']['CandidateOut'];

function candidate(over: Partial<CandidateOut> = {}): CandidateOut {
  return {
    id: 'cand_0', name: 'Lena', source: 'cv.txt', raw_text: 'x', skills: [],
    years: null, education: 0, education_label: 'unknown', languages: [],
    email: null, matches: [], gaps: [], questions: [], ...over,
  };
}

beforeEach(() => {
  useSessionStore.getState().reset();
  useSessionStore.getState().setAnalyses([
    { candidate: candidate({ name: 'Lena Hoffmann' }), backend: 'rule-based', fallback_reason: null },
  ]);
});

describe('CandidateDetail', () => {
  it('renders nothing until a candidate is selected', () => {
    render(<CandidateDetail />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens as a dialog for the selected candidate', () => {
    useSessionStore.getState().setSelectedCandidateId('cand_0');
    render(<CandidateDetail />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Lena Hoffmann')).toBeInTheDocument();
  });

  it('closes on Escape and clears the selection', async () => {
    useSessionStore.getState().setSelectedCandidateId('cand_0');
    render(<CandidateDetail />);
    await userEvent.keyboard('{Escape}');
    expect(useSessionStore.getState().selectedCandidateId).toBeNull();
  });
});
