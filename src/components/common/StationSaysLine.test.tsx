import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StationSaysLine } from './StationSaysLine';
import { GasStation } from '../../types';

const NOW = Date.parse('2026-11-18T12:00:00Z');
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

  it('shows the selling post with its age under "Station says"', () => {
    const out = html(station({ managerSelling: true, managerSellingAt: minsAgo(20) }));
    expect(out).toContain('Station says');
    expect(out).toContain('Selling now · updated 20 min ago');
  });

  it('shows "Not selling" too', () => {
    expect(html(station({ managerSelling: false, managerSellingAt: minsAgo(5) }))).toContain('Not selling · updated 5 min ago');
  });

  it('shows a live pressure reading with its age', () => {
    const out = html(station({ livePressureBar: 220, livePressureAt: minsAgo(120) }));
    expect(out).toContain('220 bar · updated 2 hr ago');
  });

  it('does not present the admin\'s fixed pressure as something the station says', () => {
    expect(html(station({ pumpPressure: 180 }))).toBe('');
  });

  it('shows nothing once a post is over 2 hours old', () => {
    expect(html(station({ managerSelling: true, managerSellingAt: minsAgo(121) }))).toBe('');
  });

  it('the compact badge shows only the selling status, never the pressure', () => {
    const out = html(
      station({ managerSelling: true, managerSellingAt: minsAgo(10), livePressureBar: 220, livePressureAt: minsAgo(10) }),
      true,
    );
    expect(out).toContain('Station: selling');
    expect(out).not.toContain('bar');
    expect(html(station({ livePressureBar: 220, livePressureAt: minsAgo(10) }), true)).toBe('');
  });
});
