import { GasStation } from '../types';
import { formatAgeShort, parseAgeMinutes } from './stationFreshness';

/**
 * What a station's own staff can tell drivers: "we are selling now / not selling" and the pump
 * pressure. This is a separate signal from driver reports: it never changes the pin colour, the
 * ranking, the Reports tab or any driver's points.
 */

/** A selling / not-selling post shows for this long, then disappears. */
export const SELLING_STATEMENT_MINUTES = 120;
/** A live pressure reading shows (with its age) for this long, then the admin's fixed value shows. */
export const LIVE_PRESSURE_MAX_AGE_MINUTES = 720;

export const PRESSURE_MIN_BAR = 10;
export const PRESSURE_MAX_BAR = 300;
export const PRESSURE_STEP_BAR = 5;
export const PRESSURE_DEFAULT_BAR = 200;

/** A whole number of bar inside the range a pump can really show. */
export function isValidPressure(bar: unknown): bar is number {
  return typeof bar === 'number' && Number.isInteger(bar) && bar >= PRESSURE_MIN_BAR && bar <= PRESSURE_MAX_BAR;
}

/** One tap of the + or − button: moves by 5 from the last value (or 200) and stays inside 10..300. */
export function stepPressure(current: number | null | undefined, direction: 1 | -1): number {
  const from = typeof current === 'number' && Number.isFinite(current) ? current : PRESSURE_DEFAULT_BAR;
  const next = from + direction * PRESSURE_STEP_BAR;
  return Math.min(PRESSURE_MAX_BAR, Math.max(PRESSURE_MIN_BAR, next));
}

export interface SellingStatement {
  selling: boolean;
  ageMinutes: number;
}

/** The station's current "selling now / not selling" post, or null when none is current. */
export function getSellingStatement(
  station: Pick<GasStation, 'managerSelling' | 'managerSellingAt'>,
  now = Date.now(),
): SellingStatement | null {
  if (typeof station.managerSelling !== 'boolean') return null;
  const age = parseAgeMinutes(station.managerSellingAt, now);
  if (age === null || age > SELLING_STATEMENT_MINUTES) return null;
  return { selling: station.managerSelling, ageMinutes: age };
}

export function describeSelling(statement: SellingStatement): string {
  return `${statement.selling ? 'Selling now' : 'Not selling'} · updated ${formatAgeShort(statement.ageMinutes)}`;
}

export interface PressureReading {
  bar: number;
  /** Minutes since the manager's reading; null for the admin's fixed value. */
  ageMinutes: number | null;
  live: boolean;
}

/** The manager's recent reading, else the admin's fixed value, else nothing. */
export function getPressureReading(
  station: Pick<GasStation, 'pumpPressure' | 'livePressureBar' | 'livePressureAt'>,
  now = Date.now(),
): PressureReading | null {
  if (isValidPressure(station.livePressureBar)) {
    const age = parseAgeMinutes(station.livePressureAt, now);
    if (age !== null && age <= LIVE_PRESSURE_MAX_AGE_MINUTES) {
      return { bar: station.livePressureBar, ageMinutes: age, live: true };
    }
  }
  if (station.pumpPressure && station.pumpPressure > 0) {
    return { bar: station.pumpPressure, ageMinutes: null, live: false };
  }
  return null;
}

/** "220 bar · updated 2 hr ago", "180 bar" for the fixed value, or null when there is none. */
export function describePressure(
  station: Pick<GasStation, 'pumpPressure' | 'livePressureBar' | 'livePressureAt'>,
  now = Date.now(),
): string | null {
  const reading = getPressureReading(station, now);
  if (!reading) return null;
  return reading.ageMinutes === null
    ? `${reading.bar} bar`
    : `${reading.bar} bar · updated ${formatAgeShort(reading.ageMinutes)}`;
}
