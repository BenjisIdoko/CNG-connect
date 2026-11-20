import type { RpcClient } from './rpcClient';

/**
 * A community manager's post: "Gas available" or "Gas not available" for the station they are at. The
 * phone checks the distance first (to tell them plainly), and the database checks it again: that is the
 * real check. Database errors become plain sentences; an unknown error is never echoed.
 */

export type CommunityPostResult = { ok: true } | { ok: false; error: string };

const GENERIC = 'Could not post. Try again';

export function friendlyCommunityPostError(message: string): string {
  const text = (message || '').toLowerCase();
  if (text.includes('already posted')) return 'You already posted that a moment ago.';
  if (text.includes('not authorized')) return "Your account can't post for stations.";
  if (text.includes('no station')) return 'That station no longer exists.';
  return GENERIC;
}

export async function postCommunityGas(
  client: RpcClient,
  input: { stationId: string; available: boolean },
): Promise<CommunityPostResult> {
  try {
    const { error } = await client.rpc('community_post_gas', {
      p_station_id: input.stationId,
      p_available: input.available,
    });
    return error ? { ok: false, error: friendlyCommunityPostError(error.message) } : { ok: true };
  } catch {
    return { ok: false, error: GENERIC };
  }
}

/**
 * Right after a successful post, asks the server to alert the drivers who opted in. The server checks
 * the caller's sign-in and that they really just posted, and takes the status from that post, so only the
 * station id is sent. Best effort: a failure never affects the post, which has already been saved.
 */
export async function notifyGasPost({
  accessToken,
  stationId,
  fetchFn = fetch,
}: {
  accessToken: string;
  stationId: string;
  fetchFn?: typeof fetch;
}): Promise<boolean> {
  if (!accessToken) return false;
  try {
    const response = await fetchFn('/api/notify-gas-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ stationId }),
    });
    return Boolean(response.ok);
  } catch {
    return false;
  }
}
