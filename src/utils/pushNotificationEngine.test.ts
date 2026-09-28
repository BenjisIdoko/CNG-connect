import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  detectStatusTransition,
  checkShouldNotifyDriver,
  requestNotificationPermission,
} from './pushNotificationEngine';
import { GasStation, UserProfile } from '../types';

describe('pushNotificationEngine', () => {
  const mockUser: UserProfile = {
    name: 'Musa Abdullahi',
    email: 'musa@cngconnect.ng',
    phone: '08031234567',
    state: 'Abuja FCT',
    vehicle: 'Toyota Corolla',
    cngKit: 'Dual fuel CNG kit installed',
    avatar: 'https://example.com/avatar.jpg',
    cngInstalledDate: '2025-01-15',
    monthlySavings: 45000,
    reportsCount: 12,
    reputationScore: 150,
  };

  const mockStation: GasStation = {
    id: 'st-001',
    name: 'NIPCO CNG Station Jiwa',
    address: 'Jiwa Expressway, Abuja',
    city: 'Abuja',
    state: 'Abuja FCT',
    distance: '2.5 km',
    driveTime: '8 min drive',
    lat: 9.0765,
    lng: 7.3985,
    status: 'full',
    statusLabel: 'Full Stock',
    pumpPressure: 220,
    cngPrice: 230,
    busyEstimate: '10 mins',
    lastUpdated: 'Updated 5 min ago',
    verifiedByCommunity: true,
    phone: '08030000000',
    images: [],
    reports: [],
  };

  describe('detectStatusTransition', () => {
    it('returns "recovered" when station transitions from queue/out to full', () => {
      expect(detectStatusTransition('queue', 'full')).toBe('recovered');
      expect(detectStatusTransition('out', 'full')).toBe('recovered');
      expect(detectStatusTransition('low', 'full')).toBe('recovered');
    });

    it('returns "depleted" when station transitions from full/queue to out or low', () => {
      expect(detectStatusTransition('full', 'out')).toBe('depleted');
      expect(detectStatusTransition('full', 'low')).toBe('depleted');
      expect(detectStatusTransition('queue', 'out')).toBe('depleted');
    });

    it('returns null when status remains unchanged or transitions between neutral states', () => {
      expect(detectStatusTransition('full', 'full')).toBeNull();
      expect(detectStatusTransition('queue', 'queue')).toBeNull();
      expect(detectStatusTransition('out', 'low')).toBeNull();
    });
  });

  describe('checkShouldNotifyDriver', () => {
    it('notifies driver if station is marked as favorite', () => {
      const result = checkShouldNotifyDriver(mockStation, mockUser, null, ['st-001']);
      expect(result.notify).toBe(true);
      expect(result.isFavorite).toBe(true);
    });

    it('notifies every driver in the station\'s own state, not just favorites or nearby ones', () => {
      // Gwagwalada, Abuja — same state as the station but well over 15 km away, and not a favorite.
      const userCoords = { lat: 8.9500, lng: 7.0800 };
      const result = checkShouldNotifyDriver(mockStation, mockUser, userCoords, []);
      expect(result.notify).toBe(true);
      expect(result.isFavorite).toBe(false);
    });

    it('notifies a same-state driver even with no known coordinates at all', () => {
      const result = checkShouldNotifyDriver(mockStation, mockUser, null, []);
      expect(result.notify).toBe(true);
      expect(result.distanceKm).toBeUndefined();
    });

    it('blocks notification if driver registered state does not match station state', () => {
      const userCoords = { lat: 6.5244, lng: 3.3792 };
      const lagosUser: UserProfile = { ...mockUser, state: 'Lagos' };
      const result = checkShouldNotifyDriver(mockStation, lagosUser, userCoords, []);
      expect(result.notify).toBe(false);
      expect(result.reason).toContain('outside driver\'s state');
    });

    it('still reaches an out-of-state driver for a favorited station, or one they are physically next to', () => {
      const lagosUser: UserProfile = { ...mockUser, state: 'Lagos' };
      const favorited = checkShouldNotifyDriver(mockStation, lagosUser, null, ['st-001']);
      expect(favorited.notify).toBe(true);

      const rightNextToIt = checkShouldNotifyDriver(mockStation, lagosUser, { lat: 9.0800, lng: 7.4000 }, []);
      expect(rightNextToIt.notify).toBe(true);
      expect(rightNextToIt.distanceKm).toBeLessThan(15);
    });
  });
});
