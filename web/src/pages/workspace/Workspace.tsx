import { useEffect } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useSessionStore } from '../../store/session';
import { useScreening } from '../../hooks/useScreening';
import { AuditLog } from '../../components/AuditLog';
import { CandidateDetail } from '../../components/CandidateDetail';
import { ErrorBanner } from './ErrorBanner';
import { JobProfileTab } from './JobProfileTab';
import { UploadTab } from './UploadTab';
import { CandidatesTab } from './CandidatesTab';
import { GapsTab } from './GapsTab';
import { QuestionsTab } from './QuestionsTab';

const TABS = [
  { slug: 'stellenprofil', label: '① Stellenprofil', Panel: JobProfileTab },
  { slug: 'bewerbungen', label: '② Bewerbungen', Panel: UploadTab },
  { slug: 'kandidaten', label: '③ Kandidaten', Panel: CandidatesTab },
  { slug: 'luecken', label: '④ Informationslücken', Panel: GapsTab },
  { slug: 'rueckfragen', label: '⑤ Rückfragen', Panel: QuestionsTab },
  { slug: 'audit', label: '⑥ Audit Log', Panel: AuditLog },
];
const DEFAULT_SLUG = TABS[0].slug;

export function Workspace() {
  const [params, setParams] = useSearchParams();
  const backendLabel = useSessionStore((s) => s.backendLabel);
  const isLlmActive = useSessionStore((s) => s.isLlmActive);
  const { fetchBackendLabel } = useScreening();

  useEffect(() => {
    void fetchBackendLabel();
  }, [fetchBackendLabel]);

  const requested = params.get('tab');
  const active = TABS.some((t) => t.slug === requested) ? requested! : DEFAULT_SLUG;

  const onValueChange = (slug: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', slug);
        return next;
      },
      { replace: true },
    );
  };

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

          <Tabs.Root value={active} onValueChange={onValueChange}>
            <Tabs.List
              aria-label="Screening-Schritte"
              className="hide-scrollbar mb-8 flex overflow-x-auto border-b border-slate-200"
            >
              {TABS.map((tab) => (
                <Tabs.Trigger
                  key={tab.slug}
                  value={tab.slug}
                  className={cn(
                    '-mb-[1px] whitespace-nowrap border-b-2 px-6 py-4 text-[15px] font-semibold transition-all',
                    'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800',
                    'rounded-t-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
                    'data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700',
                  )}
                >
                  {tab.label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            <div className="min-h-[600px]">
              {TABS.map((tab) => (
                <Tabs.Content
                  key={tab.slug}
                  value={tab.slug}
                  className="animate-in fade-in duration-200 focus-visible:outline-none"
                >
                  <tab.Panel />
                </Tabs.Content>
              ))}
            </div>
          </Tabs.Root>
        </div>
      </div>
      <CandidateDetail />
    </>
  );
}
