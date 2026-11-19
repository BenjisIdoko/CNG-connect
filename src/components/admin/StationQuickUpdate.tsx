import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { formatAgeShort, parseAgeMinutes } from '../../utils/stationFreshness';
import {
  PRESSURE_DEFAULT_BAR,
  PRESSURE_MAX_BAR,
  PRESSURE_MIN_BAR,
  isValidPressure,
  stepPressure,
} from '../../utils/stationManagerSignals';
import { MANAGER_STATE_MINUTES, MANAGER_STATE_OPTIONS, ManagerState, getManagerStatement } from '../../utils/managerState';
import { postPressure, ManagerPostResult, RpcClient } from '../../services/stationManagerService';
import { postManagerState } from '../../services/managerAccessService';

interface Props {
  stationId: string;
  managerState: ManagerState | null;
  managerStateAt: string | null;
  /** The older two-state fields, still read so a post from a phone that has not updated shows up. */
  managerSelling: boolean | null;
  managerSellingAt: string | null;
  livePressureBar: number | null;
  livePressureAt: string | null;
  pumpPressure: number | null;
  flash: (m: string) => void;
  /** Called after a successful post so the parent can reload the station from the database. */
  onPosted: () => void;
}

type Pending = ManagerState | 'pressure' | null;

const startingPressure = (live: number | null, pump: number | null): number => {
  if (isValidPressure(live)) return live;
  if (isValidPressure(pump)) return pump;
  return PRESSURE_DEFAULT_BAR;
};

const POSTED_TEXT: Record<ManagerState, string> = {
  closed: 'Posted: Closed',
  open: 'Posted: Open, waiting for gas',
  selling: 'Posted: Open, gas available',
};

/**
 * The manager's quick card: the station's status (Closed, Open and waiting for gas, or Open with gas
 * available) and the pump pressure, each posted in a tap or two. Drivers see these as "Station says";
 * they never change the driver-reported status.
 */
export const StationQuickUpdate: React.FC<Props> = ({
  stationId,
  managerState,
  managerStateAt,
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

  const statement = getManagerStatement({
    managerState: managerState ?? undefined,
    managerStateAt: managerStateAt ?? undefined,
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

  return (
    <div className="mt-3 flex flex-col gap-4 border-t border-adm-line pt-3">
      <div>
        <p className="text-sm font-semibold text-adm-ink">Station status</p>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-3" role="group" aria-label="Station status">
          {MANAGER_STATE_OPTIONS.map((option) => {
            const current = statement?.state === option.state;
            return (
              <button
                key={option.state}
                type="button"
                aria-pressed={current}
                disabled={pending !== null}
                onClick={() => client && void run(option.state, () => postManagerState(client, stationId, option.state), POSTED_TEXT[option.state])}
                className={`min-h-[44px] rounded-md border px-2 text-sm font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-adm-note disabled:cursor-not-allowed disabled:opacity-50 ${
                  current ? 'border-adm-note bg-adm-note text-white' : 'border-adm-line bg-adm-card text-adm-ink hover:border-adm-note'
                }`}
              >
                {pending === option.state ? 'Posting…' : option.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-adm-mute-text">
          {statement
            ? `Posted ${formatAgeShort(statement.ageMinutes)} · drivers see it for ${MANAGER_STATE_MINUTES / 60} hours`
            : `Nothing posted right now. Drivers see a post for ${MANAGER_STATE_MINUTES / 60} hours.`}
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold text-adm-ink">Gas pressure</p>
        <div className="mt-1.5 flex items-center gap-2">
          <button
            type="button"
            aria-label="Lower pressure by 5 bar"
            disabled={pending !== null || pressure <= PRESSURE_MIN_BAR}
            onClick={() => setPressure((p) => stepPressure(p, -1))}
            className="flex size-11 items-center justify-center rounded-md border border-adm-line bg-adm-card text-adm-ink disabled:opacity-40"
          >
            <Minus className="size-5" aria-hidden="true" />
          </button>
          <p className="flex-1 text-center text-lg font-bold text-adm-ink tabular-nums" aria-live="polite">
            {pressure} <span className="text-sm font-bold text-adm-mute-text">bar</span>
          </p>
          <button
            type="button"
            aria-label="Raise pressure by 5 bar"
            disabled={pending !== null || pressure >= PRESSURE_MAX_BAR}
            onClick={() => setPressure((p) => stepPressure(p, 1))}
            className="flex size-11 items-center justify-center rounded-md border border-adm-line bg-adm-card text-adm-ink disabled:opacity-40"
          >
            <Plus className="size-5" aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => client && void run('pressure', () => postPressure(client, stationId, pressure), `Posted: ${pressure} bar`)}
          className="mt-2 min-h-[44px] w-full rounded-md bg-adm-foil text-sm font-bold text-adm-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending === 'pressure' ? 'Posting…' : 'Update pressure'}
        </button>
        <p className="mt-1.5 text-xs text-adm-mute-text">
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
