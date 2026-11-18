import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { formatAgeShort, parseAgeMinutes } from '../../utils/stationFreshness';
import {
  PRESSURE_DEFAULT_BAR,
  PRESSURE_MAX_BAR,
  PRESSURE_MIN_BAR,
  SELLING_STATEMENT_MINUTES,
  getSellingStatement,
  isValidPressure,
  stepPressure,
} from '../../utils/stationManagerSignals';
import { postPressure, postSelling, ManagerPostResult, RpcClient } from '../../services/stationManagerService';

interface Props {
  stationId: string;
  managerSelling: boolean | null;
  managerSellingAt: string | null;
  livePressureBar: number | null;
  livePressureAt: string | null;
  pumpPressure: number | null;
  flash: (m: string) => void;
  /** Called after a successful post so the parent can reload the station from the database. */
  onPosted: () => void;
}

type Pending = 'selling' | 'not-selling' | 'pressure' | null;

const startingPressure = (live: number | null, pump: number | null): number => {
  if (isValidPressure(live)) return live;
  if (isValidPressure(pump)) return pump;
  return PRESSURE_DEFAULT_BAR;
};

/**
 * The manager's quick card: "Selling now / Not selling" and the pump pressure, each posted in
 * a tap or two. These posts are shown to drivers as "Station says" and never change the
 * driver-reported status, so there is nothing here about queue or availability.
 */
export const StationQuickUpdate: React.FC<Props> = ({
  stationId,
  managerSelling,
  managerSellingAt,
  livePressureBar,
  livePressureAt,
  pumpPressure,
  flash,
  onPosted,
}) => {
  const supabase = useSupabaseClient();
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [pressure, setPressure] = useState(() => startingPressure(livePressureBar, pumpPressure));

  const statement = getSellingStatement({
    managerSelling: managerSelling ?? undefined,
    managerSellingAt: managerSellingAt ?? undefined,
  });
  const pressureAge = parseAgeMinutes(livePressureAt);

  const run = async (kind: Exclude<Pending, null>, action: () => Promise<ManagerPostResult>, done: string) => {
    if (pending || !supabase) return;
    setPending(kind);
    setError(null);
    const result = await action();
    setPending(null);
    if (result.ok) {
      flash(done);
      onPosted();
    } else {
      setError(result.error);
    }
  };

  const client = supabase as unknown as RpcClient | null;

  const btnBase =
    'flex-1 min-h-[44px] rounded-md text-sm font-bold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-adm-line pt-3">
      <div>
        <p className="text-xs font-bold text-adm-mute-text uppercase tracking-wide">Station status</p>
        <div className="mt-1.5 flex gap-2">
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => client && void run('selling', () => postSelling(client, stationId, true), 'Posted: Selling now')}
            className={`${btnBase} ${
              statement?.selling
                ? 'bg-adm-foil border-adm-note text-adm-ink'
                : 'bg-adm-card border-adm-line text-adm-ink hover:border-adm-note'
            }`}
          >
            {pending === 'selling' ? 'Posting…' : 'Selling now'}
          </button>
          <button
            type="button"
            disabled={pending !== null}
            onClick={() =>
              client && void run('not-selling', () => postSelling(client, stationId, false), 'Posted: Not selling')
            }
            className={`${btnBase} ${
              statement && !statement.selling
                ? 'bg-adm-note border-adm-note text-white'
                : 'bg-adm-card border-adm-line text-adm-ink hover:border-adm-note'
            }`}
          >
            {pending === 'not-selling' ? 'Posting…' : 'Not selling'}
          </button>
        </div>
        <p className="text-xs text-adm-mute-text mt-1.5">
          {statement
            ? `Posted ${formatAgeShort(statement.ageMinutes)} · drivers see it for ${SELLING_STATEMENT_MINUTES / 60} hours`
            : 'Nothing posted right now. Drivers see a post for 2 hours.'}
        </p>
      </div>

      <div>
        <p className="text-xs font-bold text-adm-mute-text uppercase tracking-wide">Gas pressure</p>
        <div className="mt-1.5 flex items-center gap-2">
          <button
            type="button"
            aria-label="Lower pressure by 5 bar"
            disabled={pending !== null || pressure <= PRESSURE_MIN_BAR}
            onClick={() => setPressure((p) => stepPressure(p, -1))}
            className="w-11 h-11 rounded-md border border-adm-line bg-adm-card text-adm-ink flex items-center justify-center disabled:opacity-40"
          >
            <Minus className="size-5" aria-hidden="true" />
          </button>
          <p className="flex-1 text-center font-bold text-adm-ink text-lg tabular-nums" aria-live="polite">
            {pressure} <span className="text-sm font-bold text-adm-mute-text">bar</span>
          </p>
          <button
            type="button"
            aria-label="Raise pressure by 5 bar"
            disabled={pending !== null || pressure >= PRESSURE_MAX_BAR}
            onClick={() => setPressure((p) => stepPressure(p, 1))}
            className="w-11 h-11 rounded-md border border-adm-line bg-adm-card text-adm-ink flex items-center justify-center disabled:opacity-40"
          >
            <Plus className="size-5" aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() =>
            client && void run('pressure', () => postPressure(client, stationId, pressure), `Posted: ${pressure} bar`)
          }
          className="mt-2 w-full min-h-[44px] rounded-md bg-adm-foil text-adm-ink text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending === 'pressure' ? 'Posting…' : 'Update pressure'}
        </button>
        <p className="text-xs text-adm-mute-text mt-1.5">
          {pressureAge !== null && isValidPressure(livePressureBar)
            ? `Last reading ${livePressureBar} bar · updated ${formatAgeShort(pressureAge)}`
            : 'No reading posted yet.'}
        </p>
      </div>

      {error && (
        <p role="alert" className="text-xs font-semibold text-adm-danger">
          {error}
        </p>
      )}
    </div>
  );
};
