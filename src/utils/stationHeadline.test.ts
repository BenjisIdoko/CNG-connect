import { describe, expect, it } from 'vitest';
import { describeStatusOrStation } from './stationHeadline';
import { GasStation } from '../types';

const NOW = Date.parse('2026-11-19T12:00:00Z');
const minsAgo = (m: number) => new Date(NOW - m * 60000).toISOString();

const station = (patch: Partial<GasStation> = {}): GasStation =>
  ({ id: 's1', name: 'T', address: '', city: '', state: '', distance: '', driveTime: '', status: 'unknown', statusLabel: '', lastUpdated: '', verifiedByCommunity: false, phone: '', lat: 0, lng: 0, images: [], reports: [], ...patch }) as GasStation;

describe('describeStatusOrStation', () => {
  it('with no report and no manager post it says what describeStatus says', () => {
    expect(describeStatusOrStation(station(), NOW)).toBe('No report yet');
  });

  it('with no recent report and a current manager post it says what the station says', () => {
    expect(describeStatusOrStation(station({ managerState: 'closed', managerStateAt: minsAgo(10) }), NOW)).toBe('Station: closed');
    expect(describeStatusOrStation(station({ managerState: 'selling', managerStateAt: minsAgo(10) }), NOW)).toBe('Station: open, gas available');
    expect(
      describeStatusOrStation(
        station({ managerState: 'closed', managerStateAt: minsAgo(10), managerStateUntil: new Date(Date.parse('2026-11-19T13:00:00Z')).toISOString() }),
        NOW,
      ),
    ).toBe('Station: closed · back ~2 pm');
  });

  it('an expired manager post says nothing extra', () => {
    expect(describeStatusOrStation(station({ managerState: 'closed', managerStateAt: minsAgo(400) }), NOW)).toBe('No report yet');
  });

  it('a recent driver report still wins over the manager post', () => {
    const s = station({ reports: [{ id: 'r', status: 'full', timestamp: minsAgo(10) } as never], managerState: 'closed', managerStateAt: minsAgo(10) });
    expect(describeStatusOrStation(s, NOW)).toBe('Available · 10 min ago');
  });
});
