import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSessionStore } from '../../store/session';
import { useScreening } from '../../hooks/useScreening';

export function JobProfileTab() {
  const jobText = useSessionStore((s) => s.jobText);
  const setJobText = useSessionStore((s) => s.setJobText);
  const requirements = useSessionStore((s) => s.requirements);
  const { parseJob } = useScreening();
  const [isPending, setIsPending] = useState(false);

  const handleParse = async () => {
    setIsPending(true);
    try {
      await parseJob();
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h2 className="mb-2 text-2xl font-bold text-slate-900">Stellenprofil definieren</h2>
        <p className="text-slate-600">
          Füge die Anforderungen der Stelle ein, um sie von der KI strukturieren zu lassen.
        </p>
      </div>

      <textarea
        value={jobText}
        onChange={(e) => setJobText(e.target.value)}
        placeholder="Fügen Sie hier die Stellenbeschreibung ein..."
        aria-label="Stellenbeschreibung"
        className="mb-6 h-64 w-full resize-y rounded-2xl border border-slate-200 bg-white/80 p-5 font-medium text-slate-700 shadow-sm backdrop-blur transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
      />

      <Button
        onClick={handleParse}
        disabled={isPending || !jobText.trim()}
        size="lg"
        className="rounded-xl border-0 bg-gradient-to-r from-indigo-600 to-blue-600 px-8 text-base font-bold text-white shadow-lg shadow-indigo-200 hover:from-indigo-500 hover:to-blue-500"
      >
        {isPending ? 'Analysiere...' : '✨ Profil analysieren'}
      </Button>

      {requirements.length > 0 && (
        <div className="mt-12">
          <h3 className="mb-6 flex items-center gap-2 text-xl font-bold text-slate-900">
            <CheckCircle className="text-emerald-500" size={24} /> Extrahierte Anforderungen
          </h3>
          <div className="flex flex-col gap-3">
            {requirements.map((req) => (
              <Card key={req.id} className="rounded-xl border-slate-200/60 bg-white shadow-sm">
                <CardContent className="flex items-center justify-between gap-4 p-5">
                  <div className="text-slate-700">
                    <strong className="font-bold text-slate-900">{req.label}</strong>
                    <span className="ml-2 text-sm text-slate-500">{String(req.value)}</span>
                  </div>
                  <Badge
                    className={cn(
                      'whitespace-nowrap rounded-lg px-3 py-1 font-bold shadow-none',
                      req.importance === 'muss'
                        ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100'
                        : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
                    )}
                  >
                    {req.importance === 'muss' ? 'Muss' : 'Kann'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
