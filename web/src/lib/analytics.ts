// umami custom events. window.umami only exists in production builds (see
// umamiTracker in vite.config.ts) and when the visitor allows tracking, so
// every call is a no-op otherwise. Never pass names, file names or CV text.
type EventData = Record<string, string | number>;

declare global {
  interface Window {
    umami?: { track: (event: string, data?: EventData) => void };
  }
}

export function track(event: string, data?: EventData): void {
  try {
    window.umami?.track(event, data);
  } catch {
    // Analytics must never break the workspace.
  }
}
