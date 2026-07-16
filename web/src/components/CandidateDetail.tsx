import { AnimatePresence, motion } from 'framer-motion';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { cn } from '@/lib/utils';
import { useSessionStore } from '../store/session';
import { STATUS_CLASS, STATUS_LABEL, metCount } from '../lib/status';

export function CandidateDetail() {
  const analyses = useSessionStore((s) => s.analyses);
  const selectedCandidateId = useSessionStore((s) => s.selectedCandidateId);
  const setSelectedCandidateId = useSessionStore((s) => s.setSelectedCandidateId);

  const analysis = analyses.find((a) => a.candidate.id === selectedCandidateId);

  // AnimatePresence must own the condition, or the exit animation never runs —
  // which is the bug the old component had: it returned null above the presence.
  return (
    <AnimatePresence>
      {analysis && (
        <div
          className="fixed inset-0 z-[9999] flex justify-end bg-slate-900/40 backdrop-blur-sm"
          onClick={() => setSelectedCandidateId(null)}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-slate-50 p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="outline"
              onClick={() => setSelectedCandidateId(null)}
              className="mb-8 rounded-xl border-slate-200 bg-white font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
            >
              &larr; Zurück
            </Button>

            <div className="mb-8">
              <div className="mb-2 text-xs font-bold uppercase tracking-widest text-indigo-600">
                Kandidatenprofil
              </div>
              <h2 className="mb-2 text-4xl font-black text-slate-900">{analysis.candidate.name}</h2>
              <p className="text-lg font-medium text-slate-600">
                {metCount(analysis.candidate.matches)}/{analysis.candidate.matches.length}{' '}
                Anforderungen erfüllt &middot; {analysis.candidate.gaps.length} Informationslücke(n)
              </p>
            </div>

            <div className="mb-8 grid grid-cols-2 gap-4">
              <Card className="rounded-2xl border-slate-200/60 bg-white/60 shadow-md backdrop-blur">
                <CardContent className="p-6 text-center">
                  <div className="mb-1 bg-gradient-to-br from-indigo-600 to-blue-500 bg-clip-text text-4xl font-black text-transparent">
                    {analysis.candidate.skills.length}
                  </div>
                  <div className="text-sm font-medium uppercase tracking-wide text-slate-500">
                    Skills erkannt
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-slate-200/60 bg-white/60 shadow-md backdrop-blur">
                <CardContent className="p-6 text-center">
                  <div className="mb-1 bg-gradient-to-br from-blue-500 to-cyan-500 bg-clip-text text-4xl font-black text-transparent">
                    {analysis.candidate.languages.length}
                  </div>
                  <div className="text-sm font-medium uppercase tracking-wide text-slate-500">
                    Sprachen
                  </div>
                </CardContent>
              </Card>
            </div>

            {analysis.candidate.skills.length > 0 && (
              <div className="mb-10 flex flex-wrap gap-2">
                {analysis.candidate.skills.map((skill) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            )}

            <h4 className="mb-4 text-xl font-bold text-slate-900">Qualifikationscheckliste</h4>
            {analysis.candidate.matches.length ? (
              <div className="mb-10 flex flex-col gap-3">
                {analysis.candidate.matches.map((m) => (
                  <Card
                    key={m.requirement_id}
                    className="rounded-xl border-slate-200/60 bg-white shadow-sm"
                  >
                    <CardContent className="flex items-center justify-between gap-4 p-4">
                      <div>
                        <span className="font-bold text-slate-900">{m.label}</span>
                        {m.note && (
                          <span className="ml-2 text-sm text-slate-500">&middot; {m.note}</span>
                        )}
                      </div>
                      <Badge
                        className={cn(
                          'whitespace-nowrap rounded-lg px-3 py-1 font-bold shadow-none',
                          STATUS_CLASS[m.status],
                        )}
                      >
                        {STATUS_LABEL[m.status]}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="mb-10 italic text-slate-500">
                Keine Anforderungen zum Abgleich gefunden.
              </p>
            )}

            <div className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-6 text-sm text-indigo-900">
              ⚖️ <strong className="font-bold">Human-in-the-Loop:</strong> Diese Ansicht zeigt nur
              extrahierte Daten &mdash; keine Bewertung, keine Empfehlung. Die Entscheidung triffst
              du.
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
