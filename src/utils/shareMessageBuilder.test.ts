import { describe, it, expect } from 'vitest';
import { buildStationShareUrl, buildStationShareMessage } from './shareMessageBuilder';
import { GasStation } from '../types';

describe('shareMessageBuilder', () => {
  const sampleStation: GasStation = {
    id: 'nipc-001',
    name: 'NIPCO CNG Station',
    address: 'Central Business District',
    city: 'Abuja FCT',
    state: 'Abuja FCT',
    distance: '1.2 km',
    driveTime: '4 min drive',
    status: 'full',
    statusLabel: 'Full stock',
    pumpPressure: 215,
    lastUpdated: 'Updated 5 min ago',
    verifiedByCommunity: true,
    phone: '08012345678',
    lat: 9.0765,
    lng: 7.4853,
    images: [],
    reports: [
      {
        id: 'rep-1',
        author: 'Driver John',
        authorAvatar: '',
        verified: true,
        timestamp: 'Just now',
        status: 'full',
        statusLabel: 'Full stock',
        waitMinutes: 10,
        likes: 2,
      },
    ],
  };

  it('builds a valid deep-link share URL with station query param', () => {
    const url = buildStationShareUrl('nipc-001');
    expect(url).toBe('https://cngconnect.com.ng?station=nipc-001');
  });

  it('builds a full WhatsApp share message with name, status, wait time, pressure, and URL', () => {
    const message = buildStationShareMessage(sampleStation);
    expect(message).toContain('⛽ *CNG Station Alert*');
    expect(message).toContain('📍 *NIPCO CNG Station* (Abuja FCT)');
    expect(message).toContain('📊 Status: *Available · just now*');
    expect(message).toContain('⏱️ Est. Wait: *10 mins*');
    expect(message).toContain('⚡ Pump Pressure: *215 bar*');
    expect(message).toContain('https://cngconnect.com.ng?station=nipc-001');
  });

  it('shows a live pressure reading with its age when it is recent, and the plain fixed value when it is not', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60000).toISOString();
    const live = buildStationShareMessage({ ...sampleStation, livePressureBar: 220, livePressureAt: twoHoursAgo });
    expect(live).toContain('⚡ Pump Pressure: *220 bar · updated 2 hr ago*');

    const thirteenHoursAgo = new Date(Date.now() - 13 * 60 * 60000).toISOString();
    const old = buildStationShareMessage({ ...sampleStation, livePressureBar: 220, livePressureAt: thirteenHoursAgo });
    expect(old).toContain('⚡ Pump Pressure: *215 bar*');
    expect(old).not.toContain('updated');
  });

  it('handles station missing wait time or pump pressure cleanly', () => {
    const minimalStation: GasStation = {
      ...sampleStation,
      pumpPressure: 0,
      reports: [],
    };
    const message = buildStationShareMessage(minimalStation);
    expect(message).toContain('⛽ *CNG Station Alert*');
    expect(message).toContain('📊 Status: *Available · 5 min ago*');
    expect(message).not.toContain('⚡ Pump Pressure');
    expect(message).toContain('https://cngconnect.com.ng?station=nipc-001');
  });

  it('does not present an old report as the current status or wait', () => {
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    const stale: GasStation = {
      ...sampleStation,
      // The station row still says "full / Full stock" long after the last report.
      status: 'full',
      statusLabel: 'Full stock',
      lastUpdated: 'Just now',
      reports: [{ ...sampleStation.reports[0], timestamp: fortyDaysAgo, waitMinutes: 45 }],
    };
    const message = buildStationShareMessage(stale);
    // A report over 24 hours old is not shown at all, so a share says there is no report.
    expect(message).toContain('📊 Status: *No report yet*');
    expect(message).not.toContain('Full stock');
    expect(message).not.toContain('Est. Wait');
  });

  it('says there is no report yet for a station nobody has reported on', () => {
    const never: GasStation = { ...sampleStation, status: 'unknown', statusLabel: 'No recent reports', reports: [] };
    expect(buildStationShareMessage(never)).toContain('📊 Status: *No report yet*');
  });
});

