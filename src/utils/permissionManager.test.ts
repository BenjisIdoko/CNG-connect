import { describe, it, expect } from 'vitest';
import {
  checkNotificationPermission,
  checkChatPermission,
  checkLiveUpdatePermission,
  normalizeStateName,
} from './permissionManager';

describe('State-Scoped Notification Permission Check', () => {
  it('allows push notification delivery when user state matches station state', () => {
    const res = checkNotificationPermission('Abuja FCT', 'Abuja FCT');
    expect(res.allowed).toBe(true);
  });

  it('allows push notification with normalized state variations (e.g. FCT vs Abuja FCT)', () => {
    const res = checkNotificationPermission('Abuja', 'Abuja FCT');
    expect(res.allowed).toBe(true);
  });

  it('blocks push notification when user state does not match station state', () => {
    const res = checkNotificationPermission('Lagos', 'Abuja FCT');
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain('scoped by state');
  });

  it('normalizes state names correctly', () => {
    expect(normalizeStateName('Lagos State')).toBe('lagos');
    expect(normalizeStateName('FCT')).toBe('abuja fct');
    expect(normalizeStateName('Abuja')).toBe('abuja fct');
  });
});

describe('Open Station Group Chat Permission Check', () => {
  it('allows signed-in users to access and post to chat regardless of location or presence', () => {
    const res = checkChatPermission(true);
    expect(res.allowed).toBe(true);
  });

  it('denies chat access to unauthenticated users', () => {
    const res = checkChatPermission(false);
    expect(res.allowed).toBe(false);
  });
});

describe('Presence-Gated Live Status Update Permission Check', () => {
  it('allows status update submission when active presence flag is true', () => {
    const res = checkLiveUpdatePermission(true);
    expect(res.allowed).toBe(true);
  });

  it('allows status update when GPS is within geofence radius (0.8km)', () => {
    const userGps = { lat: 9.0765, lng: 7.4853 };
    const stationLoc = { lat: 9.0770, lng: 7.4855 }; // ~0.06 km away
    const res = checkLiveUpdatePermission(false, userGps, stationLoc);
    expect(res.allowed).toBe(true);
  });

  it('blocks status update when not present and GPS is outside geofence radius', () => {
    const userGps = { lat: 6.5244, lng: 3.3792 }; // Lagos
    const stationLoc = { lat: 9.0765, lng: 7.4853 }; // Abuja (~500 km away)
    const res = checkLiveUpdatePermission(false, userGps, stationLoc);
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('You need to be at the station to report its status.');
  });
});
