import { useCallback, useRef } from 'react';
import { apiClient, ApiError } from '../api/client';
import type { CandidateAnalysisOut } from '../api/client';
import i18n from '../i18n/config';
import { useSessionStore } from '../store/session';
import { AnalysisCache } from '../lib/analysisCache';
import { track } from '../lib/analytics';

// Only the step and the HTTP status (429 = daily limit reached), never the message.
function trackError(step: string, e: unknown): void {
  track('api-error', { step, status: e instanceof ApiError ? e.status : 0 });
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return i18n.t('errors.unknown');
}

export function useScreening() {
  // One cache per mount. Never persisted; a reload clears it, the same promise
  // the store keeps (README.md:436).
  const cacheRef = useRef<AnalysisCache | null>(null);
  cacheRef.current ??= new AnalysisCache();

  const fetchBackendLabel = useCallback(async () => {
    try {
      const { label, is_llm } = await apiClient.getBackend();
      useSessionStore.getState().setBackend(label, is_llm);
    } catch {
      // A missing backend label must not block the workspace; the banner just
      // stays in its "unknown" state.
    }
  }, []);

  const loadDemo = useCallback(async () => {
    const store = useSessionStore.getState();
    store.setError(null);
    try {
      const demo = await apiClient.getDemo();
      store.setJobText(demo.job_text);
      for (const [index, cv] of demo.cvs.entries()) {
        const { candidate, audit } = await apiClient.uploadCv({
          name: cv.name,
          index,
          text: cv.text,
        });
        useSessionStore.getState().addCandidate(candidate);
        useSessionStore.getState().appendAudit(audit);
      }
      track('demo-load');
    } catch (e) {
      trackError('demo', e);
      useSessionStore.getState().setError(messageOf(e));
    }
  }, []);

  const parseJob = useCallback(async () => {
    const store = useSessionStore.getState();
    if (!store.jobText.trim()) return;
    store.setError(null);
    try {
      const { requirements, audit } = await apiClient.parseJobProfile(store.jobText);
      useSessionStore.getState().setRequirements(requirements);
      useSessionStore.getState().appendAudit(audit);
      track('job-parse', { requirements: requirements.length });
    } catch (e) {
      trackError('job', e);
      useSessionStore.getState().setError(messageOf(e));
    }
  }, []);

  const uploadFiles = useCallback(async (files: File[]) => {
    useSessionStore.getState().setError(null);
    const failures: string[] = [];

    for (const file of files) {
      // The backend indexes candidates positionally, so the index must reflect
      // the list as it grows, not this batch.
      const index = useSessionStore.getState().candidates.length;
      try {
        const { candidate, audit } = await apiClient.uploadCv({ name: file.name, index, file });
        useSessionStore.getState().addCandidate(candidate);
        useSessionStore.getState().appendAudit(audit);
      } catch (e) {
        trackError('cv', e);
        failures.push(`${file.name}: ${messageOf(e)}`);
      }
    }

    if (files.length > failures.length) {
      track('cv-upload', { files: files.length - failures.length });
    }
    if (failures.length) useSessionStore.getState().setError(failures.join(' · '));
  }, []);

  const runAnalysis = useCallback(async () => {
    const store = useSessionStore.getState();
    const { requirements, candidates } = store;
    if (!requirements.length || !candidates.length) return;

    const cache = cacheRef.current!;
    const hits: CandidateAnalysisOut[] = [];
    const misses = [];
    for (const candidate of candidates) {
      const hit = cache.get(candidate, requirements);
      if (hit) hits.push(hit);
      else misses.push(candidate);
    }

    store.setError(null);
    store.setIsAnalyzing(true);
    try {
      const result = await apiClient.analyze({
        requirements,
        candidates: misses,
        // The server never sees the cached candidates, but the audit summary
        // has to count them (api/main.py, AnalysisIn.cached_backends).
        cached_backends: hits.map((h) => h.backend),
      });
      for (const analysis of result.analyses) {
        cache.set(analysis.candidate, requirements, analysis);
      }
      // Restore the recruiter's upload order: cached and fresh results are
      // keyed back to their candidate by raw_text.
      const byText = new Map(
        [...hits, ...result.analyses].map((a) => [a.candidate.raw_text, a]),
      );
      const ordered = candidates
        .map((c) => byText.get(c.raw_text))
        .filter((a): a is CandidateAnalysisOut => Boolean(a));
      useSessionStore.getState().setAnalyses(ordered);
      useSessionStore.getState().appendAudit(result.audit);
      track('analysis-run', { candidates: candidates.length, cached: hits.length });
    } catch (e) {
      trackError('analysis', e);
      useSessionStore.getState().setError(messageOf(e));
    } finally {
      useSessionStore.getState().setIsAnalyzing(false);
    }
  }, []);

  return { loadDemo, parseJob, uploadFiles, runAnalysis, fetchBackendLabel };
}
