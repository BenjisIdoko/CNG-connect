import { describe, it, expect } from 'vitest';
import { calculateVerificationMetadata } from './apiService';
import { DriverReport } from '../types';

describe('Verification Weighting & Level Calculation', () => {
  it('should assign level verified_live_photo and weight 1.0 when report has verified live photo', () => {
    const report: DriverReport = {
      id: 'rep-test-1',
      author: 'Test Driver',
      authorAvatar: '',
      verified: true,
      isPhotoVerified: true,
      timestamp: 'Just now',
      status: 'full',
      statusLabel: 'Full stock',
      likes: 1,
    };

    const metadata = calculateVerificationMetadata(report);
    expect(metadata.verificationLevel).toBe('verified_live_photo');
    expect(metadata.verificationWeight).toBe(1.0);
  });

  it('should assign level quick_tap_geofence and weight 0.5 for 1-tap geofence updates', () => {
    const report: DriverReport = {
      id: 'rep-test-2',
      author: 'Geofence Driver',
      authorAvatar: '',
      verified: false,
      isPhotoVerified: false,
      timestamp: 'Just now',
      status: 'full',
      statusLabel: 'Full stock',
      comment: '1-tap geofence update near Total CNG',
      likes: 1,
    };

    const metadata = calculateVerificationMetadata(report);
    expect(metadata.verificationLevel).toBe('quick_tap_geofence');
    expect(metadata.verificationWeight).toBe(0.5);
  });

  it('should assign level unverified_text and weight 0.5 for plain text reports', () => {
    const report: DriverReport = {
      id: 'rep-test-3',
      author: 'Plain Driver',
      authorAvatar: '',
      verified: false,
      isPhotoVerified: false,
      timestamp: 'Just now',
      status: 'queue',
      statusLabel: 'Queuing',
      comment: 'Queue is around 5 cars long',
      likes: 1,
    };

    const metadata = calculateVerificationMetadata(report);
    expect(metadata.verificationLevel).toBe('unverified_text');
    expect(metadata.verificationWeight).toBe(0.5);
  });

  it('should update station status, lastUpdated, and persist report in localStorage when submitReport is called', async () => {
    const { apiService } = await import('./apiService');
    const stations = await apiService.fetchStations();
    expect(stations.length).toBeGreaterThan(0);

    const targetStation = stations[0];
    const testReport: DriverReport = {
      id: `rep-test-${Date.now()}`,
      author: 'Guest Driver',
      authorAvatar: '',
      verified: false,
      timestamp: 'Just now',
      status: 'out',
      statusLabel: 'Out of gas',
      comment: 'Pump is undergoing maintenance',
      likes: 0,
    };

    const updatedStations = await apiService.submitReport(targetStation.id, testReport, 'out');
    const updatedTarget = updatedStations.find((s) => s.id === targetStation.id);

    expect(updatedTarget).toBeDefined();
    expect(updatedTarget?.status).toBe('out');
    expect(updatedTarget?.statusLabel).toBe('Out of gas');
    expect(updatedTarget?.lastUpdated).toBe('Just now');
    expect(updatedTarget?.reports.some((r) => r.id === testReport.id)).toBe(true);

    // Simulate page reload (re-querying fetchStations)
    const reloadedStations = await apiService.fetchStations();
    const reloadedTarget = reloadedStations.find((s) => s.id === targetStation.id);

    expect(reloadedTarget?.status).toBe('out');
    expect(reloadedTarget?.reports.some((r) => r.id === testReport.id)).toBe(true);
  });
});
