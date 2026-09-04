import { describe, it, expect } from 'vitest';
import { formatStationAge, formatRelativeTime } from './timeUtils';
import { GasStation } from '../types';

describe('formatStationAge Utility', () => {
  const baseStation: GasStation = {
    id: 'st-test',
    name: 'Test CNG Station',
    address: 'Test Addr',
    city: 'Abuja',
    state: 'FCT',
    distance: '2.0 km',
    driveTime: '5 min',
    status: 'full',
    statusLabel: 'Full stock',
    lastUpdated: '5 min ago',
    verifiedByCommunity: true,
    phone: '08000000000',
    lat: 9.0765,
    lng: 7.4853,
    images: [],
    reports: [],
  };

  it('should return "No recent report" if station is null/undefined or status is unknown', () => {
    expect(formatStationAge(null)).toBe('No recent report');
    expect(formatStationAge({ ...baseStation, status: 'unknown', statusLabel: 'No recent reports' })).toBe('No recent report');
  });

  it('should return "No recent report" if lastUpdated is "Seeded from PCI" or empty', () => {
    expect(formatStationAge({ ...baseStation, lastUpdated: 'Seeded from PCI' })).toBe('No recent report');
    expect(formatStationAge({ ...baseStation, lastUpdated: '' })).toBe('No recent report');
  });

  it('should format "Just now" as "Updated Just now"', () => {
    expect(formatStationAge({ ...baseStation, lastUpdated: 'Just now' })).toBe('Updated Just now');
  });

  it('should prefix relative times like "5 min ago" or "2 hrs ago" with "Updated "', () => {
    expect(formatStationAge({ ...baseStation, lastUpdated: '5 min ago' })).toBe('Updated 5 min ago');
    expect(formatStationAge({ ...baseStation, lastUpdated: '2 hrs ago' })).toBe('Updated 2 hrs ago');
  });

  it('should compute relative time from ISO timestamp', () => {
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(formatStationAge({ ...baseStation, lastUpdated: tenMinsAgo })).toBe('Updated 10 min ago');
  });
});

describe('formatRelativeTime Utility', () => {
  it('returns "Just now" for an instant or invalid timestamp', () => {
    expect(formatRelativeTime(new Date().toISOString())).toBe('Just now');
    expect(formatRelativeTime('not-a-date')).toBe('Just now');
  });

  it('formats minutes and hours', () => {
    expect(formatRelativeTime(new Date(Date.now() - 5 * 60 * 1000).toISOString())).toBe('5 min ago');
    expect(formatRelativeTime(new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())).toBe('3 hrs ago');
  });

  it('formats a single hour without pluralizing', () => {
    expect(formatRelativeTime(new Date(Date.now() - 60 * 60 * 1000).toISOString())).toBe('1 hr ago');
  });

  it('formats days within the last week', () => {
    expect(formatRelativeTime(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString())).toBe('2 days ago');
  });

  it('falls back to a short date beyond a week', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(tenDaysAgo.toISOString())).toBe(
      tenDaysAgo.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
    );
  });
});
