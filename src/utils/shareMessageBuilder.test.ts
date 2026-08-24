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
    expect(url).toBe('https://cng-connect.vercel.app?station=nipc-001');
  });

  it('builds a full WhatsApp share message with name, status, wait time, pressure, and URL', () => {
    const message = buildStationShareMessage(sampleStation);
    expect(message).toContain('⛽ NIPCO CNG Station (Abuja FCT)');
    expect(message).toContain('Full stock');
    expect(message).toContain('10min wait');
    expect(message).toContain('215 bar');
    expect(message).toContain('https://cng-connect.vercel.app?station=nipc-001');
  });

  it('handles station missing wait time or pump pressure cleanly', () => {
    const minimalStation: GasStation = {
      ...sampleStation,
      pumpPressure: 0,
      reports: [],
    };
    const message = buildStationShareMessage(minimalStation);
    expect(message).toBe(
      '⛽ NIPCO CNG Station (Abuja FCT) — Full stock via CNG-Connect. Check live status: https://cng-connect.vercel.app?station=nipc-001'
    );
  });
});
