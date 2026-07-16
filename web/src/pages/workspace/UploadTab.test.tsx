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

beforeEach(() => {
  useSessionStore.getState().reset();
  vi.restoreAllMocks();
});

describe('UploadTab', () => {
  it('exposes a keyboard-reachable file input', () => {
    render(<UploadTab />);
    // sr-only keeps it reachable; the old display:none did not.
    expect(screen.getByLabelText(/Dateien auswählen/i)).toBeInTheDocument();
  });

  it('accepts PDF, because the backend reads PDFs', () => {
    render(<UploadTab />);
    const input = screen.getByLabelText(/Dateien auswählen/i);
    expect(input.getAttribute('accept')).toContain('.pdf');
  });

  it('uploads a dropped file', async () => {
    const spy = vi.spyOn(apiClient, 'uploadCv').mockResolvedValue({
      candidate: candidate(),
      audit: [],
      backend: 'regelbasiert',
    });
    render(<UploadTab />);

    const file = new File(['Skills: Python'], 'cv.txt', { type: 'text/plain' });
    const zone = screen.getByTestId('dropzone');
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
      job_text: 'Wir suchen Python.',
      cvs: [],
    });
    render(<UploadTab />);
    await userEvent.click(screen.getByRole('button', { name: /Demo-Daten laden/ }));
    expect(spy).toHaveBeenCalledOnce();
  });
});
