import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSessionStore } from '../../store/session';
import { metCount } from '../../lib/status';

export function CandidatesTab() {
  const analyses = useSessionStore((s) => s.analyses);
  const isAnalyzing = useSessionStore((s) => s.isAnalyzing);
  const setSelectedCandidateId = useSessionStore((s) => s.setSelectedCandidateId);

  if (isAnalyzing) {
    return (
      <div className="flex animate-pulse items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/80 p-6 font-bold text-blue-800">
        <span className="text-xl" aria-hidden="true">
          ⏳
        </span>{' '}
        Die Agenten arbeiten im Hintergrund...
      </div>
    );
  }

  if (!analyses.length) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-6 font-medium text-amber-800">
        Noch keine Analyse durchgeführt. (Gehe zu ② Bewerbungen)
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h2 className="mb-2 text-2xl font-bold text-slate-900">Kandidatenübersicht</h2>
        <p className="text-slate-600">
          Erfüllte Anforderungen je Bewerber. Keine Rangfolge, keine Empfehlung.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {analyses.map(({ candidate, backend, fallback_reason }) => (
          <Card
            key={candidate.id}
            className="flex flex-col rounded-2xl border-slate-200/60 bg-white/80 shadow-md backdrop-blur transition-all hover:-translate-y-1 hover:shadow-xl"
          >
            <CardContent className="flex flex-1 flex-col p-6">
              <div className="mb-4 flex items-start justify-between gap-2">
                <h3 className="truncate text-lg font-bold text-slate-900">{candidate.name}</h3>
                <Badge className="whitespace-nowrap rounded-md bg-indigo-100 px-2 py-0.5 font-bold text-indigo-800 shadow-none hover:bg-indigo-100">
                  {metCount(candidate.matches)}/{candidate.matches.length}
                </Badge>
              </div>

              <p className="mb-2 truncate text-sm text-slate-500">{candidate.source}</p>

              <p className="mb-6 flex-1 text-sm leading-relaxed text-slate-600">
                {candidate.gaps.length
                  ? `${candidate.gaps.length} Informationslücke(n) gefunden.`
                  : 'Keine Informationslücken.'}
              </p>

              <div className="mb-4 flex flex-wrap gap-2">
                <Badge
                  variant="secondary"
                  className="rounded-md bg-slate-100 text-xs font-semibold text-slate-600"
                >
                  {backend}
                </Badge>
                {fallback_reason && (
                  <Badge
                    variant="secondary"
                    className="rounded-md bg-amber-100 text-xs font-semibold text-amber-800"
                    title={fallback_reason}
                  >
                    Fallback
                  </Badge>
                )}
              </div>

              <Button
                variant="outline"
                onClick={() => setSelectedCandidateId(candidate.id)}
                className="mt-auto flex w-full items-center justify-center gap-1 rounded-xl border-slate-200 font-bold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
              >
                Profil ansehen <ChevronRight size={16} />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
