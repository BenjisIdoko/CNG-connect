import React, { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../utils/haptics';

/** Animates a number from its previous value to the new one (~600 ms, ease-out). */
export const CountUp: React.FC<{
  value: number;
  className?: string;
  duration?: number;
  format?: (n: number) => string;
}> = ({ value, className, duration = 600, format }) => {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    if (prefersReducedMotion() || fromRef.current === value) {
      fromRef.current = value;
      setShown(value);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      fromRef.current = value;
    };
  }, [value, duration]);

  return <span className={className}>{format ? format(shown) : shown}</span>;
};
