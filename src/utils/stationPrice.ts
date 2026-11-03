import { GasStation } from '../types';
import { formatAgeShort, parseAgeMinutes } from './stationFreshness';

// What a driver pays per kg of CNG, as reported by other drivers at the pump. Prices move far
// more slowly than queues, so a report stays useful for a week, but its age is always shown:
// a driver can judge "₦230/kg · 2 hr ago" and "₦230/kg · 5 days ago" for themselves.

/** Up to this age a price is shown bare on compact surfaces; older ones carry their age. */
export const PRICE_BARE_MAX_AGE_MIN = 24 * 60;
/** A price older than this is not shown at all. */
export const PRICE_MAX_AGE_MIN = 7 * 24 * 60;
/** Bounds for a plausible naira-per-kg price; anything outside is a typo, not a price. */
export const PRICE_MIN_NAIRA = 50;
export const PRICE_MAX_NAIRA = 2000;

export function isPlausiblePrice(value: number): boolean {
  return Number.isFinite(value) && value >= PRICE_MIN_NAIRA && value <= PRICE_MAX_NAIRA;
}

/** "₦230/kg" — whole naira when the price is whole, one decimal otherwise. */
export function formatNairaPerKg(price: number): string {
  const text = Number.isInteger(price) ? price.toLocaleString('en-NG') : price.toFixed(1);
  return `₦${text}/kg`;
}

export interface ReportedPrice {
  price: number;
  ageMinutes: number;
  /** "₦230/kg" */
  text: string;
  /** "₦230/kg · 2 hr ago" */
  label: string;
  /** For tight spots: the bare price while it is under a day old, otherwise the labelled one. */
  compact: string;
}

/** The newest plausible price in the station's reports, or null if none is recent enough. */
export function latestReportedPrice(station: GasStation, now = Date.now()): ReportedPrice | null {
  let best: { price: number; ageMinutes: number } | null = null;
  for (const report of station.reports || []) {
    const price = report.cngPriceNaira;
    if (price == null || !isPlausiblePrice(price)) continue;
    const ageMinutes = parseAgeMinutes(report.timestamp, now);
    if (ageMinutes == null || ageMinutes > PRICE_MAX_AGE_MIN) continue;
    if (!best || ageMinutes < best.ageMinutes) best = { price, ageMinutes };
  }
  if (!best) return null;
  const text = formatNairaPerKg(best.price);
  const label = `${text} · ${formatAgeShort(best.ageMinutes)}`;
  return { ...best, text, label, compact: best.ageMinutes <= PRICE_BARE_MAX_AGE_MIN ? text : label };
}
