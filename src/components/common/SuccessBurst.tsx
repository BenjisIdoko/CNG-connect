import React, { useEffect, useState } from 'react';
import type { StationStatus } from '../../types';

const COLORS: Record<string, string> = {
  full: '#288435',
  queue: '#F5A623',
  low: '#D0420C',
  out: '#E5484D',
};

/** Centered "report sent" confirmation: coloured disc pops in, check draws itself, then fades out. */
export const SuccessBurst: React.FC<{ status: StationStatus; onDone: () => void }> = ({ status, onDone }) => {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 950);
    const t2 = setTimeout(onDone, 1200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[130] flex items-center justify-center pointer-events-none ${leaving ? 'burst-out' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className="burst-pop w-24 h-24 rounded-full flex items-center justify-center shadow-[0_16px_40px_rgba(31,41,35,0.3)]"
          style={{ background: COLORS[status] || COLORS.full }}
        >
          <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path className="check-draw" d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </div>
        <span className="bg-deep-teal text-white text-caption font-bold px-4 py-1.5 rounded-full">Report sent</span>
      </div>
    </div>
  );
};
