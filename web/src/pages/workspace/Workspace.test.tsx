import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Workspace } from './Workspace';
import { apiClient } from '../../api/client';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(apiClient, 'getBackend').mockResolvedValue({ label: 'regelbasiert' });
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Workspace />
    </MemoryRouter>,
  );
}

describe('Workspace tabs', () => {
  it('exposes a real tablist', () => {
    renderAt('/workspace');
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(6);
  });

  it('opens the tab named in the URL', () => {
    renderAt('/workspace?tab=audit');
    expect(screen.getByRole('tab', { name: /Audit Log/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('falls back to the first tab when the query is missing or unknown', () => {
    renderAt('/workspace?tab=nonsense');
    expect(screen.getByRole('tab', { name: /Stellenprofil/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('writes the active tab to the URL when the user switches', async () => {
    renderAt('/workspace');
    await userEvent.click(screen.getByRole('tab', { name: /Bewerbungen/ }));
    expect(screen.getByRole('tab', { name: /Bewerbungen/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
