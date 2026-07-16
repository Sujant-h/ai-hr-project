import { Card, CardContent } from '@/components/ui/card';
import { useSessionStore } from '../../store/session';

export function GapsTab() {
  const analyses = useSessionStore((s) => s.analyses);

  if (!analyses.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-100/50 p-6 text-center font-medium text-slate-500">
        Noch keine Analyse durchgeführt.
      </div>
    );
  }

  const withGaps = analyses.filter((a) => a.candidate.gaps.length > 0);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h2 className="mb-2 text-2xl font-bold text-slate-900">Informationslücken</h2>
        <p className="text-slate-600">
          Fehlende Informationen aus den Lebensläufen, die für das Matching relevant sind.
        </p>
      </div>

      {!withGaps.length ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-6 text-center font-bold text-emerald-800">
          🎉 Keine Informationslücken gefunden!
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {withGaps.map(({ candidate }) => (
            <Card
              key={candidate.id}
              className="overflow-hidden rounded-2xl border-slate-200/60 bg-white shadow-sm"
            >
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-6 py-4">
                <h3 className="font-bold text-slate-900">{candidate.name}</h3>
              </div>
              <CardContent className="p-6">
                <ul className="space-y-4">
                  {candidate.gaps.map((gap, i) => (
                    <li key={`${candidate.id}-${gap.requirement_label}-${i}`} className="flex gap-3">
                      <span className="mt-1 font-black text-amber-500" aria-hidden="true">
                        •
                      </span>
                      <div>
                        <div className="font-bold text-slate-900">{gap.requirement_label}</div>
                        <div className="mt-1 text-sm text-slate-600">{gap.description}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
