import React from 'react';
import { GasStation, StationStatus } from '../../types';
import { getFreshness, STATUS_SHORT_LABEL } from '../../utils/stationFreshness';

type KnownStatus = Exclude<StationStatus, 'unknown'>;

const TONE: Record<KnownStatus, { chip: string; dot: string; icon: string }> = {
  full: { chip: 'bg-rd-available-container text-rd-on-available-container', dot: 'bg-rd-available', icon: 'check_circle' },
  queue: { chip: 'bg-rd-queuing-container text-rd-on-queuing-container', dot: 'bg-rd-queuing', icon: 'schedule' },
  low: { chip: 'bg-rd-low-container text-rd-on-low-container', dot: 'bg-rd-low', icon: 'speed' },
  out: { chip: 'bg-rd-out-container text-rd-on-out-container', dot: 'bg-rd-out', icon: 'block' },
};

const STALE_CHIP = 'bg-rd-stale-container text-rd-on-stale-container';

/**
 * A station's status, honest about how old it is:
 *   fresh  (<=1h)  tinted chip with a live dot (pulses three times when it appears, then rests)
 *   recent (<=24h) tinted chip with the status icon
 *   stale  (>24h)  grey chip — "Last: Available · 3 days ago" — never a confident colour
 *   none           grey "No report yet"
 */
export const StationStatusChip: React.FC<{ station: GasStation; className?: string; now?: number }> = ({ station, className = '', now }) => {
  const f = getFreshness(station, now);
  const base = `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-micro font-semibold leading-none max-w-full ${className}`;

  if (f.tier === 'none' || !f.lastKnownStatus || f.lastKnownStatus === 'unknown') {
    return (
      <span className={`${base} ${STALE_CHIP}`}>
        <span aria-hidden="true" className="material-symbols-outlined text-[14px] shrink-0">help</span>
        <span className="truncate">No report yet</span>
      </span>
    );
  }

  const label = STATUS_SHORT_LABEL[f.lastKnownStatus];

  if (f.tier === 'stale') {
    return (
      <span className={`${base} ${STALE_CHIP}`}>
        <span aria-hidden="true" className="material-symbols-outlined text-[14px] shrink-0">history</span>
        <span className="flex min-w-0">
          <span className="truncate">Last: {label}</span>
          <span className="shrink-0 whitespace-nowrap">&nbsp;· {f.ageText}</span>
        </span>
      </span>
    );
  }

  const tone = TONE[f.lastKnownStatus];
  return (
    <span className={`${base} ${tone.chip}`}>
      {f.tier === 'fresh' ? (
        <span aria-hidden="true" className="relative flex h-2 w-2 shrink-0">
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-0 live-ping ${tone.dot}`} />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${tone.dot}`} />
        </span>
      ) : (
        <span aria-hidden="true" className="material-symbols-outlined text-[14px] shrink-0">{tone.icon}</span>
      )}
      <span className="flex min-w-0">
        <span className="truncate">
          {f.tier === 'fresh' && <span className="sr-only">Live: </span>}
          {label}
        </span>
        <span className="shrink-0 whitespace-nowrap">&nbsp;· {f.ageText}</span>
      </span>
    </span>
  );
};
