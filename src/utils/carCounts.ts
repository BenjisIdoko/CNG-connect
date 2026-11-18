/**
 * Turns the rows returned by the database's station_car_counts() — one { station_id, cars } per
 * station that has a car at its geofence right now — into a lookup by station id. Anything that is
 * not a well-formed row with a positive whole number of cars is dropped.
 */
export function carCountsToMap(rows: unknown): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!Array.isArray(rows)) return counts;
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue;
    const { station_id: stationId, cars } = row as { station_id?: unknown; cars?: unknown };
    if (typeof stationId !== 'string' || stationId === '') continue;
    if (typeof cars !== 'number' || !Number.isInteger(cars) || cars <= 0) continue;
    counts[stationId] = cars;
  }
  return counts;
}
