import { describe, it, expect } from 'vitest';
import {
  isStationStale,
  getDistanceInKm,
  isSameState,
  normalizeStateName,
} from './proximityAlertEngine';

describe('Proximity Alert Engine', () => {
  describe('isStationStale', () => {
    it('should return false for recent station updates (e.g. Just now, 4 min ago)', () => {
      expect(isStationStale('Just now', 30)).toBe(false);
      expect(isStationStale('4 min ago', 30)).toBe(false);
      expect(isStationStale('25 min ago', 30)).toBe(false);
    });

    it('should return true for stale station updates (>= 30 min ago, 1 hour ago)', () => {
      expect(isStationStale('30 min ago', 30)).toBe(true);
      expect(isStationStale('35 min ago', 30)).toBe(true);
      expect(isStationStale('1 hour ago', 30)).toBe(true);
      expect(isStationStale('2 hours ago', 30)).toBe(true);
    });
  });

  describe('Haversine distance calculation', () => {
    it('should calculate accurate distance in km between two lat/lng coordinates', () => {
      // Abuja Wuse 2 (9.0765, 7.4853) to Airport Rd (8.9772, 7.3756)
      const dist = getDistanceInKm(9.0765, 7.4853, 8.9772, 7.3756);
      expect(dist).toBeGreaterThan(15);
      expect(dist).toBeLessThan(20);
    });
  });

  describe('State Name Normalization & Matching', () => {
    it('should match "FCT Abuja" with "Abuja FCT"', () => {
      expect(normalizeStateName('FCT Abuja')).toBe('abuja');
      expect(normalizeStateName('Abuja FCT')).toBe('abuja');
      expect(isSameState('FCT Abuja', 'Abuja FCT')).toBe(true);
    });

    it('should match "Lagos" with "Lagos State"', () => {
      expect(isSameState('Lagos', 'Lagos State')).toBe(true);
    });

    it('should match "Edo" with "Edo State (Benin)"', () => {
      expect(isSameState('Edo', 'Edo State (Benin)')).toBe(true);
    });

    it('should match "Rivers" with "Rivers State (PH)"', () => {
      expect(isSameState('Rivers', 'Rivers State (PH)')).toBe(true);
    });
  });
});
