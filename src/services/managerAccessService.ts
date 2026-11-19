import { friendlyManagerError, ManagerPostResult, RpcClient } from './stationManagerService';
import { MANAGER_STATE_OPTIONS, ManagerState } from '../utils/managerState';

/**
 * Station manager access and the three-state status. The admin invites a manager by email (no driver
 * account needed); the manager claims the invite when they first sign in with an emailed code; and a
 * manager posts Closed, Open (waiting for gas) or Open (gas available). Every call goes through a
 * database function that does the real permission check; this file validates input and turns database
 * errors into plain language.
 */

const INVITE_ERROR = 'Could not invite, try again';

/** True for a normal-looking address: one @, text on both sides, a dot in the domain, no spaces. */
export function isPlausibleEmail(raw: string): boolean {
  const email = (raw || '').trim();
  if (email.length < 5 || email.length > 254) return false;
  if (/\s/.test(email)) return false;
  const at = email.indexOf('@');
  if (at < 1 || at !== email.lastIndexOf('@')) return false;
  const domain = email.slice(at + 1);
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
}

/** Plain-language text for an admin-side database error. Unknown errors never leak the raw message. */
export function friendlyAccessError(message: string): string {
  const text = (message || '').toLowerCase();
  if (text.includes('invalid email')) return "That doesn't look like an email address";
  if (text.includes('not authorized')) return 'Only the app admin can invite managers';
  if (text.includes('no station')) return 'That station no longer exists';
  return INVITE_ERROR;
}

const VALID_STATES = new Set<string>(MANAGER_STATE_OPTIONS.map((o) => o.state));

export async function postManagerState(client: RpcClient, stationId: string, state: ManagerState): Promise<ManagerPostResult> {
  if (!VALID_STATES.has(state)) return { ok: false, error: 'Choose Closed, Open or Open with gas' };
  try {
    const { error } = await client.rpc('manager_post_state', { p_station_id: stationId, p_state: state });
    return error ? { ok: false, error: friendlyManagerError(error.message) } : { ok: true };
  } catch {
    return { ok: false, error: 'Could not post, try again' };
  }
}

export type InviteResult = { ok: true; result: 'assigned' | 'invited' } | { ok: false; error: string };

/** Invites an email to manage a station. "assigned" means that email already had an account. */
export async function inviteStationManager(client: RpcClient, stationId: string, email: string): Promise<InviteResult> {
  if (!isPlausibleEmail(email)) return { ok: false, error: "That doesn't look like an email address" };
  if (!stationId) return { ok: false, error: 'Choose a station first' };
  try {
    const { data, error } = await client.rpc('admin_invite_station_manager', {
      p_station_id: stationId,
      p_email: email.trim().toLowerCase(),
    });
    if (error) return { ok: false, error: friendlyAccessError(error.message) };
    return { ok: true, result: data === 'assigned' ? 'assigned' : 'invited' };
  } catch {
    return { ok: false, error: INVITE_ERROR };
  }
}

export type SendInviteResult =
  | { ok: true; result: 'assigned' | 'invited'; emailed: boolean }
  | { ok: false; error: string };

type InviteFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;

/**
 * Invites an email and has the server email them. The server runs the same database function with the
 * admin's own token, so the permission check is unchanged. If the endpoint is not there (local dev) or
 * cannot be reached, the invite is saved directly instead and reported as not emailed.
 */
export async function sendManagerInvite(args: {
  accessToken: string;
  stationId: string;
  email: string;
  client: RpcClient;
  fetchFn?: InviteFetch;
}): Promise<SendInviteResult> {
  const { accessToken, stationId, client } = args;
  const email = args.email.trim().toLowerCase();
  if (!isPlausibleEmail(email)) return { ok: false, error: "That doesn't look like an email address" };
  if (!stationId) return { ok: false, error: 'Choose a station first' };

  const fallback = async (): Promise<SendInviteResult> => {
    const saved = await inviteStationManager(client, stationId, email);
    return saved.ok ? { ok: true, result: saved.result, emailed: false } : saved;
  };

  const fetchFn = args.fetchFn ?? ((url, init) => fetch(url, init));
  let response: Awaited<ReturnType<InviteFetch>>;
  try {
    response = await fetchFn('/api/invite-manager', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ stationId, email }),
    });
  } catch {
    return fallback();
  }

  if (response.status === 404 || response.status === 405 || response.status === 503) return fallback();

  let body: any = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    return { ok: false, error: typeof body?.error === 'string' && body.error ? body.error : INVITE_ERROR };
  }
  return { ok: true, result: body?.result === 'assigned' ? 'assigned' : 'invited', emailed: body?.emailed === true };
}

/** The toast the admin sees after inviting: always says whether the email actually went out. */
export function describeInviteOutcome(result: { result: 'assigned' | 'invited'; emailed: boolean }): string {
  if (result.result === 'assigned') {
    return result.emailed
      ? 'Added and emailed: that email already had an account'
      : 'Added: that email already had an account. The email did not go out';
  }
  return result.emailed
    ? 'Invite saved and emailed. They can sign in now'
    : 'Invite saved, but the email did not go out. Ask them to open /station-manager';
}

export async function cancelStationManagerInvite(client: RpcClient, stationId: string, email: string): Promise<ManagerPostResult> {
  try {
    const { error } = await client.rpc('admin_cancel_station_manager_invite', {
      p_station_id: stationId,
      p_email: email.trim().toLowerCase(),
    });
    return error ? { ok: false, error: friendlyAccessError(error.message) } : { ok: true };
  } catch {
    return { ok: false, error: 'Could not cancel the invite, try again' };
  }
}

export type ClaimResult = { ok: true; claimed: number } | { ok: false; error: string };

/** Called after a manager signs in: turns invites for their verified email into station assignments. */
export async function claimManagerInvites(client: RpcClient): Promise<ClaimResult> {
  try {
    const { data, error } = await client.rpc('claim_station_manager_invites', {});
    if (error) return { ok: false, error: 'Could not check for your stations, try again' };
    return { ok: true, claimed: typeof data === 'number' && data > 0 ? data : 0 };
  } catch {
    return { ok: false, error: 'Could not check for your stations, try again' };
  }
}
