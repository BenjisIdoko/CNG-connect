import { describe, expect, it } from 'vitest';
import { ManagerLink, groupManagers } from './stationManagerGroups';

const link = (userId: string, email: string, stationId: string, stationName: string, name = ''): ManagerLink => ({
  userId,
  email,
  name,
  stationId,
  stationName,
});

describe('groupManagers', () => {
  it('groups links by user, sorts groups by email and stations by name', () => {
    const groups = groupManagers([
      link('u2', 'zed@example.com', 's3', 'Zeta Gas'),
      link('u1', 'amy@example.com', 's2', 'Beta Gas', 'Amy'),
      link('u1', 'amy@example.com', 's1', 'Alpha Gas', 'Amy'),
    ]);
    expect(groups.map((g) => g.email)).toEqual(['amy@example.com', 'zed@example.com']);
    expect(groups[0].stations.map((s) => s.name)).toEqual(['Alpha Gas', 'Beta Gas']);
    expect(groups[0].name).toBe('Amy');
    expect(groups[1].stations).toEqual([{ id: 's3', name: 'Zeta Gas' }]);
  });

  it('collapses a duplicate user and station pair', () => {
    const groups = groupManagers([link('u1', 'a@x.com', 's1', 'Alpha'), link('u1', 'a@x.com', 's1', 'Alpha')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].stations).toHaveLength(1);
  });

  it('returns an empty list for no links', () => {
    expect(groupManagers([])).toEqual([]);
  });

  it('sorts emails case-insensitively', () => {
    const groups = groupManagers([link('u1', 'Bob@x.com', 's1', 'A'), link('u2', 'amy@x.com', 's2', 'B')]);
    expect(groups.map((g) => g.email)).toEqual(['amy@x.com', 'Bob@x.com']);
  });
});
