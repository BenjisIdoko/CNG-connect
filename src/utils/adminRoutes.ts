/**
 * The two hidden entrances to the app's back office:
 *   /admin            the super admin's dashboard
 *   /station-manager  a station manager's page (only their assigned stations)
 * The older links (?admin=1, ?moderation=1, ?manager=1) still work and are forwarded to these paths.
 * Which role may actually use each one is enforced by the database, not by this file.
 */

export type Entrance = 'admin' | 'manager';

export const ADMIN_PATH = '/admin';
export const MANAGER_PATH = '/station-manager';

export const entrancePath = (entrance: Entrance): string => (entrance === 'admin' ? ADMIN_PATH : MANAGER_PATH);

/** True when `pathname` is exactly `base` or a sub-path of it ("/admin", "/admin/", "/admin/x", not "/admins"). */
const isPathUnder = (pathname: string, base: string): boolean => {
  const p = pathname.toLowerCase();
  return p === base || p.startsWith(`${base}/`);
};

export interface ResolvedEntrance {
  entrance: Entrance | null;
  /** The new path when the match came from an old ?query link, so the caller can swap the address bar. */
  canonicalPath: string | null;
}

export function resolveEntrance(pathname: string, search: string): ResolvedEntrance {
  if (isPathUnder(pathname || '', ADMIN_PATH)) return { entrance: 'admin', canonicalPath: null };
  if (isPathUnder(pathname || '', MANAGER_PATH)) return { entrance: 'manager', canonicalPath: null };

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search || '');
  } catch {
    return { entrance: null, canonicalPath: null };
  }
  if (params.has('admin') || params.has('moderation')) return { entrance: 'admin', canonicalPath: ADMIN_PATH };
  if (params.has('manager')) return { entrance: 'manager', canonicalPath: MANAGER_PATH };
  return { entrance: null, canonicalPath: null };
}
