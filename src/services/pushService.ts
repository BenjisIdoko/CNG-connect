/// <reference types="vite/client" />
import type { RpcClient } from './stationManagerService';
import { requestNotificationPermission } from '../utils/pushNotificationEngine';

/**
 * Real push notifications: registering this phone (or browser) with the push service and telling the
 * database where to send alerts, with the driver's state and favourite stations so the sender can choose
 * who gets which alert. The pure parts are tested; the browser parts (service worker, permission) only
 * run on a device.
 */

export type PushResult = { ok: true } | { ok: false; error: string };

const GENERIC = 'Could not switch on alerts. Try again';
const MAX_FAVORITES = 100;

export function friendlyPushError(message: string): string {
  const text = (message || '').toLowerCase();
  if (text.includes('not authorized')) return 'Sign in to get alerts';
  return GENERIC;
}

/** The VAPID public key is URL-safe base64; the browser wants bytes. */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const standard = padded.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(standard);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** The address and keys the database needs, or null when the browser gave something incomplete. */
export function subscriptionToRows(json: PushSubscriptionJSON | null | undefined): { endpoint: string; p256dh: string; auth: string } | null {
  const endpoint = json?.endpoint;
  const p256dh = json?.keys?.p256dh;
  const auth = json?.keys?.auth;
  if (!endpoint || !p256dh || !auth) return null;
  return { endpoint, p256dh, auth };
}

export async function savePushSubscription(
  client: RpcClient,
  input: { subscription: PushSubscriptionJSON | null | undefined; state: string | undefined; favorites: string[] },
): Promise<PushResult> {
  const rows = subscriptionToRows(input.subscription);
  if (!rows) return { ok: false, error: 'This phone could not be registered for alerts' };
  try {
    const { error } = await client.rpc('save_push_subscription', {
      p_endpoint: rows.endpoint,
      p_p256dh: rows.p256dh,
      p_auth: rows.auth,
      p_state: input.state?.trim() ? input.state.trim() : null,
      p_favorites: input.favorites.slice(0, MAX_FAVORITES),
    });
    return error ? { ok: false, error: friendlyPushError(error.message) } : { ok: true };
  } catch {
    return { ok: false, error: GENERIC };
  }
}

export async function removePushSubscription(client: RpcClient, endpoint: string): Promise<PushResult> {
  try {
    const { error } = await client.rpc('remove_push_subscription', { p_endpoint: endpoint });
    return error ? { ok: false, error: friendlyPushError(error.message) } : { ok: true };
  } catch {
    return { ok: false, error: GENERIC };
  }
}

export interface PushSupportFacts {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  isIos: boolean;
  /** Running as an installed app (home screen), not in a browser tab. */
  isStandalone: boolean;
  /** The public VAPID key is configured. */
  hasKey: boolean;
}

export type PushSupport = { supported: true } | { supported: false; reason: string };

/** Whether this device can get alerts, and if not, the one sentence that tells the person what to do. */
export const PUSH_NOT_SET_UP_REASON = 'Alerts are not set up yet.';

export function describePushSupport(facts: PushSupportFacts): PushSupport {
  if (!facts.hasKey) return { supported: false, reason: PUSH_NOT_SET_UP_REASON };
  // An iPhone only gets web push from an installed app; a browser tab has no push manager there.
  if (facts.isIos && !facts.isStandalone) {
    return { supported: false, reason: 'On iPhone, add CNG-Connect to your Home Screen first, then switch alerts on.' };
  }
  if (!facts.hasServiceWorker || !facts.hasPushManager || !facts.hasNotification) {
    return { supported: false, reason: "This browser can't receive alerts." };
  }
  return { supported: true };
}

const vapidKey = (): string => (import.meta.env?.VITE_VAPID_PUBLIC_KEY as string | undefined) || '';

/** True once the public VAPID key is configured, i.e. real push alerts are set up for this build. */
export const isPushKeyConfigured = (): boolean => Boolean(vapidKey());

export function detectPushSupport(): PushSupport {
  if (typeof window === 'undefined') return { supported: false, reason: "This browser can't receive alerts." };
  const ua = navigator.userAgent || '';
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches === true || (navigator as unknown as { standalone?: boolean }).standalone === true;
  return describePushSupport({
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window,
    hasNotification: 'Notification' in window,
    isIos,
    isStandalone,
    hasKey: Boolean(vapidKey()),
  });
}

/** This phone's current push registration, or null when it has none (or cannot have one). */
export async function getThisDeviceSubscription(): Promise<PushSubscription | null> {
  try {
    if (!detectPushSupport().supported) return null;
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export interface PushDeviceInput {
  client: RpcClient;
  state: string | undefined;
  favorites: string[];
}

/** Asks permission, registers this phone with the push service, and tells the database. */
export async function subscribeThisDevice({ client, state, favorites }: PushDeviceInput): Promise<PushResult> {
  const support = detectPushSupport();
  if (!support.supported) return { ok: false, error: support.reason };
  try {
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      return { ok: false, error: 'Alerts are blocked in your browser settings. Allow notifications for this site, then try again.' };
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey()) as BufferSource,
      }));
    return await savePushSubscription(client, { subscription: subscription.toJSON(), state, favorites });
  } catch {
    return { ok: false, error: GENERIC };
  }
}

/** Stops alerts on this phone: removes it from the database, then from the push service. */
export async function unsubscribeThisDevice(client: RpcClient): Promise<PushResult> {
  const subscription = await getThisDeviceSubscription();
  if (!subscription) return { ok: true };
  const removed = await removePushSubscription(client, subscription.endpoint);
  try {
    await subscription.unsubscribe();
  } catch {
    /* already gone */
  }
  return removed;
}

/** Keeps the saved state and favourites in step with the app; does nothing when this phone has no registration. */
export async function syncThisDevice({ client, state, favorites }: PushDeviceInput): Promise<PushResult> {
  const subscription = await getThisDeviceSubscription();
  if (!subscription) return { ok: true };
  return savePushSubscription(client, { subscription: subscription.toJSON(), state, favorites });
}

/** Show the one-time "get an alert?" question only at the right moment: just after a favourite is added. */
export function shouldAskForAlerts(facts: {
  added: boolean;
  isAuthenticated: boolean;
  supported: boolean;
  alreadyOn: boolean;
  alreadyAsked: boolean;
}): boolean {
  return facts.added && facts.isAuthenticated && facts.supported && !facts.alreadyOn && !facts.alreadyAsked;
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;
const PROMPT_KEY = 'cng_push_prompt_seen';

const defaultStorage = (): KeyValueStorage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

export function wasPushPromptSeen(storage: KeyValueStorage | null = defaultStorage()): boolean {
  try {
    return storage?.getItem(PROMPT_KEY) === '1';
  } catch {
    return false;
  }
}

export function markPushPromptSeen(storage: KeyValueStorage | null = defaultStorage()): void {
  try {
    storage?.setItem(PROMPT_KEY, '1');
  } catch {
    /* storage blocked: the question may be asked again */
  }
}

/**
 * What the Profile alerts switch should show. With real alerts set up it is whether THIS phone is registered:
 * the browser keeps its notification permission after alerts are switched off, so permission alone would show
 * "on" for a phone that is no longer registered. Before they are set up it keeps its older meaning.
 */
export function pushSwitchState(facts: { keyConfigured: boolean; subscribed: boolean; permissionGranted: boolean }): boolean {
  return facts.keyConfigured ? facts.subscribed : facts.permissionGranted;
}
