import { useEffect, useState } from 'react';

// Desktop = a wide viewport driven by a precise pointer (mouse/trackpad).
// Heavy WebGL — the Spline viewer weighs ~4 MB of JS — only boots here.
// Phones and tablets (coarse pointer and/or narrow) get the static poster
// instead, which is the single biggest mobile-performance win on this site.
const QUERY = '(min-width: 1024px) and (pointer: fine)';

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  return isDesktop;
}
