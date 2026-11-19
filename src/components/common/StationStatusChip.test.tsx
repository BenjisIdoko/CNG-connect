import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StationStatusChip } from './StationStatusChip';
import { GasStation } from '../../types';

const NOON = Date.parse('2026-11-19T12:00:00+01:00');
const FIVE_AM = Date.parse('2026-11-19T05:00:00+01:00');
const minsBefore = (now: number, m: number) => new Date(now - m * 60000).toISOString();

const station = (patch: Partial<GasStation> = {}): GasStation =>
  ({
    id: 's1',
    name: 'Test',
    address: '',
    city: '',
    state: '',
    distance: '',
    driveTime: '',
    status: 'unknown',
    statusLabel: '',
    lastUpdated: '',
    verifiedByCommunity: false,
    phone: '',
    lat: 0,
    lng: 0,
    images: [],
    reports: [],
    opensAt: '06:00:00',
    closesAt: '22:00:00',
    ...patch,
  }) as GasStation;

const html = (s: GasStation, now: number) => renderToStaticMarkup(<StationStatusChip station={s} now={now} />);

describe('StationStatusChip with no recent report', () => {
  it('inside opening hours it says "No report yet"', () => {
    expect(html(station(), NOON)).toContain('No report yet');
  });

  it('outside opening hours it says the station is closed and when it opens, in grey', () => {
    const out = html(station(), FIVE_AM);
    expect(out).toContain('Closed · opens 6 am');
    expect(out).not.toContain('No report yet');
  });

  it('a 24-hour station, or one with no hours, still says "No report yet" at night', () => {
    expect(html(station({ is24Hours: true }), FIVE_AM)).toContain('No report yet');
    expect(html(station({ opensAt: null, closesAt: null }), FIVE_AM)).toContain('No report yet');
  });

  it('a current manager post replaces the chip, even outside hours: the "Station says" badge speaks', () => {
    const s = station({ managerState: 'closed', managerStateAt: minsBefore(FIVE_AM, 10) });
    expect(html(s, FIVE_AM)).toBe('');
    expect(html(station({ managerState: 'selling', managerStateAt: minsBefore(NOON, 10) }), NOON)).toBe('');
  });

  it('an expired manager post no longer hides the chip', () => {
    const s = station({ managerState: 'closed', managerStateAt: minsBefore(NOON, 400) });
    expect(html(s, NOON)).toContain('No report yet');
  });
});

describe('StationStatusChip with a fresh driver report', () => {
  it('still shows the driver report, whatever the hours or the manager says', () => {
    const s = station({
      reports: [{ id: 'r1', status: 'full', timestamp: minsBefore(FIVE_AM, 10) } as never],
      managerState: 'closed',
      managerStateAt: minsBefore(FIVE_AM, 10),
    });
    const out = html(s, FIVE_AM);
    expect(out).toContain('Available');
    expect(out).not.toContain('Closed · opens');
  });
});
