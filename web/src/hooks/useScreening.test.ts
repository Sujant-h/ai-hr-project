import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScreening } from './useScreening';
import { useSessionStore } from '../store/session';
import { apiClient, ApiError } from '../api/client';
import type { components } from '../api/types';

type CandidateOut = components['schemas']['CandidateOut'];
type RequirementOut = components['schemas']['RequirementOut'];

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

beforeEach(() => {
  useSessionStore.getState().reset();
  vi.restoreAllMocks();
});

describe('parseJob', () => {
  it('stores requirements and the server audit trail', async () => {
    vi.spyOn(apiClient, 'parseJobProfile').mockResolvedValue({
      requirements: [req],
      audit: [{ timestamp: '1', agent: 'Stellenprofil-Agent', action: 'a', detail: 'd' }],
      backend: 'regelbasiert',
    });
    useSessionStore.getState().setJobText('Wir suchen Python.');

    const { result } = renderHook(() => useScreening());
    await act(() => result.current.parseJob());

    expect(useSessionStore.getState().requirements).toEqual([req]);
    expect(useSessionStore.getState().auditLog[0].agent).toBe('Stellenprofil-Agent');
  });

  it('surfaces a failure to the user rather than only the audit log', async () => {
    vi.spyOn(apiClient, 'parseJobProfile').mockRejectedValue(new ApiError(429, 'Zu viele Anfragen.'));
    useSessionStore.getState().setJobText('x');

    const { result } = renderHook(() => useScreening());
    await act(() => result.current.parseJob());

    expect(useSessionStore.getState().error).toBe('Zu viele Anfragen.');
  });

  it('does nothing when there is no job text', async () => {
    const spy = vi.spyOn(apiClient, 'parseJobProfile');
    const { result } = renderHook(() => useScreening());
    await act(() => result.current.parseJob());
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('uploadFiles', () => {
  it('sends each file and stores the returned candidate', async () => {
    const spy = vi.spyOn(apiClient, 'uploadCv').mockResolvedValue({
      candidate: candidate(),
      audit: [],
      backend: 'regelbasiert',
    });
    const { result } = renderHook(() => useScreening());
    await act(() => result.current.uploadFiles([new File(['x'], 'cv.txt')]));

    expect(spy).toHaveBeenCalledOnce();
    expect(useSessionStore.getState().candidates).toHaveLength(1);
  });

  it('indexes uploads by their position in the existing list', async () => {
    const spy = vi.spyOn(apiClient, 'uploadCv').mockImplementation(async ({ index }) => ({
      candidate: candidate({ id: `cand_${index}` }),
      audit: [],
      backend: 'regelbasiert',
    }));
    useSessionStore.getState().addCandidate(candidate({ id: 'cand_0' }));

    const { result } = renderHook(() => useScreening());
    await act(() => result.current.uploadFiles([new File(['y'], 'second.txt')]));

    expect(spy.mock.calls[0][0].index).toBe(1);
  });

  it('reports a rejected file without discarding the ones that worked', async () => {
    vi.spyOn(apiClient, 'uploadCv')
      .mockResolvedValueOnce({ candidate: candidate({ id: 'cand_0' }), audit: [], backend: 'regelbasiert' })
      .mockRejectedValueOnce(new ApiError(413, 'Datei zu groß (max. 10 MB).'));

    const { result } = renderHook(() => useScreening());
    await act(() =>
      result.current.uploadFiles([new File(['a'], 'ok.txt'), new File(['b'], 'big.pdf')]),
    );

    expect(useSessionStore.getState().candidates).toHaveLength(1);
    expect(useSessionStore.getState().error).toContain('Datei zu groß');
  });
});

describe('runAnalysis', () => {
  it('sends only uncached candidates and counts the cached ones', async () => {
    const cached = candidate({ id: 'cand_0', raw_text: 'Skills: Python' });
    const fresh = candidate({ id: 'cand_1', name: 'Marc', raw_text: 'Skills: Go' });

    const spy = vi.spyOn(apiClient, 'analyze');
    const store = useSessionStore.getState();
    store.setRequirements([req]);
    store.addCandidate(cached);
    store.addCandidate(fresh);

    const { result } = renderHook(() => useScreening());

    // First run populates the cache for both candidates.
    spy.mockResolvedValueOnce({
      analyses: [
        { candidate: cached, backend: 'regelbasiert', fallback_reason: null },
        { candidate: fresh, backend: 'regelbasiert', fallback_reason: null },
      ],
      audit: [],
    });
    await act(() => result.current.runAnalysis());
    expect(spy.mock.calls[0][0].candidates).toHaveLength(2);

    // Second run sends nothing and reports both as cached.
    await act(() => result.current.runAnalysis());
    expect(spy.mock.calls[1][0].candidates).toHaveLength(0);
    expect(spy.mock.calls[1][0].cached_backends).toEqual(['regelbasiert', 'regelbasiert']);
    expect(useSessionStore.getState().analyses).toHaveLength(2);
  });

  it('preserves the upload order in the results, cached or fresh', async () => {
    const first = candidate({ id: 'cand_0', name: 'Anna', raw_text: 'A' });
    const second = candidate({ id: 'cand_1', name: 'Bea', raw_text: 'B' });

    const spy = vi.spyOn(apiClient, 'analyze');
    const store = useSessionStore.getState();
    store.setRequirements([req]);
    store.addCandidate(first);
    store.addCandidate(second);

    const { result } = renderHook(() => useScreening());

    // Return them out of order; the hook must restore upload order.
    spy.mockResolvedValueOnce({
      analyses: [
        { candidate: second, backend: 'regelbasiert', fallback_reason: null },
        { candidate: first, backend: 'regelbasiert', fallback_reason: null },
      ],
      audit: [],
    });
    await act(() => result.current.runAnalysis());

    expect(useSessionStore.getState().analyses.map((a) => a.candidate.name)).toEqual(['Anna', 'Bea']);
  });

  it('re-sends a candidate whose analysis fell back', async () => {
    const c = candidate();
    const spy = vi.spyOn(apiClient, 'analyze').mockResolvedValue({
      analyses: [{ candidate: c, backend: 'regelbasiert', fallback_reason: 'timeout' }],
      audit: [],
    });
    const store = useSessionStore.getState();
    store.setRequirements([req]);
    store.addCandidate(c);

    const { result } = renderHook(() => useScreening());
    await act(() => result.current.runAnalysis());
    await act(() => result.current.runAnalysis());

    expect(spy.mock.calls[1][0].candidates).toHaveLength(1);
  });

  it('does nothing without requirements', async () => {
    const spy = vi.spyOn(apiClient, 'analyze');
    useSessionStore.getState().addCandidate(candidate());

    const { result } = renderHook(() => useScreening());
    await act(() => result.current.runAnalysis());

    expect(spy).not.toHaveBeenCalled();
  });

  it('always clears isAnalyzing, even on failure', async () => {
    vi.spyOn(apiClient, 'analyze').mockRejectedValue(new ApiError(500, 'boom'));
    const store = useSessionStore.getState();
    store.setRequirements([req]);
    store.addCandidate(candidate());

    const { result } = renderHook(() => useScreening());
    await act(() => result.current.runAnalysis());

    expect(useSessionStore.getState().isAnalyzing).toBe(false);
    expect(useSessionStore.getState().error).toBe('boom');
  });
});

describe('fetchBackendLabel', () => {
  it('stores the label', async () => {
    vi.spyOn(apiClient, 'getBackend').mockResolvedValue({ label: 'LLM (gpt-4o-mini)' });
    const { result } = renderHook(() => useScreening());
    await act(() => result.current.fetchBackendLabel());
    expect(useSessionStore.getState().isLlmActive).toBe(true);
  });

  it('does not block the workspace when the backend is unreachable', async () => {
    vi.spyOn(apiClient, 'getBackend').mockRejectedValue(new ApiError(503, 'down'));
    const { result } = renderHook(() => useScreening());
    await act(() => result.current.fetchBackendLabel());
    expect(useSessionStore.getState().error).toBeNull();
    expect(useSessionStore.getState().backendLabel).toBeNull();
  });
});
