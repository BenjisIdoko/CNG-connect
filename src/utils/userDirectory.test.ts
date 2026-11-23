import { describe, expect, it } from 'vitest';
import {
  DirectoryUser,
  KIT_NONE,
  distinctKits,
  distinctStates,
  filterUsers,
  paginate,
  sortUsers,
  userInitials,
} from './userDirectory';

const user = (patch: Partial<DirectoryUser>): DirectoryUser => ({
  id: patch.id ?? 'u',
  name: 'Ada Obi',
  email: 'ada@example.com',
  phone: '08031234567',
  state: 'Lagos',
  vehicle: 'Toyota Corolla',
  cng_kit: '12kg cylinder, installed',
  reports_count: 3,
  reputation_score: 4.5,
  community_points: 120,
  is_admin: false,
  ...patch,
});

const ALL = { search: '', role: 'all' as const, state: '', kit: '' };

describe('userInitials', () => {
  it('uses the first letters of the first and last words', () => {
    expect(userInitials('Adewale Fajana', null)).toBe('AF');
    expect(userInitials('Theresa Olaniyi-Olushola', null)).toBe('TO');
    expect(userInitials('  nwachukwu  christopher ossai ', null)).toBe('NO');
  });

  it('uses one letter for a single word, and falls back to the email, then a question mark', () => {
    expect(userInitials('Glory', null)).toBe('G');
    expect(userInitials('', 'zed@example.com')).toBe('Z');
    expect(userInitials(null, null)).toBe('?');
  });
});

describe('filterUsers', () => {
  const rows = [
    user({ id: '1', name: 'Ada Obi', state: 'Lagos', is_admin: true }),
    user({ id: '2', name: 'Bola Ade', email: 'bola@x.com', phone: '09011112222', state: 'Abuja', cng_kit: '' }),
    user({ id: '3', name: null, email: 'noname@x.com', state: null, cng_kit: null, vehicle: null, phone: null }),
  ];

  it('returns everyone when nothing is filtered', () => {
    expect(filterUsers(rows, ALL)).toHaveLength(3);
  });

  it('searches name, email, phone, state and vehicle, ignoring case and surrounding spaces', () => {
    expect(filterUsers(rows, { ...ALL, search: '  BOLA ' }).map((r) => r.id)).toEqual(['2']);
    expect(filterUsers(rows, { ...ALL, search: '0901111' }).map((r) => r.id)).toEqual(['2']);
    expect(filterUsers(rows, { ...ALL, search: 'corolla' }).map((r) => r.id)).toEqual(['1', '2']);
    expect(filterUsers(rows, { ...ALL, search: 'noname' }).map((r) => r.id)).toEqual(['3']);
  });

  it('filters by role, including community managers', () => {
    const communityManagerIds = new Set(['2']);
    expect(filterUsers(rows, { ...ALL, role: 'admin', communityManagerIds }).map((r) => r.id)).toEqual(['1']);
    expect(filterUsers(rows, { ...ALL, role: 'community_manager', communityManagerIds }).map((r) => r.id)).toEqual(['2']);
    expect(filterUsers(rows, { ...ALL, role: 'driver', communityManagerIds }).map((r) => r.id)).toEqual(['3']);
    expect(filterUsers(rows, { ...ALL, role: 'driver' }).map((r) => r.id)).toEqual(['2', '3']);
  });

  it('filters by state and by kit, where KIT_NONE means no kit recorded', () => {
    expect(filterUsers(rows, { ...ALL, state: 'Abuja' }).map((r) => r.id)).toEqual(['2']);
    expect(filterUsers(rows, { ...ALL, kit: '12kg cylinder, installed' }).map((r) => r.id)).toEqual(['1']);
    expect(filterUsers(rows, { ...ALL, kit: KIT_NONE }).map((r) => r.id)).toEqual(['2', '3']);
  });

  it('combines filters', () => {
    expect(filterUsers(rows, { search: 'ada', role: 'admin', state: 'Lagos', kit: '' }).map((r) => r.id)).toEqual(['1']);
    expect(filterUsers(rows, { search: 'ada', role: 'driver', state: 'Lagos', kit: '' })).toEqual([]);
  });
});

describe('sortUsers', () => {
  const rows = [
    user({ id: 'b', name: 'bola', reports_count: 10, community_points: 5 }),
    user({ id: 'a', name: 'Ada', reports_count: 2, community_points: 50 }),
    user({ id: 'n', name: null, reports_count: null, community_points: null }),
    user({ id: 'c', name: 'Chidi', reports_count: 2, community_points: 7 }),
  ];

  it('sorts text case-insensitively and puts missing values last in either direction', () => {
    expect(sortUsers(rows, 'name', 'asc').map((r) => r.id)).toEqual(['a', 'b', 'c', 'n']);
    expect(sortUsers(rows, 'name', 'desc').map((r) => r.id)).toEqual(['c', 'b', 'a', 'n']);
  });

  it('sorts numbers, keeping ties in their original order', () => {
    expect(sortUsers(rows, 'reports', 'asc').map((r) => r.id)).toEqual(['a', 'c', 'b', 'n']);
    expect(sortUsers(rows, 'points', 'desc').map((r) => r.id)).toEqual(['a', 'c', 'b', 'n']);
  });

  it('sorts admins before community managers before drivers when ascending by role, and does not change its input', () => {
    const input = [user({ id: 'd', is_admin: false }), user({ id: 'cm', is_admin: false }), user({ id: 'x', is_admin: true })];
    const copy = [...input];
    expect(sortUsers(input, 'role', 'asc', new Set(['cm'])).map((r) => r.id)).toEqual(['x', 'cm', 'd']);
    expect(input).toEqual(copy);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);

  it('returns the page slice with the range and totals', () => {
    expect(paginate(items, 2, 10)).toEqual({ items: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20], page: 2, pageCount: 3, total: 25, from: 11, to: 20 });
  });

  it('shows a short last page', () => {
    const last = paginate(items, 3, 10);
    expect(last.items).toEqual([21, 22, 23, 24, 25]);
    expect(last.to).toBe(25);
  });

  it('clamps a page that is too high or too low', () => {
    expect(paginate(items, 99, 10).page).toBe(3);
    expect(paginate(items, 0, 10).page).toBe(1);
    expect(paginate(items, -4, 10).page).toBe(1);
  });

  it('handles an empty list as one empty page', () => {
    expect(paginate([], 1, 10)).toEqual({ items: [], page: 1, pageCount: 1, total: 0, from: 0, to: 0 });
  });
});

describe('distinct values', () => {
  const rows = [
    user({ state: 'Lagos', cng_kit: '15kg cylinder, installed' }),
    user({ state: 'Abuja', cng_kit: '12kg cylinder, installed' }),
    user({ state: 'Lagos', cng_kit: '15kg cylinder, installed' }),
    user({ state: null, cng_kit: '' }),
  ];

  it('lists each state once, sorted, ignoring blanks', () => {
    expect(distinctStates(rows)).toEqual(['Abuja', 'Lagos']);
  });

  it('lists each recorded kit once, sorted, ignoring blanks', () => {
    expect(distinctKits(rows)).toEqual(['12kg cylinder, installed', '15kg cylinder, installed']);
  });
});
