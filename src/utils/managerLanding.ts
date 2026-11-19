/**
 * Where a station manager lands after signing in. A manager with exactly one station goes straight to
 * it (its details editor opens); with several they pick from the list. It happens once per visit, so
 * closing the editor to post a status is not undone by the next reload of the list.
 */
export function stationToOpenOnArrival(stations: Array<{ id: string }>, alreadyOpened: boolean): string | null {
  if (alreadyOpened || stations.length !== 1) return null;
  return stations[0].id;
}
