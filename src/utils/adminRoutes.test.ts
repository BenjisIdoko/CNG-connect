import { describe, expect, it } from 'vitest';
import { ADMIN_PATH, entrancePath, resolveEntrance, retiredEntranceRedirect } from './adminRoutes';

describe('resolveEntrance', () => {
  it('matches /admin, /admin/ and /admin/anything as the admin entrance', () => {
    for (const p of ['/admin', '/admin/', '/admin/users']) {
      expect(resolveEntrance(p, '')).toEqual({ entrance: 'admin', canonicalPath: null });
    }
  });

  it('is case-insensitive for the path', () => {
    expect(resolveEntrance('/Admin', '').entrance).toBe('admin');
  });

  it('does not match /administrator, /admins or /adminx', () => {
    for (const p of ['/administrator', '/admins', '/adminx', '/xadmin']) {
      expect(resolveEntrance(p, '').entrance).toBeNull();
    }
  });

  it('the retired station manager page is no longer an entrance (path or ?manager=1)', () => {
    for (const p of ['/station-manager', '/station-manager/', '/STATION-MANAGER']) {
      expect(resolveEntrance(p, '').entrance).toBeNull();
    }
    expect(resolveEntrance('/', '?manager=1')).toEqual({ entrance: null, canonicalPath: null });
  });

  it('maps ?admin=1 and ?moderation=1 to admin with the new canonicalPath', () => {
    expect(resolveEntrance('/', '?admin=1')).toEqual({ entrance: 'admin', canonicalPath: ADMIN_PATH });
    expect(resolveEntrance('/', '?moderation=1')).toEqual({ entrance: 'admin', canonicalPath: ADMIN_PATH });
  });

  it('an explicit path wins over a legacy query and gives no canonicalPath', () => {
    expect(resolveEntrance('/admin', '?moderation=1')).toEqual({ entrance: 'admin', canonicalPath: null });
  });

  it('returns no entrance for /, /?station=abc and empty strings', () => {
    expect(resolveEntrance('/', '')).toEqual({ entrance: null, canonicalPath: null });
    expect(resolveEntrance('/', '?station=abc')).toEqual({ entrance: null, canonicalPath: null });
    expect(resolveEntrance('', '')).toEqual({ entrance: null, canonicalPath: null });
  });

  it('entrancePath gives the admin path', () => {
    expect(entrancePath('admin')).toBe('/admin');
  });
});

describe('retiredEntranceRedirect', () => {
  it('sends the retired station manager page to the home page, keeping a query like ?station=', () => {
    expect(retiredEntranceRedirect('/station-manager', '')).toBe('/');
    expect(retiredEntranceRedirect('/station-manager/', '')).toBe('/');
    expect(retiredEntranceRedirect('/Station-Manager/anything', '?station=pci-station-65')).toBe('/?station=pci-station-65');
  });

  it('leaves every other address alone', () => {
    for (const p of ['/', '/admin', '/station-managers', '/stations', '']) {
      expect(retiredEntranceRedirect(p, '')).toBeNull();
    }
  });
});

