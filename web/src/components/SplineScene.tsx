import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

// React 19 keeps the JSX namespace under the `react` module, not global, so the
// custom element is registered there.
declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'spline-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & { url?: string };
    }
  }
}

let viewerLoaded: Promise<unknown> | null = null;
function loadViewer(): Promise<unknown> {
  // Load the custom-element bundle once, and only when a scene actually needs
  // it — this is the code that used to come from unpkg at runtime.
  viewerLoaded ??= import('@splinetool/viewer');
  return viewerLoaded;
}

interface Props {
  url: string;
  poster?: ReactNode;
  className?: string;
  /** Above-the-fold scenes load immediately; everything else waits. */
  eager?: boolean;
}

export function SplineScene({ url, poster, className, eager = false }: Props) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [approached, setApproached] = useState(eager);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (approached || reduced) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setApproached(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [approached, reduced]);

  useEffect(() => {
    if (reduced || !approached) return;
    let alive = true;
    void loadViewer().then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [reduced, approached]);

  const showScene = ready && !reduced;

  return (
    <div ref={ref} className={className}>
      {poster}
      {showScene && (
        <spline-viewer
          url={url}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '100%',
            height: '100%',
            transform: 'translate(-50%,-50%) scale(1.1)',
          }}
        />
      )}
    </div>
  );
}
