import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useSessionStore } from '../../store/session';
import { useScreening } from '../../hooks/useScreening';
import { AuditLog } from '../../components/AuditLog';
import { CandidateDetail } from '../../components/CandidateDetail';
import { ErrorBanner } from './ErrorBanner';
import { JobProfileTab } from './JobProfileTab';
import { CandidatesTab } from './CandidatesTab';
import { GapsTab } from './GapsTab';

const TABS = [
  { id: 1, label: '① Stellenprofil' },
  { id: 2, label: '② Bewerbungen' },
  { id: 3, label: '③ Kandidaten' },
  { id: 4, label: '④ Informationslücken' },
  { id: 5, label: '⑤ Rückfragen' },
  { id: 6, label: '⑥ Audit Log' },
];

export function Workspace() {
  const [activeTab, setActiveTab] = useState(1);
  const backendLabel = useSessionStore((s) => s.backendLabel);
  const isLlmActive = useSessionStore((s) => s.isLlmActive);
  const { fetchBackendLabel } = useScreening();

  useEffect(() => {
    void fetchBackendLabel();
  }, [fetchBackendLabel]);

  return (
    <>
      <div className="relative min-h-screen w-full bg-slate-50 pb-20 pt-4">
        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <div className="pb-12 pt-24">
            <div className="mb-4 text-sm font-extrabold uppercase tracking-widest text-indigo-700">
              Recruiting Workspace
            </div>
            <h2 className="mb-4 text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
              Dein Screening-Arbeitsbereich
            </h2>
            <p className="max-w-2xl text-xl leading-relaxed text-slate-700">
              Stellenprofil definieren, Bewerbungen analysieren und Ergebnisse transparent prüfen —
              die Entscheidung bleibt bei dir.
            </p>
          </div>

          {backendLabel !== null && !isLlmActive && (
            <div className="mb-8 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-6 py-4 text-amber-900 shadow-sm backdrop-blur">
              <span className="text-xl" aria-hidden="true">
                ⚠️
              </span>
              <p className="text-sm font-medium">
                <b className="font-bold">Kein LLM aktiv:</b> Die Agenten laufen im regelbasierten
                Sandbox-Modus.
              </p>
            </div>
          )}

          <ErrorBanner />

          <div className="hide-scrollbar mb-8 flex overflow-x-auto border-b border-slate-200">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  '-mb-[1px] whitespace-nowrap border-b-2 px-6 py-4 text-[15px] font-semibold transition-all',
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="min-h-[600px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 1 && <JobProfileTab />}
                {activeTab === 3 && <CandidatesTab />}
                {activeTab === 4 && <GapsTab />}
                {activeTab === 6 && <AuditLog />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
      <CandidateDetail />
    </>
  );
}
