import { useState, type DragEvent, type ChangeEvent } from 'react';
import { FileText, Play, Upload, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useSessionStore } from '../../store/session';
import { useScreening } from '../../hooks/useScreening';

const ACCEPT = '.txt,.pdf';

export function UploadTab() {
  const { t } = useTranslation();
  const candidates = useSessionStore((s) => s.candidates);
  const requirements = useSessionStore((s) => s.requirements);
  const isAnalyzing = useSessionStore((s) => s.isAnalyzing);
  const removeCandidate = useSessionStore((s) => s.removeCandidate);
  const { uploadFiles, runAnalysis, loadDemo } = useScreening();

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files || !files.length) return;
    setIsUploading(true);
    try {
      await uploadFiles(Array.from(files));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    void handleFiles(e.dataTransfer?.files ?? null);
  };

  const handleDemo = async () => {
    setIsLoadingDemo(true);
    try {
      await loadDemo();
    } finally {
      setIsLoadingDemo(false);
    }
  };

  const canAnalyse = candidates.length > 0 && requirements.length > 0 && !isAnalyzing;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h2 className="mb-2 text-2xl font-bold text-slate-900">{t('upload.title')}</h2>
        <p className="text-slate-600">{t('upload.desc')}</p>
      </div>

      <div
        data-testid="dropzone"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'mb-6 rounded-3xl border-2 border-dashed p-12 text-center transition-colors',
          isDragging
            ? 'border-indigo-500 bg-indigo-50/60'
            : 'border-indigo-200/80 bg-white/40 backdrop-blur',
        )}
      >
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
          <Upload size={32} className="text-indigo-600" aria-hidden="true" />
        </div>
        <p className="mb-2 text-xl font-bold text-slate-900">{t('upload.dragDrop')}</p>
        <p className="mb-8 font-medium text-slate-500">
          {t('upload.pdfOrText')}
        </p>

        {/* sr-only, not hidden: display:none would make this unreachable by keyboard. */}
        <label
          htmlFor="cv-upload"
          className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-4 font-bold text-white shadow-xl shadow-indigo-200 transition-transform hover:scale-105 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2"
        >
          {isUploading ? t('upload.processing') : t('upload.browse')}
          <input
            id="cv-upload"
            type="file"
            multiple
            accept={ACCEPT}
            aria-label="Dateien auswählen"
            disabled={isUploading}
            onChange={(e: ChangeEvent<HTMLInputElement>) => void handleFiles(e.target.files)}
            className="sr-only"
          />
        </label>
      </div>

      <div className="mb-10 text-center">
        <Button
          variant="outline"
          onClick={handleDemo}
          disabled={isLoadingDemo}
          className="rounded-xl border-slate-200 bg-white font-semibold text-slate-700"
        >
          {isLoadingDemo ? t('upload.loading') : t('upload.demoData')}
        </Button>
      </div>

      {candidates.length > 0 && (
        <>
          <h3 className="mb-4 text-xl font-bold text-slate-900">
            {t('upload.currentCandidates')} ({candidates.length})
          </h3>
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {candidates.map((c) => (
              <Card key={c.id} className="rounded-xl border-slate-200/60 bg-white shadow-sm">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                    <FileText size={20} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate font-semibold text-slate-900">{c.name}</strong>
                    <span className="block truncate text-xs text-slate-500">{c.source}</span>
                  </div>
                  <button
                    onClick={() => removeCandidate(c.id)}
                    aria-label={`${c.name} entfernen`}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <X size={16} />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>

          {!requirements.length && (
            <p className="mb-4 text-sm font-medium text-amber-700">
              {t('upload.analyzeFirst')}
            </p>
          )}

          <Button
            onClick={() => void runAnalysis()}
            disabled={!canAnalyse}
            size="lg"
            className="flex items-center gap-2 rounded-xl border-0 bg-gradient-to-r from-indigo-600 to-blue-600 px-8 text-base font-bold text-white shadow-lg shadow-indigo-200 hover:from-indigo-500 hover:to-blue-500"
          >
            <Play size={18} fill="currentColor" aria-hidden="true" />
            {isAnalyzing ? t('upload.analyzing') : t('upload.startAnalysis')}
          </Button>
        </>
      )}
    </div>
  );
}
