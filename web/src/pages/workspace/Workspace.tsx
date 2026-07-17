import { useEffect } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

export function Workspace() {
  const { t, i18n } = useTranslation();

  const TABS = [
    { slug: 'stellenprofil', label: t('workspace.tab1'), Panel: JobProfileTab },
    { slug: 'bewerbungen', label: t('workspace.tab2'), Panel: UploadTab },
    { slug: 'kandidaten', label: t('workspace.tab3'), Panel: CandidatesTab },
    { slug: 'luecken', label: t('workspace.tab4'), Panel: GapsTab },
    { slug: 'rueckfragen', label: t('workspace.tab5'), Panel: QuestionsTab },
    { slug: 'audit', label: t('workspace.tab6'), Panel: AuditLog },
  ];
  const DEFAULT_SLUG = TABS[0].slug;

  const [params, setParams] = useSearchParams();
  const backendLabel = useSessionStore((s) => s.backendLabel);
  const isLlmActive = useSessionStore((s) => s.isLlmActive);
  const { fetchBackendLabel } = useScreening();

  // Re-fetched on a language change: the label is prose built by the server
  // ("rule-based" / "regelbasiert"), so it goes stale the moment the recruiter
  // switches.
  useEffect(() => {
    void fetchBackendLabel();
  }, [fetchBackendLabel, i18n.language]);

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
              {t('workspace.subtitle')}
            </div>
            <h2 className="mb-4 text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
              {t('workspace.title')}
            </h2>
            <p className="max-w-2xl text-xl leading-relaxed text-slate-700">
              {t('workspace.desc')}
            </p>
          </div>

          {backendLabel !== null && !isLlmActive && (
            <div className="mb-8 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-6 py-4 text-amber-900 shadow-sm backdrop-blur">
              <span className="text-xl" aria-hidden="true">
                ⚠️
              </span>
              <p className="text-sm font-medium">
                <b className="font-bold">{t('workspace.noLlm')}</b> {t('workspace.sandbox')}
              </p>
            </div>
          )}

          <ErrorBanner />

          <Tabs.Root value={active} onValueChange={onValueChange}>
            <Tabs.List
              aria-label={t('workspace.tabsAria')}
              className="hide-scrollbar -mx-6 mb-8 flex snap-x snap-mandatory overflow-x-auto border-b border-slate-200 px-6 sm:mx-0 sm:snap-none sm:px-0"
            >
              {TABS.map((tab) => (
                <Tabs.Trigger
                  key={tab.slug}
                  value={tab.slug}
                  className={cn(
                    'snap-start -mb-[1px] whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-all sm:px-6 sm:py-4 sm:text-[15px]',
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
