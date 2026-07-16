import { useSessionStore } from '../../store/session';

export function ErrorBanner() {
  const error = useSessionStore((s) => s.error);
  const setError = useSessionStore((s) => s.setError);
  if (!error) return null;

  return (
    <div
      role="alert"
      className="mb-6 flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50/80 px-6 py-4 text-red-900 shadow-sm backdrop-blur"
    >
      <p className="text-sm font-medium">{error}</p>
      <button
        onClick={() => setError(null)}
        className="shrink-0 rounded-lg px-2 py-1 text-sm font-bold text-red-700 hover:bg-red-100"
        aria-label="Fehlermeldung schließen"
      >
        ✕
      </button>
    </div>
  );
}
