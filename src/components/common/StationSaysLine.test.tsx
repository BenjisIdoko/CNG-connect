import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StationSaysLine } from './StationSaysLine';
import { GasStation } from '../../types';

const NOW = Date.parse('2026-11-19T12:00:00Z');
const minsAgo = (m: number) => new Date(NOW - m * 60000).toISOString();

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
    ...patch,
  }) as GasStation;

const html = (s: GasStation, compact = false) => renderToStaticMarkup(<StationSaysLine station={s} now={NOW} compact={compact} />);

describe('StationSaysLine', () => {
  it('renders nothing for a station with no manager post', () => {
    expect(html(station())).toBe('');
    expect(html(station(), true)).toBe('');
  });

  it('says "Open for business · Gas available" with the age when the manager is selling', () => {
    const out = html(station({ managerState: 'selling', managerStateAt: minsAgo(20) }));
    expect(out).toContain('Station says');
    expect(out).toContain('Open for business · Gas available · updated 20 min ago');
  });

  it('says the station is open but waiting for supply', () => {
    expect(html(station({ managerState: 'open', managerStateAt: minsAgo(5) }))).toContain('Open · Waiting for gas supply · updated 5 min ago');
  });

  it('says the station is closed', () => {
    expect(html(station({ managerState: 'closed', managerStateAt: minsAgo(90) }))).toContain('Closed · updated 1 hr ago');
  });

  it('still shows a post from a phone that only knows the older selling flag', () => {
    expect(html(station({ managerSelling: true, managerSellingAt: minsAgo(10) }))).toContain('Open for business · Gas available');
    expect(html(station({ managerSelling: false, managerSellingAt: minsAgo(10) }))).toContain('Closed');
  });

  it('shows a post for 6 hours and nothing after', () => {
    expect(html(station({ managerState: 'selling', managerStateAt: minsAgo(359) }))).toContain('Open for business');
    expect(html(station({ managerState: 'selling', managerStateAt: minsAgo(361) }))).toBe('');
  });

  it('shows a live pressure reading with its age', () => {
    const out = html(station({ livePressureBar: 220, livePressureAt: minsAgo(120) }));
    expect(out).toContain('220 bar · updated 2 hr ago');
  });

  it("does not present the admin's fixed pressure as something the station says", () => {
    expect(html(station({ pumpPressure: 180 }))).toBe('');
  });

  it('the compact badge shows only the opening status, never the pressure', () => {
    const base = { livePressureBar: 220, livePressureAt: minsAgo(10) };
    const selling = html(station({ ...base, managerState: 'selling', managerStateAt: minsAgo(10) }), true);
    expect(selling).toContain('Station: open, gas available');
    expect(selling).not.toContain('bar');
    expect(html(station({ managerState: 'open', managerStateAt: minsAgo(10) }), true)).toContain('Station: open, no gas yet');
    expect(html(station({ managerState: 'closed', managerStateAt: minsAgo(10) }), true)).toContain('Station: closed');
    expect(html(station(base), true)).toBe('');
  });
});
