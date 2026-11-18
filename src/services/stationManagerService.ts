import { isValidPressure } from '../utils/stationManagerSignals';

/**
 * What a station manager can post: "selling now / not selling" and the pump pressure. Both go
 * through database functions that check the caller manages that station, so this file only
 * validates input and turns database errors into plain language.
 */

export type ManagerPostResult = { ok: true } | { ok: false; error: string };

/** The one method of the Supabase client these functions use, so tests can pass a fake. */
export interface RpcClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
}

const GENERIC_ERROR = 'Could not post, try again';

/** Plain-language text for a database error. Unknown errors never leak the raw message. */
export function friendlyManagerError(message: string): string {
  const text = (message || '').toLowerCase();
  if (text.includes('not authorized')) {
    return "You're no longer a manager of this station. Ask an admin to add you again.";
  }
  if (text.includes('invalid pressure')) {
    return 'Pressure must be a whole number from 10 to 300 bar';
  }
  return GENERIC_ERROR;
}

const call = async (client: RpcClient, fn: string, args: Record<string, unknown>): Promise<ManagerPostResult> => {
  try {
    const { error } = await client.rpc(fn, args);
    return error ? { ok: false, error: friendlyManagerError(error.message) } : { ok: true };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
};

export const postSelling = (client: RpcClient, stationId: string, selling: boolean): Promise<ManagerPostResult> =>
  call(client, 'manager_post_selling', { p_station_id: stationId, p_selling: selling });

export const postPressure = (client: RpcClient, stationId: string, bar: number): Promise<ManagerPostResult> => {
  if (!isValidPressure(bar)) {
    return Promise.resolve({ ok: false, error: friendlyManagerError('Invalid pressure') });
  }
  return call(client, 'manager_post_pressure', { p_station_id: stationId, p_bar: bar });
};
