import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function saveDataOn(): boolean {
  const conn = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
  return Boolean(conn?.saveData);
}

/**
 * True when the user asked to reduce motion OR the connection asked to save
 * data. Both mean: do not boot a WebGL scene. One check, an a11y win and a
 * mobile-data win at once.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia(QUERY).matches || saveDataOn();
  });

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const update = () => setReduced(mql.matches || saveDataOn());
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  return reduced;
}
