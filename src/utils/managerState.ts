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
 *   out      gas is not available (a community manager's post)
 */
export type ManagerState = 'closed' | 'open' | 'selling' | 'out';

/** A manager's status shows for this long, then disappears (it always shows its age meanwhile). */
export const MANAGER_STATE_MINUTES = 360;

/**
 * A Closed or Open-waiting post that is past its normal window is not thrown away: for up to 24 hours
 * after it was made it is still shown, marked as what the station "last said". A gas-available post is
 * never kept like this, so an old "gas available" cannot read as if it were current.
 */
const LAST_SAID_MINUTES = 24 * 60;

/** With an expected time, a post stays this long after that time (as "not confirmed"), then disappears. */
const OVERDUE_GRACE_MINUTES = 60;

/** Whatever the expected time, a post is gone 24 hours after it was made. */
const MAX_POST_MINUTES = 24 * 60;

/** The three buttons on the (older) station manager's card, in the order they appear. */
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
  /** True when a Closed / Open-waiting post is past its normal window and is shown as "last said", greyed. */
  lastSaid?: boolean;
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
 * A closed / open post that gave an expected time stays current until 60 minutes after that time (capped
 * at 24 hours after the post) instead of the usual 6 hours; once the time has passed it reads as overdue.
 * After its current window a closed / open post is returned with `lastSaid: true` until 24 hours after it
 * was made. A gas-available post has no such second life.
 */
export function getManagerStatement(station: StatementSource, now = Date.now()): ManagerStatement | null {
  if (station.managerState) {
    const age = parseAgeMinutes(station.managerStateAt, now);
    if (age === null) return null;
    const state = station.managerState;

    if (state === 'selling') return within(age) ? { state: 'selling', ageMinutes: age } : null;

    const postedMs = Date.parse(station.managerStateAt as string);
    const untilMs = station.managerStateUntil ? Date.parse(station.managerStateUntil) : NaN;
    const hasTime = Number.isFinite(untilMs) && untilMs > postedMs;
    const reason = station.managerStateReason ? { reason: station.managerStateReason } : {};

    const current = hasTime
      ? now <= Math.min(untilMs + OVERDUE_GRACE_MINUTES * 60000, postedMs + MAX_POST_MINUTES * 60000)
      : within(age);
    if (current) {
      return { state, ageMinutes: age, ...reason, ...(hasTime ? { untilMs, overdue: now > untilMs } : {}) };
    }
    if (age <= LAST_SAID_MINUTES) {
      return { state, ageMinutes: age, ...reason, ...(hasTime ? { untilMs, overdue: true } : {}), lastSaid: true };
    }
    return null;
  }
  if (typeof station.managerSelling === 'boolean') {
    const age = parseAgeMinutes(station.managerSellingAt, now);
    if (age === null) return null;
    if (station.managerSelling) return within(age) ? { state: 'selling', ageMinutes: age } : null;
    if (within(age)) return { state: 'closed', ageMinutes: age };
    return age <= LAST_SAID_MINUTES ? { state: 'closed', ageMinutes: age, lastSaid: true } : null;
  }
  return null;
}

const SENTENCE: Record<ManagerState, string> = {
  selling: 'Open for business · Gas available',
  open: 'Open · Waiting for gas supply',
  closed: 'Closed',
  out: 'Gas not available',
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

/**
 * The sentence a driver reads on the station page, with how long ago the manager said it. An old post
 * reads "Last said: Closed · 8 hr ago" so it is never taken for a current statement.
 */
export function describeManagerState(statement: ManagerStatement): string {
  if (statement.lastSaid) return `Last said: ${describeManagerStatus(statement)} · ${formatAgeShort(statement.ageMinutes)}`;
  return `${describeManagerStatus(statement)} · updated ${formatAgeShort(statement.ageMinutes)}`;
}

const BADGE_TEXT: Record<ManagerState, string> = {
  selling: 'Station: open, gas available',
  open: 'Station: open, no gas yet',
  closed: 'Station: closed',
  out: 'Station: gas not available',
};

const LAST_SAID_BADGE: Record<ManagerState, string> = {
  selling: 'Station last said: open, gas available',
  open: 'Station last said: open, waiting for gas',
  closed: 'Station last said: closed',
  out: 'Station last said: gas not available',
};

/** The short line for list rows and cards: what the station says, with its expected time when it gave one. */
export function describeManagerBadge(statement: ManagerStatement): string {
  if (statement.lastSaid) return `${LAST_SAID_BADGE[statement.state]} · ${formatAgeShort(statement.ageMinutes)}`;
  const base = BADGE_TEXT[statement.state];
  if (statement.state === 'selling' || statement.untilMs === undefined) return base;
  const time = formatWatTime(statement.untilMs);
  if (statement.overdue) return `${base} · was due ${time}`;
  return statement.state === 'closed' ? `${base} · back ~${time}` : `${base} · ~${time}`;
}
