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
});
