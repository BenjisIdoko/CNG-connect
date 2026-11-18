/**
 * Search, filter, sort and paging for the admin Users directory. Pure functions so the table
 * component only has to draw what these return.
 */

export interface DirectoryUser {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  state: string | null;
  vehicle: string | null;
  cng_kit: string | null;
  reports_count: number | null;
  reputation_score: number | null;
  community_points: number | null;
  is_admin: boolean | null;
}

export type RoleFilter = 'all' | 'admin' | 'driver';

export interface UserFilters {
  search: string;
  role: RoleFilter;
  /** An exact state name, or '' for every state. */
  state: string;
  /** An exact CNG kit value, KIT_NONE for "no kit recorded", or '' for every kit. */
  kit: string;
}

export type UserSortKey = 'name' | 'email' | 'state' | 'kit' | 'role' | 'reports' | 'reputation' | 'points';
export type SortDir = 'asc' | 'desc';

/** The kit filter value that means the driver has not recorded a kit. */
export const KIT_NONE = '__none__';

/** Two letters for the avatar: first and last word of the name; one word gives one letter. */
export function userInitials(name: string | null | undefined, email: string | null | undefined): string {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  if (words.length === 1) return words[0][0].toUpperCase();
  const mail = (email || '').trim();
  return mail ? mail[0].toUpperCase() : '?';
}

export function filterUsers<T extends DirectoryUser>(rows: T[], filters: UserFilters): T[] {
  const q = filters.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (filters.role === 'admin' && !r.is_admin) return false;
    if (filters.role === 'driver' && r.is_admin) return false;
    if (filters.state && r.state !== filters.state) return false;
    if (filters.kit === KIT_NONE) {
      if ((r.cng_kit || '').trim()) return false;
    } else if (filters.kit && r.cng_kit !== filters.kit) {
      return false;
    }
    if (!q) return true;
    return [r.name, r.email, r.phone, r.state, r.vehicle].some((f) => (f || '').toLowerCase().includes(q));
  });
}

const sortValue = (r: DirectoryUser, key: UserSortKey): string | number | null => {
  switch (key) {
    case 'name':
      return (r.name || '').trim().toLowerCase() || null;
    case 'email':
      return (r.email || '').trim().toLowerCase() || null;
    case 'state':
      return (r.state || '').trim().toLowerCase() || null;
    case 'kit':
      return (r.cng_kit || '').trim().toLowerCase() || null;
    case 'role':
      return r.is_admin ? 0 : 1; // admins first when ascending
    case 'reports':
      return r.reports_count;
    case 'reputation':
      return r.reputation_score;
    case 'points':
      return r.community_points;
  }
};

/** A sorted copy. Missing values go last in either direction; ties keep their original order. */
export function sortUsers<T extends DirectoryUser>(rows: T[], key: UserSortKey, dir: SortDir): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: sortValue(row, key) }))
    .sort((a, b) => {
      if (a.value === null && b.value !== null) return 1;
      if (a.value !== null && b.value === null) return -1;
      if (a.value !== null && b.value !== null && a.value !== b.value) {
        const cmp =
          typeof a.value === 'number' && typeof b.value === 'number'
            ? a.value - b.value
            : String(a.value).localeCompare(String(b.value));
        if (cmp !== 0) return cmp * sign;
      }
      return a.index - b.index;
    })
    .map((x) => x.row);
}

export interface Page<T> {
  items: T[];
  /** The page actually shown, after clamping into 1..pageCount. */
  page: number;
  pageCount: number;
  total: number;
  /** 1-based position of the first and last item shown; 0 and 0 when the list is empty. */
  from: number;
  to: number;
}

export function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
  const size = Math.max(1, Math.floor(pageSize) || 1);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(pageCount, Math.max(1, Math.floor(page) || 1));
  const start = (current - 1) * size;
  const slice = items.slice(start, start + size);
  return {
    items: slice,
    page: current,
    pageCount,
    total,
    from: total === 0 ? 0 : start + 1,
    to: total === 0 ? 0 : start + slice.length,
  };
}

const sortedUnique = (values: Array<string | null | undefined>): string[] =>
  [...new Set(values.map((v) => (v || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

export const distinctStates = (rows: DirectoryUser[]): string[] => sortedUnique(rows.map((r) => r.state));
export const distinctKits = (rows: DirectoryUser[]): string[] => sortedUnique(rows.map((r) => r.cng_kit));
