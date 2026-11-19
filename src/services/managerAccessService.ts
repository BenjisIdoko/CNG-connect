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
