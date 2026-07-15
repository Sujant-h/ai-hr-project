import { create } from 'zustand';
import type { components } from '../api/types';

type CandidateAnalysis = components['schemas']['CandidateAnalysis'];
type JobRequirement = components['schemas']['JobRequirement'];
type PipelineResult = components['schemas']['PipelineResult'];

export interface AuditLogEntry {
  timestamp: string;
  agent: string;
  action: string;
  detail: string;
}

interface SessionState {
  hasSeenIntro: boolean;
  activeBackend: 'Rule-Based Sandbox' | 'LLM Intelligence';
  
  jobProfile: {
    rawText: string;
    parsedProfile: {
      requirements?: JobRequirement[];
      [key: string]: any;
    } | null;
  };
  
  candidates: Array<{
    filename: string;
    content: string;
  }>;
  
  analysisResult: PipelineResult | null;
  isAnalyzing: boolean;
  
  auditLog: AuditLogEntry[];
  selectedCandidateId: string | null;

  setHasSeenIntro: (seen: boolean) => void;
  setActiveBackend: (backend: 'Rule-Based Sandbox' | 'LLM Intelligence') => void;
  
  setJobProfileText: (text: string) => void;
  setParsedJobProfile: (profile: any) => void;
  
  addCandidate: (filename: string, content: string) => void;
  removeCandidate: (filename: string) => void;
  clearCandidates: () => void;
  
  setAnalysisResult: (result: PipelineResult | null) => void;
  setIsAnalyzing: (isAnalyzing: boolean) => void;

  addAuditLogEntry: (agent: string, action: string, detail: string) => void;
  clearAuditLog: () => void;
  setSelectedCandidateId: (id: string | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  hasSeenIntro: false,
  activeBackend: 'Rule-Based Sandbox',
  
  jobProfile: {
    rawText: '',
    parsedProfile: null,
  },
  
  candidates: [],
  
  analysisResult: null,
  isAnalyzing: false,

  auditLog: [],
  selectedCandidateId: null,

  setHasSeenIntro: (seen) => set({ hasSeenIntro: seen }),
  setActiveBackend: (backend) => set({ activeBackend: backend }),
  
  setJobProfileText: (text) => set((state) => ({
    jobProfile: { ...state.jobProfile, rawText: text }
  })),
  setParsedJobProfile: (profile) => set((state) => ({
    jobProfile: { ...state.jobProfile, parsedProfile: profile }
  })),
  
  addCandidate: (filename, content) => set((state) => ({
    candidates: [...state.candidates, { filename, content }]
  })),
  removeCandidate: (filename) => set((state) => ({
    candidates: state.candidates.filter(c => c.filename !== filename)
  })),
  clearCandidates: () => set({ candidates: [] }),
  
  setAnalysisResult: (result) => set({ analysisResult: result }),
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),

  addAuditLogEntry: (agent, action, detail) => set((state) => {
    const timeFormatter = new Intl.DateTimeFormat('de-DE', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3
    });
    const newEntry = {
      timestamp: timeFormatter.format(new Date()),
      agent,
      action,
      detail
    };
    return { auditLog: [...state.auditLog, newEntry] };
  }),
  clearAuditLog: () => set({ auditLog: [] }),
  setSelectedCandidateId: (id) => set({ selectedCandidateId: id }),
}));
