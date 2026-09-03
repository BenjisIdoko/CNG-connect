import { describe, it, expect } from 'vitest';
import { getDriverTier, DRIVER_TIERS } from './reputationEngine';

describe('reputationEngine', () => {
  it('assigns Rookie Driver tier for 0 to 99 points', () => {
    const progress0 = getDriverTier(0);
    expect(progress0.currentTier.id).toBe('rookie');
    expect(progress0.progressPercent).toBe(0);

    const progress50 = getDriverTier(50);
    expect(progress50.currentTier.id).toBe('rookie');
    expect(progress50.nextTier?.id).toBe('contributor');
    expect(progress50.progressPercent).toBe(50);
  });

  it('assigns Active Contributor tier for 100 to 299 points', () => {
    const progress = getDriverTier(200);
    expect(progress.currentTier.id).toBe('contributor');
    expect(progress.nextTier?.id).toBe('verified_reporter');
    expect(progress.pointsForNextTier).toBe(100); // 300 - 200
  });

  it('assigns Verified Reporter tier for 300 to 749 points', () => {
    const progress = getDriverTier(300);
    expect(progress.currentTier.id).toBe('verified_reporter');
    expect(progress.currentTier.title).toBe('Verified Reporter');
    expect(progress.currentTier.badgeIcon).toBe('🥇');
  });

  it('assigns Station Scout tier for 750 to 1499 points', () => {
    const progress = getDriverTier(1000);
    expect(progress.currentTier.id).toBe('station_scout');
    expect(progress.nextTier?.id).toBe('gas_finder_legend');
  });

  it('assigns Gas Finder Legend tier for 1500+ points with 100% progress', () => {
    const progress = getDriverTier(2000);
    expect(progress.currentTier.id).toBe('gas_finder_legend');
    expect(progress.currentTier.title).toBe('Gas Finder Legend');
    expect(progress.currentTier.badgeIcon).toBe('👑');
    expect(progress.nextTier).toBeNull();
    expect(progress.progressPercent).toBe(100);
  });
});
