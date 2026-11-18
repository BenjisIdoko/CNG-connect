import React from 'react';
import { GasStation } from '../../types';
import { describePressure, describeSelling, getPressureReading, getSellingStatement } from '../../utils/stationManagerSignals';

interface Props {
  station: GasStation;
  now?: number;
  /** A small badge for list rows: only the selling status, no card and no pressure. */
  compact?: boolean;
}

/**
 * What the station's own staff say: "Selling now / Not selling" and the pump pressure. It is shown
 * apart from the driver-reported status on purpose and never changes it. Renders nothing when the
 * station has no current post.
 */
export const StationSaysLine: React.FC<Props> = ({ station, now, compact = false }) => {
  const statement = getSellingStatement(station, now);
  const reading = getPressureReading(station, now);
  // The admin's fixed value is not something the station "says"; only a live reading counts here.
  const livePressure = reading?.live ? describePressure(station, now) : null;

  if (compact) {
    if (!statement) return null;
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-micro font-semibold leading-none ${
          statement.selling ? 'bg-rd-available-container text-rd-on-available-container' : 'bg-rd-surface ring-1 ring-rd-divider text-rd-text-tertiary'
        }`}
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[14px]">local_gas_station</span>
        <span className="truncate">{statement.selling ? 'Station: selling' : 'Station: not selling'}</span>
      </span>
    );
  }

  if (!statement && !livePressure) return null;

  return (
    <div className="rounded-2xl bg-rd-surface ring-1 ring-rd-divider px-4 py-3 flex items-start gap-3">
      <span aria-hidden="true" className="material-symbols-outlined text-rd-text-tertiary text-[20px] shrink-0 mt-0.5">local_gas_station</span>
      <div className="flex-1 min-w-0">
        <p className="text-caption text-rd-text-tertiary">Station says</p>
        {statement && (
          <p className={`font-geist font-bold text-body-lg leading-snug ${statement.selling ? 'text-rd-on-available-container' : 'text-rd-fg'}`}>
            {describeSelling(statement)}
          </p>
        )}
        {livePressure && (
          <p className="text-caption text-rd-text-tertiary mt-0.5">
            Gas pressure <span className="font-geist font-bold text-rd-fg">{livePressure}</span>
          </p>
        )}
      </div>
    </div>
  );
};
