import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

interface RevealProps {
  children: ReactNode;
  /** Delay before the reveal transition starts, in seconds. */
  delay?: number;
  className?: string;
}

/**
 * Scroll-triggered fade-in. Replaces framer-motion's `whileInView`, which read
 * element geometry on scroll and caused a forced reflow in the Home chunk.
 * IntersectionObserver does the visibility check off the main measurement path,
 * and the reveal itself is a plain CSS opacity/transform transition. Fires once.
 */
export function Reveal({ children, delay = 0, className }: RevealProps) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (reduced) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -100px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <div
      ref={ref}
      className={className}
      style={
        reduced
          ? undefined
          : {
              opacity: shown ? 1 : 0,
              transform: shown ? 'none' : 'translateY(30px)',
              transition: `opacity 0.7s cubic-bezier(0.2,0.8,0.2,1) ${delay}s, transform 0.7s cubic-bezier(0.2,0.8,0.2,1) ${delay}s`,
            }
      }
    >
      {children}
    </div>
  );
}
