import { describe, expect, it } from 'vitest';
import { ADMIN_PATH, MANAGER_PATH, entrancePath, resolveEntrance } from './adminRoutes';

describe('resolveEntrance', () => {
  it('matches /admin, /admin/ and /admin/anything as the admin entrance', () => {
    for (const p of ['/admin', '/admin/', '/admin/users']) {
      expect(resolveEntrance(p, '')).toEqual({ entrance: 'admin', canonicalPath: null });
    }
  });

  it('matches /station-manager and /station-manager/ as the manager entrance', () => {
    for (const p of ['/station-manager', '/station-manager/']) {
      expect(resolveEntrance(p, '')).toEqual({ entrance: 'manager', canonicalPath: null });
    }
  });

  it('is case-insensitive for the path', () => {
    expect(resolveEntrance('/Admin', '').entrance).toBe('admin');
    expect(resolveEntrance('/STATION-MANAGER', '').entrance).toBe('manager');
  });

  it('does not match /administrator, /admins, /station-managers or /adminx', () => {
    for (const p of ['/administrator', '/admins', '/station-managers', '/adminx', '/xadmin']) {
      expect(resolveEntrance(p, '').entrance).toBeNull();
    }
  });

  it('maps ?admin=1 and ?moderation=1 to admin and ?manager=1 to manager with the new canonicalPath', () => {
    expect(resolveEntrance('/', '?admin=1')).toEqual({ entrance: 'admin', canonicalPath: ADMIN_PATH });
    expect(resolveEntrance('/', '?moderation=1')).toEqual({ entrance: 'admin', canonicalPath: ADMIN_PATH });
    expect(resolveEntrance('/', '?manager=1')).toEqual({ entrance: 'manager', canonicalPath: MANAGER_PATH });
  });

  it('an explicit path wins over a legacy query and gives no canonicalPath', () => {
    expect(resolveEntrance('/admin', '?manager=1')).toEqual({ entrance: 'admin', canonicalPath: null });
    expect(resolveEntrance('/station-manager', '?admin=1')).toEqual({ entrance: 'manager', canonicalPath: null });
  });

  it('returns no entrance for /, /?station=abc and empty strings', () => {
    expect(resolveEntrance('/', '')).toEqual({ entrance: null, canonicalPath: null });
    expect(resolveEntrance('/', '?station=abc')).toEqual({ entrance: null, canonicalPath: null });
    expect(resolveEntrance('', '')).toEqual({ entrance: null, canonicalPath: null });
  });

  it('entrancePath gives the two paths', () => {
    expect(entrancePath('admin')).toBe('/admin');
    expect(entrancePath('manager')).toBe('/station-manager');
  });
});
