import { describe, it, expect, vi } from 'vitest';
import {
  createStation,
  friendlyCreateError,
  rejectSuggestion,
  validateNewStation,
  type NewStationInput,
  type RpcClient,
} from './stationAdminService';
import { NIGERIAN_STATES } from '../data/nigerianStates';

const valid: NewStationInput = {
  name: 'NIPCO CNG - Ikeja',
  address: 'Adeola Odeku St, Ikeja',
  city: 'Ikeja',
  state: 'Lagos',
  lat: 6.6,
  lng: 3.35,
  precision: 'rooftop',
};

const fakeClient = (result: { data: unknown; error: { message: string } | null }) => {
  const rpc = vi.fn().mockResolvedValue(result);
  return { client: { rpc } as RpcClient, rpc };
};

describe('validateNewStation', () => {
  it('accepts a complete input', () => {
    expect(validateNewStation(valid)).toBeNull();
  });

  it.each([
    ['a name of spaces only', { name: '   ' }],
    ['a 121-character name', { name: 'a'.repeat(121) }],
    ['a missing address', { address: '' }],
    ['a missing city', { city: '  ' }],
    ['a missing state', { state: '' }],
    ['a missing latitude', { lat: null }],
    ['a missing longitude', { lng: null }],
    ['a point outside Nigeria', { lat: 0, lng: 0 }],
    ['a point just north of Nigeria', { lat: 14.5, lng: 7 }],
  ])('rejects %s with a sentence', (_label, patch) => {
    const message = validateNewStation({ ...valid, ...patch });
    expect(typeof message).toBe('string');
    expect((message as string).length).toBeGreaterThan(5);
  });

  it('accepts a 120-character name', () => {
    expect(validateNewStation({ ...valid, name: 'a'.repeat(120) })).toBeNull();
  });
});

describe('createStation', () => {
  it('trims the text, sends p_* arguments and returns the new id', async () => {
    const { client, rpc } = fakeClient({ data: 'admin-nipco-ikeja-x7k2q9', error: null });
    const result = await createStation(client, {
      ...valid,
      name: '  NIPCO CNG - Ikeja ',
      operator: '  NIPCO ',
      area: '   ',
    });
    expect(result).toEqual({ ok: true, id: 'admin-nipco-ikeja-x7k2q9' });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('admin_create_station', {
      p_name: 'NIPCO CNG - Ikeja',
      p_address: 'Adeola Odeku St, Ikeja',
      p_city: 'Ikeja',
      p_state: 'Lagos',
      p_lat: 6.6,
      p_lng: 3.35,
      p_precision: 'rooftop',
      p_operator: 'NIPCO',
      p_station_type: 'cng',
      p_area: null,
    });
  });

  it('does not call the database when validation fails', async () => {
    const { client, rpc } = fakeClient({ data: 'x', error: null });
    const result = await createStation(client, { ...valid, lat: 0, lng: 0 });
    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns the friendly message, not the raw one, when the database refuses', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'a station with this name already exists' } });
    const result = await createStation(client, valid);
    expect(result).toEqual({ ok: false, error: friendlyCreateError('a station with this name already exists') });
  });

  it('treats a missing id from the database as a failure', async () => {
    const { client } = fakeClient({ data: null, error: null });
    const result = await createStation(client, valid);
    expect(result.ok).toBe(false);
  });
});

describe('friendlyCreateError', () => {
  it('explains a duplicate name', () => {
    expect(friendlyCreateError('a station with this name already exists')).toMatch(/already exists/i);
  });

  it('explains a non-admin caller', () => {
    expect(friendlyCreateError('not authorized')).toBe('Only admins can add stations.');
  });

  it('never shows an unknown database message', () => {
    const text = friendlyCreateError('duplicate key value violates unique constraint "stations_pkey"');
    expect(text).toBe('Could not add the station, try again.');
    expect(text).not.toMatch(/stations_pkey/);
  });
});

describe('suggestions', () => {
  it('createStation sends p_suggestion_id when approving a suggestion', async () => {
    const { client, rpc } = fakeClient({ data: 'admin-x-aaaaaa', error: null });
    await createStation(client, { ...valid, suggestionId: 'suggestion-123' });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_suggestion_id: 'suggestion-123' });
  });

  it('createStation leaves p_suggestion_id out when there is no suggestion', async () => {
    const { client, rpc } = fakeClient({ data: 'admin-x-aaaaaa', error: null });
    await createStation(client, valid);
    expect(Object.keys(rpc.mock.calls[0][1])).not.toContain('p_suggestion_id');
  });

  it('rejectSuggestion calls admin_reject_station_suggestion with p_suggestion_id', async () => {
    const { client, rpc } = fakeClient({ data: null, error: null });
    const result = await rejectSuggestion(client, 'suggestion-123');
    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith('admin_reject_station_suggestion', { p_suggestion_id: 'suggestion-123' });
  });

  it('turns "suggestion already reviewed" into a plain sentence for both actions', async () => {
    const message = 'suggestion already reviewed';
    expect(friendlyCreateError(message)).toBe('Someone already reviewed this suggestion.');
    const { client } = fakeClient({ data: null, error: { message } });
    expect(await rejectSuggestion(client, 'suggestion-123')).toEqual({
      ok: false,
      error: 'Someone already reviewed this suggestion.',
    });
    expect(await createStation(client, { ...valid, suggestionId: 'suggestion-123' })).toEqual({
      ok: false,
      error: 'Someone already reviewed this suggestion.',
    });
  });

  it('never shows an unknown database message when rejecting', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'deadlock detected' } });
    expect(await rejectSuggestion(client, 'suggestion-123')).toEqual({
      ok: false,
      error: 'Could not reject the suggestion, try again.',
    });
  });
});

describe('NIGERIAN_STATES', () => {
  it('lists FCT Abuja plus the 36 states, once each', () => {
    expect(NIGERIAN_STATES).toHaveLength(37);
    expect(new Set(NIGERIAN_STATES).size).toBe(37);
    expect(NIGERIAN_STATES).toEqual(expect.arrayContaining(['FCT Abuja', 'Lagos', 'Rivers', 'Akwa Ibom', 'Cross River']));
  });
});
