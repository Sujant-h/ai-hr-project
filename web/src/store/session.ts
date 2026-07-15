import { create } from 'zustand';
import type { components } from '../api/types';

type CandidateAnalysis = components['schemas']['CandidateAnalysis'];
type JobRequirement = components['schemas']['JobRequirement'];
type PipelineResult = components['schemas']['PipelineResult'];

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

  setHasSeenIntro: (seen: boolean) => void;
  setActiveBackend: (backend: 'Rule-Based Sandbox' | 'LLM Intelligence') => void;
  
  setJobProfileText: (text: string) => void;
  setParsedJobProfile: (profile: any) => void;
  
  addCandidate: (filename: string, content: string) => void;
  removeCandidate: (filename: string) => void;
  clearCandidates: () => void;
  
  setAnalysisResult: (result: PipelineResult | null) => void;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
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
}));
