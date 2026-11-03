import { describe, it, expect } from 'vitest';
import { GasStation, DriverReport } from '../types';
import {
  latestReportedPrice, formatNairaPerKg, isPlausiblePrice, PRICE_MAX_AGE_MIN,
} from './stationPrice';

const NOW = Date.parse('2026-10-12T12:00:00.000Z');
const minsAgo = (m: number) => new Date(NOW - m * 60000).toISOString();

const report = (timestamp: string, cngPriceNaira?: number): DriverReport => ({
  id: `r-${timestamp}-${cngPriceNaira}`,
  author: 'A',
  authorAvatar: '',
  verified: false,
  timestamp,
  status: 'full',
  statusLabel: 'full',
  likes: 0,
  cngPriceNaira,
});

const station = (reports: DriverReport[]): GasStation =>
  ({ id: 's1', name: 'Test', status: 'unknown', statusLabel: '', lastUpdated: '', reports }) as GasStation;

describe('reported CNG price', () => {
  it('formats whole naira with a thousands separator and a decimal only when needed', () => {
    expect(formatNairaPerKg(230)).toBe('₦230/kg');
    expect(formatNairaPerKg(1200)).toBe('₦1,200/kg');
    expect(formatNairaPerKg(230.5)).toBe('₦230.5/kg');
  });

  it('has nothing to show when no report carries a price', () => {
    expect(latestReportedPrice(station([report(minsAgo(5))]), NOW)).toBeNull();
    expect(latestReportedPrice(station([]), NOW)).toBeNull();
  });

  it('takes the newest priced report, not the newest report', () => {
    const s = station([report(minsAgo(5)), report(minsAgo(90), 230), report(minsAgo(300), 250)]);
    const p = latestReportedPrice(s, NOW);
    expect(p?.price).toBe(230);
    expect(p?.label).toBe('₦230/kg · 1 hr ago');
  });

  it('is not order-dependent', () => {
    const s = station([report(minsAgo(300), 250), report(minsAgo(90), 230)]);
    expect(latestReportedPrice(s, NOW)?.price).toBe(230);
  });

  it('shows the bare price on compact surfaces only while it is under a day old', () => {
    expect(latestReportedPrice(station([report(minsAgo(23 * 60), 230)]), NOW)?.compact).toBe('₦230/kg');
    expect(latestReportedPrice(station([report(minsAgo(72 * 60), 230)]), NOW)?.compact).toBe('₦230/kg · 3 days ago');
  });

  it('drops a price older than a week', () => {
    expect(latestReportedPrice(station([report(minsAgo(PRICE_MAX_AGE_MIN + 1), 230)]), NOW)).toBeNull();
    expect(latestReportedPrice(station([report(minsAgo(PRICE_MAX_AGE_MIN), 230)]), NOW)?.price).toBe(230);
  });

  it('ignores implausible prices so a typo never shows', () => {
    expect(isPlausiblePrice(23)).toBe(false);
    expect(isPlausiblePrice(23000)).toBe(false);
    expect(isPlausiblePrice(NaN)).toBe(false);
    const s = station([report(minsAgo(5), 23000), report(minsAgo(60), 230)]);
    expect(latestReportedPrice(s, NOW)?.price).toBe(230);
  });
});
