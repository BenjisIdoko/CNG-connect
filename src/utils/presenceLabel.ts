import type { StationStatus } from '../types';

/**
 * The line under a station's address that says who is at the station: "1 car here - queuing",
 * "3 cars here". Null when nobody is. "queuing" is added only while the station's current
 * status is Queuing.
 */
export function describePresence(count: number, currentStatus: StationStatus): string | null {
  if (!(count > 0)) return null;
  const cars = `${count} ${count === 1 ? 'car' : 'cars'} here`;
  return currentStatus === 'queue' ? `${cars} - queuing` : cars;
}
