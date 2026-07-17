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
      { id: 'r0', label: 'Python', kind: 'experience', value: '3 Jahre', importance: 'muss' },
      { id: 'r1', label: 'Go', kind: 'skill', value: 'Kenntnisse', importance: 'kann' },
    ]);
    render(<JobProfileTab />);

    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('3 Jahre')).toBeInTheDocument();
    expect(screen.getByText('Must')).toBeInTheDocument();
    expect(screen.getByText('Nice to have')).toBeInTheDocument();
  });

  it('disables analysis until there is text to analyse', async () => {
    render(<JobProfileTab />);
    expect(screen.getByRole('button', { name: /Analyze Profile/ })).toBeDisabled();

    await userEvent.type(screen.getByRole('textbox'), 'Wir suchen Python.');
    expect(screen.getByRole('button', { name: /Analyze Profile/ })).toBeEnabled();
  });

  it('shows a pending state while the agent works', async () => {
    let release!: () => void;
    vi.spyOn(apiClient, 'parseJobProfile').mockReturnValue(
      new Promise((res) => {
        release = () => res({ requirements: [], audit: [], backend: 'rule-based' });
      }),
    );
    useSessionStore.getState().setJobText('Wir suchen Python.');
    render(<JobProfileTab />);

    await userEvent.click(screen.getByRole('button', { name: /Analyze Profile/ }));
    expect(screen.getByRole('button', { name: /Analyzing/ })).toBeDisabled();
    release();
  });
});
