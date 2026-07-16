import { create } from 'zustand';
import type {
  AuditEntryOut,
  CandidateAnalysisOut,
  CandidateOut,
  RequirementOut,
} from '../api/client';

/**
 * agents/dispatch.py:28 returns exactly "regelbasiert" when no LLM is
 * configured, and "LLM (<model>)" otherwise. It is a free-form German display
 * string, not a union — so the label is stored as-is and the boolean derived.
 */
const RULE_BASED_LABEL = 'regelbasiert';

interface SessionState {
  backendLabel: string | null;
  isLlmActive: boolean;
  jobText: string;
  requirements: RequirementOut[];
  candidates: CandidateOut[];
  analyses: CandidateAnalysisOut[];
  isAnalyzing: boolean;
  auditLog: AuditEntryOut[];
  selectedCandidateId: string | null;
  error: string | null;

  setBackendLabel: (label: string) => void;
  setJobText: (text: string) => void;
  setRequirements: (requirements: RequirementOut[]) => void;
  addCandidate: (candidate: CandidateOut) => void;
  removeCandidate: (id: string) => void;
  setAnalyses: (analyses: CandidateAnalysisOut[]) => void;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
  appendAudit: (entries: AuditEntryOut[]) => void;
  clearAuditLog: () => void;
  setSelectedCandidateId: (id: string | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initial = {
  backendLabel: null,
  isLlmActive: false,
  jobText: '',
  requirements: [],
  candidates: [],
  analyses: [],
  isAnalyzing: false,
  auditLog: [],
  selectedCandidateId: null,
  error: null,
} satisfies Partial<SessionState>;

/**
 * In memory only. README.md:436 and the api/main.py docstring both promise that
 * no candidate data is persisted and that everything is cleared on reload.
 * Do not add zustand's persist middleware.
 */
export const useSessionStore = create<SessionState>((set) => ({
  ...initial,

  setBackendLabel: (label) =>
    set({ backendLabel: label, isLlmActive: label !== RULE_BASED_LABEL }),
  setJobText: (jobText) => set({ jobText }),
  setRequirements: (requirements) => set({ requirements }),
  addCandidate: (candidate) => set((s) => ({ candidates: [...s.candidates, candidate] })),
  removeCandidate: (id) => set((s) => ({ candidates: s.candidates.filter((c) => c.id !== id) })),
  setAnalyses: (analyses) => set({ analyses }),
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  // Entries come from the server on every response: the backend already records
  // which agent ran and why a fallback happened. The client does not invent them.
  appendAudit: (entries) => set((s) => ({ auditLog: [...s.auditLog, ...entries] })),
  clearAuditLog: () => set({ auditLog: [] }),
  setSelectedCandidateId: (selectedCandidateId) => set({ selectedCandidateId }),
  setError: (error) => set({ error }),
  reset: () => set(initial),
}));
