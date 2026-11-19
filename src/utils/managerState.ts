import { GasStation } from '../types';
import { formatAgeShort, parseAgeMinutes } from './stationFreshness';

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

/** The three buttons on the manager's card, in the order they appear. */
export const MANAGER_STATE_OPTIONS: { state: ManagerState; label: string }[] = [
  { state: 'closed', label: 'Closed' },
  { state: 'open', label: 'Open, waiting for gas' },
  { state: 'selling', label: 'Open, gas available' },
];

export interface ManagerStatement {
  state: ManagerState;
  ageMinutes: number;
}

type StatementSource = Pick<GasStation, 'managerState' | 'managerStateAt' | 'managerSelling' | 'managerSellingAt'>;

const within = (age: number | null): age is number => age !== null && age <= MANAGER_STATE_MINUTES;

/**
 * The station's current manager status, or null when there is none. Uses the three-state fields; for a
 * station that only has the older "selling" flag (posted from a phone or screen that has not updated),
 * true reads as selling and false as closed.
 */
export function getManagerStatement(station: StatementSource, now = Date.now()): ManagerStatement | null {
  if (station.managerState) {
    const age = parseAgeMinutes(station.managerStateAt, now);
    return within(age) ? { state: station.managerState, ageMinutes: age } : null;
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

/** The sentence a driver reads on the station page, with how long ago the manager said it. */
export function describeManagerState(statement: ManagerStatement): string {
  return `${SENTENCE[statement.state]} · updated ${formatAgeShort(statement.ageMinutes)}`;
}
