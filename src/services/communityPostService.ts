import { checkReportPosition, type PingPosition } from '../utils/geofencePresence';
import type { RpcClient } from './stationManagerService';

/**
 * A community manager's post: "Gas available" or "Gas not available" for the station they are at. The
 * phone checks the distance first (to tell them plainly), and the database checks it again: that is the
 * real check. Database errors become plain sentences; an unknown error is never echoed.
 */

export type CommunityPostResult = { ok: true } | { ok: false; error: string };

const GENERIC = 'Could not post. Try again';

export function friendlyCommunityPostError(message: string): string {
  const text = (message || '').toLowerCase();
  if (text.includes('too far')) return 'You need to be within 150 m of the station to post.';
  if (text.includes('already posted')) return 'You already posted that a moment ago.';
  if (text.includes('not authorized')) return "Your account can't post for stations.";
  if (text.includes('location required')) return 'Turn on location to post.';
  if (text.includes('no station')) return 'That station no longer exists.';
  return GENERIC;
}

/** The sentence to show when this GPS fix does not allow a post at this station, or null when it does. */
export function communityPostPositionProblem(
  position: PingPosition | null | undefined,
  station: { lat: number; lng: number },
): string | null {
  const check = checkReportPosition(position, station);
  if (check.allowed) return null;
  if (!position) return 'Turn on location to post.';
  // The report check's "Reports unlock…" sentence is about reports; say the same thing about posting.
  if (check.reason.startsWith('Reports unlock')) {
    return 'Posting unlocks within 150 m of the station, so every update comes from someone actually there.';
  }
  return check.reason;
}

export async function postCommunityGas(
  client: RpcClient,
  input: { stationId: string; available: boolean; position: PingPosition | null },
): Promise<CommunityPostResult> {
  if (!input.position) return { ok: false, error: 'Turn on location to post.' };
  try {
    const { error } = await client.rpc('community_post_gas', {
      p_station_id: input.stationId,
      p_available: input.available,
      p_lat: input.position.lat,
      p_lng: input.position.lng,
    });
    return error ? { ok: false, error: friendlyCommunityPostError(error.message) } : { ok: true };
  } catch {
    return { ok: false, error: GENERIC };
  }
}
