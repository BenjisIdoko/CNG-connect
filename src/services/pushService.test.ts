import { describe, expect, it, vi } from 'vitest';
import {
  describePushSupport,
  markPushPromptSeen,
  shouldAskForAlerts,
  wasPushPromptSeen,
  friendlyPushError,
  removePushSubscription,
  savePushSubscription,
  subscriptionToRows,
  urlBase64ToUint8Array,
} from './pushService';

const clientReturning = (error: { message: string } | null = null) => ({ rpc: vi.fn().mockResolvedValue({ data: null, error }) });

describe('urlBase64ToUint8Array', () => {
  it('turns the URL-safe base64 VAPID key into bytes', () => {
    // "hello" = aGVsbG8 (no padding, URL-safe alphabet allowed)
    expect(Array.from(urlBase64ToUint8Array('aGVsbG8'))).toEqual([104, 101, 108, 108, 111]);
    // '-' and '_' stand for '+' and '/': 0xfb 0xff 0xfe
    expect(Array.from(urlBase64ToUint8Array('-__-'))).toEqual([0xfb, 0xff, 0xfe]);
  });
});

describe('subscriptionToRows', () => {
  it('reads the address and the two keys', () => {
    expect(subscriptionToRows({ endpoint: 'https://push.example/abc', keys: { p256dh: 'P', auth: 'A' } })).toEqual({
      endpoint: 'https://push.example/abc',
      p256dh: 'P',
      auth: 'A',
    });
  });

  it('is null when anything is missing', () => {
    expect(subscriptionToRows({ endpoint: 'https://x', keys: { p256dh: 'P' } })).toBeNull();
    expect(subscriptionToRows({ keys: { p256dh: 'P', auth: 'A' } })).toBeNull();
    expect(subscriptionToRows(null)).toBeNull();
  });
});

describe('savePushSubscription / removePushSubscription', () => {
  const subscription = { endpoint: 'https://push.example/abc', keys: { p256dh: 'P', auth: 'A' } };

  it('sends the phone, the state and the favourites', async () => {
    const client = clientReturning();
    await expect(savePushSubscription(client, { subscription, state: 'Abuja FCT', favorites: ['s1', 's2'] })).resolves.toEqual({ ok: true });
    expect(client.rpc).toHaveBeenCalledWith('save_push_subscription', {
      p_endpoint: 'https://push.example/abc',
      p_p256dh: 'P',
      p_auth: 'A',
      p_state: 'Abuja FCT',
      p_favorites: ['s1', 's2'],
    });
  });

  it('sends no state as null, and caps favourites at 100 so the database never refuses a long list', async () => {
    const client = clientReturning();
    const many = Array.from({ length: 150 }, (_, i) => `s${i}`);
    await savePushSubscription(client, { subscription, state: undefined, favorites: many });
    const args = client.rpc.mock.calls[0][1] as { p_state: unknown; p_favorites: string[] };
    expect(args.p_state).toBeNull();
    expect(args.p_favorites).toHaveLength(100);
  });

  it('refuses an incomplete subscription without calling the database', async () => {
    const client = clientReturning();
    expect(await savePushSubscription(client, { subscription: { endpoint: 'https://x' }, state: 'Lagos', favorites: [] })).toEqual({
      ok: false,
      error: 'This phone could not be registered for alerts',
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('turns database errors into plain text and never echoes an unknown one', async () => {
    expect(await savePushSubscription(clientReturning({ message: 'not authorized' }), { subscription, state: 'Lagos', favorites: [] })).toEqual({
      ok: false,
      error: 'Sign in to get alerts',
    });
    expect(await savePushSubscription(clientReturning({ message: 'secret detail 500' }), { subscription, state: 'Lagos', favorites: [] })).toEqual({
      ok: false,
      error: 'Could not switch on alerts. Try again',
    });
  });

  it('removes by address', async () => {
    const client = clientReturning();
    await expect(removePushSubscription(client, 'https://push.example/abc')).resolves.toEqual({ ok: true });
    expect(client.rpc).toHaveBeenCalledWith('remove_push_subscription', { p_endpoint: 'https://push.example/abc' });
  });
});

describe('friendlyPushError', () => {
  it('maps the known messages', () => {
    expect(friendlyPushError('not authorized')).toBe('Sign in to get alerts');
    expect(friendlyPushError('')).toBe('Could not switch on alerts. Try again');
  });
});

describe('describePushSupport', () => {
  const all = { hasServiceWorker: true, hasPushManager: true, hasNotification: true, isIos: false, isStandalone: false, hasKey: true };

  it('is supported when the browser can and the key exists', () => {
    expect(describePushSupport(all)).toEqual({ supported: true });
  });

  it('says alerts are not set up when the public key is missing', () => {
    expect(describePushSupport({ ...all, hasKey: false })).toEqual({ supported: false, reason: 'Alerts are not set up yet.' });
  });

  it('tells an iPhone user to add the app to the Home Screen first', () => {
    expect(describePushSupport({ ...all, isIos: true, hasPushManager: false })).toEqual({
      supported: false,
      reason: 'On iPhone, add CNG-Connect to your Home Screen first, then switch alerts on.',
    });
    expect(describePushSupport({ ...all, isIos: true, isStandalone: true })).toEqual({ supported: true });
  });

  it('says so when the browser cannot receive alerts at all', () => {
    expect(describePushSupport({ ...all, hasPushManager: false })).toEqual({ supported: false, reason: "This browser can't receive alerts." });
    expect(describePushSupport({ ...all, hasNotification: false })).toEqual({ supported: false, reason: "This browser can't receive alerts." });
    expect(describePushSupport({ ...all, hasServiceWorker: false })).toEqual({ supported: false, reason: "This browser can't receive alerts." });
  });
});

describe('shouldAskForAlerts', () => {
  const base = { added: true, isAuthenticated: true, supported: true, alreadyOn: false, alreadyAsked: false };

  it('asks once, right after a signed-in driver favourites a station on a device that can get alerts', () => {
    expect(shouldAskForAlerts(base)).toBe(true);
  });

  it('does not ask when removing a favourite, when signed out, when alerts cannot work, when already on, or when asked before', () => {
    expect(shouldAskForAlerts({ ...base, added: false })).toBe(false);
    expect(shouldAskForAlerts({ ...base, isAuthenticated: false })).toBe(false);
    expect(shouldAskForAlerts({ ...base, supported: false })).toBe(false);
    expect(shouldAskForAlerts({ ...base, alreadyOn: true })).toBe(false);
    expect(shouldAskForAlerts({ ...base, alreadyAsked: true })).toBe(false);
  });
});

describe('the "already asked" memory', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  };

  it('remembers that the question was shown', () => {
    const storage = memory();
    expect(wasPushPromptSeen(storage)).toBe(false);
    markPushPromptSeen(storage);
    expect(wasPushPromptSeen(storage)).toBe(true);
  });

  it('never throws when storage is blocked, and then asks again rather than failing', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => markPushPromptSeen(broken)).not.toThrow();
    expect(wasPushPromptSeen(broken)).toBe(false);
  });
});

