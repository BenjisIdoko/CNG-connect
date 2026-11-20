/**
 * Where a station manager lands after signing in. A manager with exactly one station goes straight to
 * it (its details editor opens); with several they pick from the list. It happens once per visit, so
 * closing the editor to post a status is not undone by the next reload of the list.
 */
export function stationToOpenOnArrival(stations: Array<{ id: string }>, alreadyOpened: boolean, held = false): string | null {
  // `held`: something else needs the manager first (the set-password card). A full-screen editor opened
  // now would cover it, so it opens once the manager has dealt with that.
  if (held || alreadyOpened || stations.length !== 1) return null;
  return stations[0].id;
}

/**
 * Whether the automatic opening of a one-station manager's editor must wait. It waits while the
 * set-password card is pending, and while another page (My profile) is showing: the editor is a full-screen
 * layer outside the page, so hiding the page does not hide it and it would open over the wrong page.
 */
export function holdsAutoOpen({ promptPending, pageActive }: { promptPending: boolean; pageActive: boolean }): boolean {
  return promptPending || !pageActive;
}
