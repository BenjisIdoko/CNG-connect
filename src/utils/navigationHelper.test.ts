import { describe, it, expect, vi } from 'vitest';
import { openExternalMaps } from './navigationHelper';
import { GasStation } from '../types';

describe('openExternalMaps Utility', () => {
  it('launches external maps with station coordinates', () => {
    const mockOpen = vi.fn();
    const originalWindow = (globalThis as any).window;
    (globalThis as any).window = { open: mockOpen };

    const mockStation: GasStation = {
      id: 'test-st',
      name: 'Total CNG Wuse 2',
      address: 'Aminu Kano Crescent, Abuja',
      city: 'Abuja',
      state: 'Abuja FCT',
      distance: '1.2 km',
      driveTime: '4 min drive',
      status: 'full',
      statusLabel: 'Full stock',
      cngPrice: 230,
      priceTrend: 'stable',
      pumpPressure: 215,
      busyEstimate: 'Fast moving',
      lastUpdated: '4 min ago',
      verifiedByCommunity: true,
      phone: '',
      lat: 9.0765,
      lng: 7.4853,
      images: [],
      reports: [],
    };

    openExternalMaps(mockStation);

    expect(mockOpen).toHaveBeenCalledTimes(1);
    const calledUrl = mockOpen.mock.calls[0][0] as string;
    expect(calledUrl).toContain('9.0765');
    expect(calledUrl).toContain('7.4853');

    (globalThis as any).window = originalWindow;
  });
});
