import { useState } from 'react';
import { Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiClient, type EmailOut } from '../../api/client';
import { useSessionStore } from '../../store/session';

export function QuestionsTab() {
  const { t } = useTranslation();
  const analyses = useSessionStore((s) => s.analyses);
  const setError = useSessionStore((s) => s.setError);
  const [drafts, setDrafts] = useState<Record<string, EmailOut>>({});
  const [pending, setPending] = useState<string | null>(null);

  if (!analyses.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-100/50 p-6 text-center font-medium text-slate-500">
        {t('questions.noAnalysis')}
      </div>
    );
  }

  const handleDraft = async (id: string) => {
    const analysis = analyses.find((a) => a.candidate.id === id);
    if (!analysis) return;
    setPending(id);
    try {
      const draft = await apiClient.draftEmail({
        candidate: analysis.candidate,
        questions: analysis.candidate.questions,
      });
      setDrafts((d) => ({ ...d, [id]: draft }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('questions.draftFailed'));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h2 className="mb-2 text-2xl font-bold text-slate-900">{t('questions.title')}</h2>
        <p className="text-slate-600">{t('questions.desc')}</p>
      </div>

      <div className="flex flex-col gap-8">
        {analyses.map(({ candidate }) => {
          const draft = drafts[candidate.id];
          return (
            <Card
              key={candidate.id}
              className="overflow-hidden rounded-2xl border-slate-200/60 bg-white shadow-md"
            >
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-6 py-4">
                <h3 className="text-lg font-bold text-slate-900">{candidate.name}</h3>
              </div>
              <CardContent className="p-6">
                {candidate.questions.length ? (
                  <div className="mb-8">
                    <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-indigo-700">
                      {t('questions.suggested')}
                    </h4>
                    <ul className="space-y-2">
                      {candidate.questions.map((q, i) => (
                        <li
                          key={`${candidate.id}-q-${i}`}
                          className="flex gap-2 font-medium text-slate-700"
                        >
                          <span className="font-bold text-indigo-400" aria-hidden="true">
                            •
                          </span>
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mb-8 italic text-slate-500">{t('questions.noOpen')}</p>
                )}

                {!draft ? (
                  <Button
                    onClick={() => void handleDraft(candidate.id)}
                    disabled={pending === candidate.id || !candidate.questions.length}
                    className="rounded-xl bg-slate-900 font-semibold text-white shadow-md hover:bg-slate-800"
                  >
                    {pending === candidate.id
                      ? t('questions.drafting')
                      : t('questions.createDraft')}
                  </Button>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
                    <h4 className="mb-4 flex items-center gap-2 font-bold text-slate-900">
                      <Mail className="text-slate-400" size={18} aria-hidden="true" />{' '}
                      {t('questions.draftPreview')}
                    </h4>
                    <p className="mb-2 text-sm text-slate-500">
                      <strong>{t('questions.to')}</strong> {draft.to} &middot;{' '}
                      <strong>{t('questions.subject')}</strong> {draft.subject}
                    </p>
                    <pre className="mb-6 whitespace-pre-wrap rounded-lg border border-slate-100 bg-white p-4 font-sans text-sm leading-relaxed text-slate-600 shadow-sm">
                      {draft.body}
                    </pre>
                    <Button
                      asChild
                      className="rounded-xl bg-slate-900 font-semibold text-white shadow-md hover:bg-slate-800"
                    >
                      <a
                        href={`mailto:${encodeURIComponent(draft.to)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}
                      >
                        {t('questions.openInMail')}
                      </a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
