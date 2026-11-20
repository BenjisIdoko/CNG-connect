/**
 * The one hidden entrance to the app's back office:
 *   /admin  the super admin's dashboard
 * The older links (?admin=1, ?moderation=1) still work and are forwarded to this path. (/station-manager and
 * ?manager=1 used to open a station manager's page; that role was retired, so they are ordinary addresses now
 * and /station-manager is redirected to the home page by vercel.json.) Who may actually use the dashboard is
 * enforced by the database, not by this file.
 */

export type Entrance = 'admin';

export const ADMIN_PATH = '/admin';

export const entrancePath = (_entrance: Entrance): string => ADMIN_PATH;

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

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search || '');
  } catch {
    return { entrance: null, canonicalPath: null };
  }
  if (params.has('admin') || params.has('moderation')) return { entrance: 'admin', canonicalPath: ADMIN_PATH };
  return { entrance: null, canonicalPath: null };
}
