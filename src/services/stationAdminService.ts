import { isInNigeria, type PinTier } from '../utils/geoInput';

// Limits mirror supabase/admin-create-station.sql.
const NAME_MAX = 120;
const ADDRESS_MAX = 300;
const CITY_STATE_MAX = 80;

export interface NewStationInput {
  name: string;
  address: string;
  city: string;
  state: string;
  operator?: string;
  area?: string;
  stationType?: 'cng' | 'ev_charging';
  lat: number | null;
  lng: number | null;
  precision: PinTier;
}

export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

/** The part of a Supabase client this service needs (so tests can pass a fake). */
export interface RpcClient {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

/** The first problem with the input as a sentence for the admin, or null when it is fine. */
export function validateNewStation(input: NewStationInput): string | null {
  const name = input.name.trim();
  if (!name) return 'Enter the station name.';
  if (name.length > NAME_MAX) return `The station name is too long (${NAME_MAX} characters at most).`;

  const address = input.address.trim();
  if (!address) return 'Enter the address.';
  if (address.length > ADDRESS_MAX) return `The address is too long (${ADDRESS_MAX} characters at most).`;

  const city = input.city.trim();
  if (!city) return 'Enter the city.';
  if (city.length > CITY_STATE_MAX) return `The city is too long (${CITY_STATE_MAX} characters at most).`;

  const state = input.state.trim();
  if (!state) return 'Choose the state.';
  if (state.length > CITY_STATE_MAX) return `The state is too long (${CITY_STATE_MAX} characters at most).`;

  if (input.lat === null || input.lng === null) return 'Place the station on the map or paste its coordinates.';
  if (!isInNigeria(input.lat, input.lng)) return 'That position is outside Nigeria.';
  return null;
}

/** Plain-language text for a database error. Unknown messages are never shown to the admin. */
export function friendlyCreateError(message: string): string {
  if (/not authorized/i.test(message)) return 'Only admins can add stations.';
  if (/already exists/i.test(message)) {
    return 'A station with this name already exists. Check the map, or use a more specific name.';
  }
  return 'Could not add the station, try again.';
}

const orNull = (value: string | undefined): string | null => {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
};

/** Validates, then creates the station through the admin-only database function. */
export async function createStation(client: RpcClient, input: NewStationInput): Promise<CreateResult> {
  const problem = validateNewStation(input);
  if (problem) return { ok: false, error: problem };

  const { data, error } = await client.rpc('admin_create_station', {
    p_name: input.name.trim(),
    p_address: input.address.trim(),
    p_city: input.city.trim(),
    p_state: input.state.trim(),
    p_lat: input.lat,
    p_lng: input.lng,
    p_precision: input.precision,
    p_operator: orNull(input.operator),
    p_station_type: input.stationType ?? 'cng',
    p_area: orNull(input.area),
  });

  if (error) return { ok: false, error: friendlyCreateError(error.message) };
  if (typeof data !== 'string' || data === '') return { ok: false, error: friendlyCreateError('') };
  return { ok: true, id: data };
}
