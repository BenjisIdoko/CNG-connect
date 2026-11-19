/** One row of "this person manages this station", with the names the admin screen shows. */
export interface ManagerLink {
  stationId: string;
  stationName: string;
  userId: string;
  email: string;
  name: string;
  /** True for an invite the person has not claimed yet (they have not signed in). */
  pending?: boolean;
}

export interface ManagerGroup {
  userId: string;
  email: string;
  name: string;
  /** True when this is an invited email that has not signed in yet. */
  pending: boolean;
  stations: { id: string; name: string }[];
}

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/**
 * One group per manager, each with their stations (sorted by name, no repeats). Managers who have signed
 * in come first, sorted by email; invites that have not been claimed yet follow, also sorted by email.
 */
export function groupManagers(links: ManagerLink[]): ManagerGroup[] {
  const groups = new Map<string, ManagerGroup>();
  for (const l of links) {
    let g = groups.get(l.userId);
    if (!g) {
      g = { userId: l.userId, email: l.email, name: l.name, pending: l.pending === true, stations: [] };
      groups.set(l.userId, g);
    }
    if (!g.stations.some((s) => s.id === l.stationId)) g.stations.push({ id: l.stationId, name: l.stationName });
  }
  const result = [...groups.values()];
  for (const g of result) g.stations.sort((a, b) => byText(a.name, b.name));
  return result.sort((a, b) => (a.pending === b.pending ? byText(a.email, b.email) : a.pending ? 1 : -1));
}
