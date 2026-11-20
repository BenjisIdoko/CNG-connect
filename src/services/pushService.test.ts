import { describe, expect, it, vi } from 'vitest';
import {
  describePushSupport,
  describeTestAlertOutcome,
  markPushPromptSeen,
  pushSwitchState,
  shouldAskForAlerts,
  wasPushPromptSeen,
  friendlyPushError,
  removePushSubscription,
  savePushSubscription,
  sendTestAlert,
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

describe('pushSwitchState', () => {
  it('with alerts set up, the switch shows whether THIS phone is registered, whatever the browser permission says', () => {
    expect(pushSwitchState({ keyConfigured: true, subscribed: true, permissionGranted: true })).toBe(true);
    // switched off earlier: permission stays "granted" in the browser, but the phone is no longer registered
    expect(pushSwitchState({ keyConfigured: true, subscribed: false, permissionGranted: true })).toBe(false);
    expect(pushSwitchState({ keyConfigured: true, subscribed: true, permissionGranted: false })).toBe(true);
  });

  it('before alerts are set up on the server, it keeps the older meaning: the browser permission', () => {
    expect(pushSwitchState({ keyConfigured: false, subscribed: false, permissionGranted: true })).toBe(true);
    expect(pushSwitchState({ keyConfigured: false, subscribed: false, permissionGranted: false })).toBe(false);
  });
});

describe('describeTestAlertOutcome', () => {
  it('says the alert was sent when at least one phone took it', () => {
    expect(describeTestAlertOutcome(200, { sent: 1, devices: 1, removed: 0 })).toEqual({
      ok: true,
      message: 'Test alert sent. It should arrive in a few seconds.',
    });
    expect(describeTestAlertOutcome(200, { sent: 1, devices: 2, removed: 1 }).ok).toBe(true);
  });

  it('tells the person to switch alerts on when this phone is not registered', () => {
    expect(describeTestAlertOutcome(200, { sent: 0, devices: 0, removed: 0 })).toEqual({
      ok: false,
      message: 'This phone is not registered for alerts. Switch alerts on first.',
    });
  });

  it('tells the person to switch alerts off and on again when the phone is known but nothing was delivered', () => {
    expect(describeTestAlertOutcome(200, { sent: 0, devices: 1, removed: 1 })).toEqual({
      ok: false,
      message: 'The test alert could not be delivered. Switch alerts off and on again, then try once more.',
    });
  });

  it('turns every failure status into plain text and never echoes the server', () => {
    expect(describeTestAlertOutcome(503, { error: 'Alerts are not set up yet.' })).toEqual({ ok: false, message: 'Alerts are not set up yet.' });
    expect(describeTestAlertOutcome(401, { error: 'secret' })).toEqual({ ok: false, message: 'Sign in again, then try once more.' });
    expect(describeTestAlertOutcome(429, {})).toEqual({ ok: false, message: 'Wait a minute, then try again.' });
    expect(describeTestAlertOutcome(500, { error: 'boom secret' })).toEqual({ ok: false, message: 'Could not send the test alert. Try again.' });
    expect(describeTestAlertOutcome(200, null)).toEqual({ ok: false, message: 'Could not send the test alert. Try again.' });
  });
});

describe('sendTestAlert', () => {
  const reply = (status: number, body: unknown) => vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body });

  it('asks the server for a test alert to this phone, with the sign-in token', async () => {
    const fetchFn = reply(200, { sent: 1, devices: 1, removed: 0 });
    const result = await sendTestAlert({ accessToken: 'tok', endpoint: 'https://push.example/abc', fetchFn });
    expect(result).toEqual({ ok: true, message: 'Test alert sent. It should arrive in a few seconds.' });
    expect(fetchFn).toHaveBeenCalledWith('/api/notify-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify({ endpoint: 'https://push.example/abc' }),
    });
  });

  it('does not call the server, and says so, when it does not know which phone this is (this phone is not registered)', async () => {
    const fetchFn = reply(200, { sent: 1, devices: 1, removed: 0 });
    expect(await sendTestAlert({ accessToken: 'tok', endpoint: undefined, fetchFn })).toEqual({
      ok: false,
      message: 'This phone is not registered for alerts. Switch alerts on first.',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('needs a sign-in and does not call the server without one', async () => {
    const fetchFn = vi.fn();
    expect(await sendTestAlert({ accessToken: '', endpoint: 'https://push.example/abc', fetchFn })).toEqual({ ok: false, message: 'Sign in to send a test alert.' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('survives a network failure and an unreadable reply', async () => {
    expect(await sendTestAlert({ accessToken: 't', endpoint: 'https://push.example/abc', fetchFn: vi.fn().mockRejectedValue(new Error('offline')) })).toEqual({
      ok: false,
      message: 'Could not reach the server. Check your internet and try again.',
    });
    const bad = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('not json'); } });
    expect(await sendTestAlert({ accessToken: 't', endpoint: 'https://push.example/abc', fetchFn: bad })).toEqual({
      ok: false,
      message: 'Could not send the test alert. Try again.',
    });
  });
});

