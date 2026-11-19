import { GasStation, ManagerStateReason } from '../types';
import { formatAgeShort, parseAgeMinutes } from './stationFreshness';

export type { ManagerStateReason } from '../types';

/**
 * What a station's own staff can tell drivers about the station right now. Separate from the
 * driver-reported status (Available, Queuing, Out of gas): it never changes pin colours, ranking,
 * the Reports tab, points or flags.
 *   closed   the station is not open
 *   open     open for business but waiting for gas supply
 *   selling  open for business and gas is available
 */
export type ManagerState = 'closed' | 'open' | 'selling';

/** A manager's status shows for this long, then disappears (it always shows its age meanwhile). */
export const MANAGER_STATE_MINUTES = 360;

/** With an expected time, a post stays this long after that time (as "not confirmed"), then disappears. */
const OVERDUE_GRACE_MINUTES = 60;

/** Whatever the expected time, a post is gone 24 hours after it was made. */
const MAX_POST_MINUTES = 24 * 60;

/** The three buttons on the manager's card, in the order they appear. */
export const MANAGER_STATE_OPTIONS: { state: ManagerState; label: string }[] = [
  { state: 'closed', label: 'Closed' },
  { state: 'open', label: 'Open, waiting for gas' },
  { state: 'selling', label: 'Open, gas available' },
];

/** The reasons a manager can give for a Closed or waiting post, in the order they appear. */
export const MANAGER_REASON_OPTIONS: { reason: ManagerStateReason; label: string }[] = [
  { reason: 'supply', label: 'Waiting for supply' },
  { reason: 'fault', label: 'Technical fault' },
  { reason: 'power', label: 'No power' },
  { reason: 'other', label: 'Other' },
];

export interface ManagerStatement {
  state: ManagerState;
  ageMinutes: number;
  /** Only on closed / open posts. */
  reason?: ManagerStateReason;
  /** The expected time as epoch milliseconds, only on closed / open posts that gave one. */
  untilMs?: number;
  /** True once the expected time has passed (the post is then shown as "not confirmed"). Set only with `untilMs`. */
  overdue?: boolean;
}

type StatementSource = Pick<
  GasStation,
  'managerState' | 'managerStateAt' | 'managerSelling' | 'managerSellingAt' | 'managerStateReason' | 'managerStateUntil'
>;

const within = (age: number | null): age is number => age !== null && age <= MANAGER_STATE_MINUTES;

/**
 * The station's current manager status, or null when there is none. Uses the three-state fields; for a
 * station that only has the older "selling" flag (posted from a phone or screen that has not updated),
 * true reads as selling and false as closed.
 *
 * A closed / open post that gave an expected time stays until 60 minutes after that time (capped at 24
 * hours after the post) instead of the usual 6 hours; once the time has passed it reads as overdue.
 */
export function getManagerStatement(station: StatementSource, now = Date.now()): ManagerStatement | null {
  if (station.managerState) {
    const age = parseAgeMinutes(station.managerStateAt, now);
    if (age === null) return null;

    if (station.managerState !== 'selling') {
      const postedMs = Date.parse(station.managerStateAt as string);
      const untilMs = station.managerStateUntil ? Date.parse(station.managerStateUntil) : NaN;
      if (Number.isFinite(untilMs) && untilMs > postedMs) {
        const visibleUntil = Math.min(untilMs + OVERDUE_GRACE_MINUTES * 60000, postedMs + MAX_POST_MINUTES * 60000);
        if (now > visibleUntil) return null;
        return {
          state: station.managerState,
          ageMinutes: age,
          ...(station.managerStateReason ? { reason: station.managerStateReason } : {}),
          untilMs,
          overdue: now > untilMs,
        };
      }
      if (!within(age)) return null;
      return {
        state: station.managerState,
        ageMinutes: age,
        ...(station.managerStateReason ? { reason: station.managerStateReason } : {}),
      };
    }

    return within(age) ? { state: 'selling', ageMinutes: age } : null;
  }
  if (typeof station.managerSelling === 'boolean') {
    const age = parseAgeMinutes(station.managerSellingAt, now);
    return within(age) ? { state: station.managerSelling ? 'selling' : 'closed', ageMinutes: age } : null;
  }
  return null;
}

const SENTENCE: Record<ManagerState, string> = {
  selling: 'Open for business · Gas available',
  open: 'Open · Waiting for gas supply',
  closed: 'Closed',
};

const REASON_TEXT: Record<ManagerStateReason, string | null> = {
  supply: 'Waiting for supply',
  fault: 'Technical fault',
  power: 'No power',
  other: null,
};

/** A clock time given as minutes after midnight: "2 pm", "6:30 am", "12 am". */
export function formatClockMinutes(minutesIntoDay: number): string {
  const hours = Math.floor(minutesIntoDay / 60) % 24;
  const minutes = minutesIntoDay % 60;
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const clock = minutes === 0 ? `${hour12}` : `${hour12}:${String(minutes).padStart(2, '0')}`;
  return `${clock} ${hours < 12 ? 'am' : 'pm'}`;
}

/** A moment on the Lagos clock (WAT, UTC+1, no daylight saving): "2 pm", "6:30 am". */
export function formatWatTime(ms: number): string {
  const wat = new Date(ms + 60 * 60000);
  return formatClockMinutes(wat.getUTCHours() * 60 + wat.getUTCMinutes());
}

/** What the station says, without how long ago it said it (for places where an age would go stale). */
export function describeManagerStatus(statement: ManagerStatement): string {
  const parts: string[] = [SENTENCE[statement.state]];
  if (statement.state !== 'selling') {
    // "Open · Waiting for gas supply" already says it, so a supply reason adds nothing there.
    const reason = statement.reason ? REASON_TEXT[statement.reason] : null;
    if (reason && !(statement.state === 'open' && statement.reason === 'supply')) parts.push(reason);
    if (statement.untilMs !== undefined) {
      const time = formatWatTime(statement.untilMs);
      parts.push(statement.overdue ? `Was expected back ${time} · not confirmed` : `expected about ${time}`);
    }
  }
  return parts.join(' · ');
}

/** The sentence a driver reads on the station page, with how long ago the manager said it. */
export function describeManagerState(statement: ManagerStatement): string {
  return `${describeManagerStatus(statement)} · updated ${formatAgeShort(statement.ageMinutes)}`;
}
