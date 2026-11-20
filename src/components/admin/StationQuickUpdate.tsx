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
import {
  MANAGER_REASON_OPTIONS,
  MANAGER_STATE_MINUTES,
  MANAGER_STATE_OPTIONS,
  ManagerState,
  ManagerStateReason,
  formatWatTime,
  getManagerStatement,
} from '../../utils/managerState';
import { buildPostDetails } from '../../utils/managerPostForm';
import { openManagerWhatsAppShare } from '../../utils/shareMessageBuilder';
import { postPressure, ManagerPostResult, RpcClient } from '../../services/stationManagerService';
import { postManagerState } from '../../services/managerAccessService';

interface Props {
  stationId: string;
  /** For the WhatsApp message. */
  stationName: string;
  city: string;
  managerState: ManagerState | null;
  managerStateAt: string | null;
  /** Why a Closed / waiting post is that way, and when the manager expects it to change. */
  managerStateReason: ManagerStateReason | null;
  managerStateUntil: string | null;
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

type Pending = ManagerState | 'pressure' | 'details' | null;

const startingPressure = (live: number | null, pump: number | null): number => {
  if (isValidPressure(live)) return live;
  if (isValidPressure(pump)) return pump;
  return PRESSURE_DEFAULT_BAR;
};

/** What a manager is told about how long drivers see their post. */
function visibilityText(statement: ReturnType<typeof getManagerStatement>): string {
  const hours = MANAGER_STATE_MINUTES / 60;
  if (!statement) {
    return `Nothing posted right now. Drivers see a gas-available post for ${hours} hours; a Closed or waiting post stays up to 24 hours, greyed as "last said" after ${hours}.`;
  }
  const posted = `Posted ${formatAgeShort(statement.ageMinutes)}`;
  if (statement.lastSaid) return `${posted} · drivers now see it as "last said", greyed. Tap a status to post again.`;
  if (statement.untilMs !== undefined) return `${posted} · drivers see it until an hour after the expected time`;
  if (statement.state === 'selling') return `${posted} · drivers see it for ${hours} hours`;
  return `${posted} · drivers see it for ${hours} hours, then greyed as "last said" until 24 hours`;
}

const POSTED_TEXT: Record<ManagerState, string> = {
  closed: 'Posted: Closed',
  open: 'Posted: Open, waiting for gas',
  selling: 'Posted: Open, gas available',
  out: 'Posted: Gas not available',
};

/**
 * The manager's quick card: the station's status (Closed, Open and waiting for gas, or Open with gas
 * available) and the pump pressure, each posted in a tap or two. Drivers see these as "Station says";
 * they never change the driver-reported status.
 */
export const StationQuickUpdate: React.FC<Props> = ({
  stationId,
  stationName,
  city,
  managerState,
  managerStateAt,
  managerStateReason,
  managerStateUntil,
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

  const [reason, setReason] = useState<ManagerStateReason | null>(managerStateReason);
  const [inHours, setInHours] = useState<1 | 2 | 4 | null>(null);
  const [clock, setClock] = useState('');

  const statement = getManagerStatement({
    managerState: managerState ?? undefined,
    managerStateAt: managerStateAt ?? undefined,
    managerStateReason: managerStateReason ?? undefined,
    managerStateUntil: managerStateUntil ?? undefined,
    managerSelling: managerSelling ?? undefined,
    managerSellingAt: managerSellingAt ?? undefined,
  });
  const pressureAge = parseAgeMinutes(livePressureAt);

  const run = async (kind: Exclude<Pending, null>, action: () => Promise<ManagerPostResult>, done: string): Promise<boolean> => {
    if (pending || !supabase) return false;
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
    return result.ok;
  };

  const client = supabase as unknown as RpcClient | null;

  const saveDetails = () => {
    if (!client || !statement || (statement.state !== 'closed' && statement.state !== 'open')) return;
    const built = buildPostDetails({ reason, inHours, clock }, Date.now(), managerStateUntil);
    if (!built.ok) {
      setError(built.error);
      return;
    }
    void run('details', () => postManagerState(client, stationId, statement.state, built.details), 'Posted: details saved').then((saved) => {
      // The chip or time just sent now belongs to the post; leaving it pressed would resend a moved time next save.
      if (saved) {
        setInHours(null);
        setClock('');
      }
    });
  };

  const pickHours = (hours: 1 | 2 | 4) => {
    setInHours((current) => (current === hours ? null : hours));
    setClock('');
  };

  const chip = (pressed: boolean) =>
    `min-h-[44px] rounded-md border px-3 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-adm-note disabled:cursor-not-allowed disabled:opacity-50 ${
      pressed ? 'border-adm-note bg-adm-note text-white' : 'border-adm-line bg-adm-card text-adm-ink hover:border-adm-note'
    }`;

  const expectedLine =
    statement?.untilMs === undefined
      ? null
      : statement.overdue
        ? `Was expected back ${formatWatTime(statement.untilMs)}, not confirmed.`
        : `Expected back about ${formatWatTime(statement.untilMs)}.`;

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
          {visibilityText(statement)}
        </p>
      </div>

      {statement && (statement.state === 'closed' || statement.state === 'open') && (
        <div className="flex flex-col gap-3 rounded-md border border-adm-line p-3">
          <div>
            <p className="text-sm font-semibold text-adm-ink">Why?</p>
            <p className="text-xs text-adm-mute-text">Optional. Drivers read it on the station page.</p>
            <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="Reason">
              {MANAGER_REASON_OPTIONS.map((option) => (
                <button
                  key={option.reason}
                  type="button"
                  aria-pressed={reason === option.reason}
                  disabled={pending !== null}
                  onClick={() => setReason((current) => (current === option.reason ? null : option.reason))}
                  className={chip(reason === option.reason)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-adm-ink">Expected back</p>
            <p className="text-xs text-adm-mute-text">Optional. Lagos time. {expectedLine}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2" role="group" aria-label="Expected back">
              {([1, 2, 4] as const).map((hours) => (
                <button
                  key={hours}
                  type="button"
                  aria-pressed={inHours === hours}
                  disabled={pending !== null}
                  onClick={() => pickHours(hours)}
                  className={chip(inHours === hours)}
                >
                  {hours === 1 ? 'In 1 hour' : `In ${hours} hours`}
                </button>
              ))}
              <label className="flex items-center gap-2 text-sm text-adm-ink">
                <span>Or at</span>
                <input
                  type="time"
                  value={clock}
                  onChange={(e) => {
                    setClock(e.target.value);
                    setInHours(null);
                  }}
                  disabled={pending !== null}
                  className="min-h-[44px] rounded-md border border-adm-line bg-adm-card px-2 text-sm max-md:text-base text-adm-ink outline-none focus-visible:ring-2 focus-visible:ring-adm-note"
                />
              </label>
            </div>
          </div>
          <button
            type="button"
            disabled={pending !== null}
            onClick={saveDetails}
            className="min-h-[44px] w-full rounded-md bg-adm-foil text-sm font-bold text-adm-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending === 'details' ? 'Saving…' : 'Save details'}
          </button>
        </div>
      )}

      <div>
        <button
          type="button"
          disabled={!statement || statement.lastSaid === true}
          onClick={() =>
            statement && openManagerWhatsAppShare({ stationId, name: stationName, city, statement })
          }
          className="min-h-[44px] w-full rounded-md border border-adm-line bg-adm-card text-sm font-bold text-adm-ink outline-none transition-colors hover:border-adm-note focus-visible:ring-2 focus-visible:ring-adm-note disabled:cursor-not-allowed disabled:opacity-50"
        >
          Share update on WhatsApp
        </button>
        <p className="mt-1.5 text-xs text-adm-mute-text">Sends this status to the drivers you message. Post it first.</p>
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
