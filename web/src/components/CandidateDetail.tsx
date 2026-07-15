import React from 'react';
import { useSessionStore } from '../store/session';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export const CandidateDetail: React.FC = () => {
  const { candidates, analysisResult, selectedCandidateId, setSelectedCandidateId } = useSessionStore();

  if (!selectedCandidateId) return null;

  const result = analysisResult?.candidate_results?.find((r: any) => r.filename === selectedCandidateId);
  
  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex justify-end" onClick={() => setSelectedCandidateId(null)}>
        <motion.div 
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-full max-w-2xl h-full bg-slate-50 shadow-2xl p-8 overflow-y-auto border-l border-slate-200" 
          onClick={e => e.stopPropagation()}
        >
          <Button variant="outline" onClick={() => setSelectedCandidateId(null)} className="mb-8 rounded-xl font-semibold text-slate-700 bg-white shadow-sm border-slate-200 hover:bg-slate-50 hover:text-slate-900">
            &larr; Zurück
          </Button>
          
          <div className="mb-8">
            <div className="text-xs font-bold tracking-widest text-indigo-600 uppercase mb-2">Kandidatenprofil</div>
            <h2 className="text-4xl font-black text-slate-900 mb-2">👤 {selectedCandidateId}</h2>
            {!result ? (
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6 text-indigo-800 font-medium mt-6">
                Noch kein Abgleich für diese:n Kandidat:in durchgeführt.
              </div>
            ) : (
              <p className="text-slate-600 font-medium text-lg">
                {result.matches?.filter((m: any) => m.status === 'erfuellt').length || 0}/{result.matches?.length || 0} Anforderungen erfüllt &middot; {result.gaps?.length || 0} Informationslücke(n)
              </p>
            )}
          </div>

          {result && (
            <>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <Card className="bg-white/60 backdrop-blur border-slate-200/60 shadow-md rounded-2xl">
                  <CardContent className="p-6 text-center">
                    <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 to-blue-500 mb-1">{result.extracted_profile?.skills?.length || 0}</div>
                    <div className="text-slate-500 font-medium text-sm uppercase tracking-wide">Skills erkannt</div>
                  </CardContent>
                </Card>
                <Card className="bg-white/60 backdrop-blur border-slate-200/60 shadow-md rounded-2xl">
                  <CardContent className="p-6 text-center">
                    <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-500 to-cyan-500 mb-1">{result.extracted_profile?.languages?.length || 0}</div>
                    <div className="text-slate-500 font-medium text-sm uppercase tracking-wide">Sprachen</div>
                  </CardContent>
                </Card>
              </div>

              {result.extracted_profile?.skills && result.extracted_profile.skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-10">
                  {result.extracted_profile.skills.map((s: string, i: number) => (
                    <Badge key={i} variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg px-3 py-1.5 text-sm font-semibold">{s}</Badge>
                  ))}
                </div>
              )}

              <h4 className="text-xl font-bold text-slate-900 mb-4">Qualifikationscheckliste</h4>
              {result.matches && result.matches.length > 0 ? (
                <div className="flex flex-col gap-3 mb-10">
                  {result.matches.map((m: any, i: number) => {
                    const isMatch = m.status === 'erfuellt';
                    const isPart = m.status === 'teilweise';
                    return (
                      <Card key={i} className="rounded-xl border-slate-200/60 shadow-sm bg-white">
                        <CardContent className="p-4 flex justify-between items-center gap-4">
                          <div>
                            <span className="font-bold text-slate-900">{m.requirement}</span>
                            <span className="text-slate-500 text-sm ml-2">&middot; {m.note}</span>
                          </div>
                          <Badge className={cn("whitespace-nowrap px-3 py-1 shadow-none font-bold rounded-lg", 
                            isMatch ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : 
                            isPart ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : 
                            "bg-red-100 text-red-800 hover:bg-red-100"
                          )}>
                            {isMatch ? 'Erfüllt' : (isPart ? 'Teilweise' : 'Nicht erfüllt')}
                          </Badge>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <p className="text-slate-500 mb-10 italic">Keine Anforderungen zum Abgleich gefunden.</p>
              )}

              {result.gaps && result.gaps.length > 0 && (
                <div className="mb-10">
                  <h4 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">🧩 Informationslücken</h4>
                  <ul className="space-y-3">
                    {result.gaps.map((g: any, i: number) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-amber-500 font-bold">•</span>
                        <span><strong className="text-slate-900 font-bold">{g.requirement}</strong> <span className="text-slate-600">&mdash; {g.description}</span></span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.questions && result.questions.length > 0 && (
                <div className="mb-10">
                  <h4 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">💬 Vorgeschlagene Rückfragen</h4>
                  <ul className="space-y-3">
                    {result.questions.map((q: string, i: number) => (
                      <li key={i} className="flex gap-2 text-slate-700 font-medium">
                        <span className="text-indigo-500 font-bold">•</span>
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6 text-indigo-900 text-sm mt-8">
                ⚖️ <strong className="font-bold">Human-in-the-Loop:</strong> Diese Ansicht zeigt nur extrahierte Daten &mdash; keine Bewertung, keine Empfehlung. Die Entscheidung triffst du.
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
