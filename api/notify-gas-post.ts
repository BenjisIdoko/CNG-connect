import { createClient } from '@supabase/supabase-js';
import * as webpush from 'web-push';

/**
 * Sends a push notification when a community manager has just posted "Gas available" or "Gas not
 * available" for a station. The caller is the community manager's own phone, right after the post; this
 * function does not trust that: it checks the caller's sign-in, that they hold the community manager role,
 * and that they really posted for this station in the last few minutes, and it takes the status from that
 * post, not from the request. Who is told: drivers registered in the station's state, plus anyone who
 * favourited the station, never the poster. Rules against noise: at most one notification per station every
 * 15 minutes, and the same status is not repeated within 6 hours.
 *
 * Self-contained on purpose: a helper file under api/ is not bundled into the serverless function (the first
 * invite deploy failed with ERR_MODULE_NOT_FOUND). Needs these settings in Vercel: SUPABASE_SERVICE_ROLE_KEY,
 * VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (and SUPABASE_URL or VITE_SUPABASE_URL). Without them
 * it answers 503 and sends nothing. Provider errors are never echoed back.
 */

export interface NotificationPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export interface Subscriber {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  state: string | null;
  favorite_station_ids: string[] | null;
}

const oneLine = (value: string) => value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();

/** The text a driver reads. It names the station and the city, never a person. */
export function buildNotification({
  stationId,
  stationName,
  city,
  available,
}: {
  stationId: string;
  stationName: string;
  city: string;
  available: boolean;
}): NotificationPayload {
  const name = oneLine(stationName).slice(0, 80) || 'a station';
  const place = oneLine(city).slice(0, 60);
  return {
    title: `${available ? 'Gas available' : 'Gas not available'} at ${name}`,
    body: place ? `A community manager says · ${place}` : 'A community manager says',
    url: `/?station=${encodeURIComponent(stationId)}`,
    tag: `station-${stationId}`,
  };
}

// Copied from src/utils/permissionManager.ts (api files cannot import from src); a test keeps them identical.
export function normalizeState(stateStr?: string | null): string {
  if (!stateStr) return '';
  const lower = stateStr.toLowerCase().trim();
  if (lower.includes('abuja') || lower.includes('fct')) return 'abuja fct';
  if (lower.includes('lagos')) return 'lagos';
  if (lower.includes('edo') || lower.includes('benin')) return 'edo';
  if (lower.includes('oyo') || lower.includes('ibadan')) return 'oyo';
  if (lower.includes('rivers') || lower.includes('ph') || lower.includes('port harcourt')) return 'rivers';
  if (lower.includes('kano')) return 'kano';
  if (lower.includes('ogun') || lower.includes('abeokuta')) return 'ogun';
  if (lower.includes('delta') || lower.includes('warri')) return 'delta';
  if (lower.includes('kaduna')) return 'kaduna';
  if (lower.includes('katsina')) return 'katsina';
  if (lower.includes('enugu')) return 'enugu';
  if (lower.includes('imo')) return 'imo';
  if (lower.includes('ondo')) return 'ondo';
  if (lower.includes('osun')) return 'osun';
  if (lower.includes('ekiti')) return 'ekiti';
  return lower.replace(/\s*(state|\(.*\))/gi, '').trim();
}

export function sameState(a?: string | null, b?: string | null): boolean {
  const left = normalizeState(a);
  const right = normalizeState(b);
  return left !== '' && left === right;
}

const MINUTE = 60_000;
const MIN_GAP_MS = 15 * MINUTE;
const SAME_STATUS_MS = 6 * 60 * MINUTE;

/** Whether this post should notify anyone, given the last notification sent for the station. */
export function shouldNotify({
  last,
  state,
  now,
}: {
  last: { state: string; sentAt: number } | null;
  state: string;
  now: number;
}): { send: true } | { send: false; reason: 'recent' | 'unchanged' } {
  if (!last) return { send: true };
  if (now - last.sentAt < MIN_GAP_MS) return { send: false, reason: 'recent' };
  if (last.state === state && now - last.sentAt < SAME_STATUS_MS) return { send: false, reason: 'unchanged' };
  return { send: true };
}

/** The registered phones to tell: same state or favourited, never the poster, each phone once. */
export function pickAudience(subscribers: Subscriber[], station: { id: string; state?: string | null }, posterId: string): Subscriber[] {
  const seen = new Set<string>();
  const chosen: Subscriber[] = [];
  for (const sub of subscribers) {
    if (sub.user_id === posterId || seen.has(sub.endpoint)) continue;
    const favourited = (sub.favorite_station_ids || []).includes(station.id);
    if (favourited || sameState(sub.state, station.state)) {
      seen.add(sub.endpoint);
      chosen.push(sub);
    }
  }
  return chosen;
}

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(userId, recent);
    return true;
  }
  recent.push(now);
  hits.set(userId, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

function send(res: any, status: number, body: Record<string, unknown>) {
  if (res && typeof res.status === 'function') return res.status(status).json(body);
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function bearerToken(req: any): string | null {
  const header = req.headers?.get ? req.headers.get('authorization') : req.headers?.authorization;
  const match = /^Bearer\s+(.+)$/i.exec(String(header || ''));
  return match ? match[1].trim() : null;
}

const POST_MAX_AGE_MS = 5 * MINUTE;
const CHUNK = 25;

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return send(res, 200, {});
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT;
    if (!supabaseUrl || !serviceKey || !vapidPublic || !vapidPrivate || !vapidSubject) {
      return send(res, 503, { error: 'Alerts are not set up yet.' });
    }

    const token = bearerToken(req);
    if (!token) return send(res, 401, { error: 'Sign in first.' });

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return send(res, 400, { error: 'Invalid request.' });
      }
    }
    const stationId = typeof body?.stationId === 'string' ? body.stationId.trim() : '';
    if (!stationId || stationId.length > 100) return send(res, 400, { error: 'Invalid request.' });

    const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: userData, error: userError } = await service.auth.getUser(token);
    if (userError || !userData?.user) return send(res, 401, { error: 'Sign in again.' });
    const posterId = userData.user.id;
    if (rateLimited(posterId)) return send(res, 429, { error: 'Too many requests. Try again in a minute.' });

    // Only a community manager can cause a notification.
    const { data: role } = await service.from('community_managers').select('user_id').eq('user_id', posterId).maybeSingle();
    if (!role) return send(res, 403, { error: 'Not allowed.' });

    // What gets announced comes from the caller's own latest post, not from the request.
    const { data: latest } = await service
      .from('station_manager_posts')
      .select('state, created_at')
      .eq('station_id', stationId)
      .eq('user_id', posterId)
      .eq('kind', 'state')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const postedAt = latest ? Date.parse(latest.created_at) : NaN;
    if (!latest || (latest.state !== 'selling' && latest.state !== 'out') || !Number.isFinite(postedAt) || Date.now() - postedAt > POST_MAX_AGE_MS) {
      return send(res, 409, { error: 'No recent post to announce.' });
    }

    const { data: station } = await service.from('stations').select('id, name, city, state').eq('id', stationId).maybeSingle();
    if (!station) return send(res, 404, { error: 'No such station.' });

    const { data: lastLog } = await service
      .from('push_notification_log')
      .select('state, sent_at')
      .eq('station_id', stationId)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const decision = shouldNotify({
      last: lastLog ? { state: lastLog.state, sentAt: Date.parse(lastLog.sent_at) } : null,
      state: latest.state,
      now: Date.now(),
    });
    if (!decision.send) return send(res, 200, { sent: 0, skipped: decision.reason });

    // Claim the slot, atomically in the database, before sending: two simultaneous requests cannot both
    // get it. (The check above is only a quick way out; this is the one that counts.)
    const { data: claimedId, error: claimError } = await service.rpc('claim_push_slot', { p_station_id: stationId, p_state: latest.state });
    if (claimError) {
      console.error('notify-gas-post: could not claim the station slot');
      return send(res, 500, { error: 'Could not send alerts.' });
    }
    if (!claimedId) return send(res, 200, { sent: 0, skipped: 'recent' });

    const { data: subscribers, error: subscribersError } = await service
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth, state, favorite_station_ids')
      .limit(5000);
    if (subscribersError) {
      // Nothing was sent, so give the slot back instead of silencing the station for 15 minutes.
      console.error('notify-gas-post: could not read subscriptions');
      await service.from('push_notification_log').delete().eq('id', claimedId);
      return send(res, 500, { error: 'Could not send alerts.' });
    }
    const audience = pickAudience((subscribers || []) as Subscriber[], { id: station.id, state: station.state }, posterId);

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
    const payload = JSON.stringify(
      buildNotification({ stationId: station.id, stationName: station.name || '', city: station.city || '', available: latest.state === 'selling' }),
    );

    let sent = 0;
    const gone: string[] = [];
    for (let i = 0; i < audience.length; i += CHUNK) {
      const batch = audience.slice(i, i + CHUNK);
      const outcomes = await Promise.allSettled(
        batch.map((sub) =>
          webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 3600, urgency: 'high' }),
        ),
      );
      outcomes.forEach((outcome, index) => {
        if (outcome.status === 'fulfilled') {
          sent += 1;
        } else {
          const code = (outcome.reason as { statusCode?: number } | undefined)?.statusCode;
          if (code === 404 || code === 410) gone.push(batch[index].endpoint);
        }
      });
    }

    if (gone.length > 0) await service.from('push_subscriptions').delete().in('endpoint', gone);
    await service.from('push_notification_log').update({ recipients: sent }).eq('id', claimedId);

    return send(res, 200, { sent, removed: gone.length });
  } catch (error) {
    console.error('notify-gas-post: unexpected error:', error instanceof Error ? error.message : 'unknown');
    return send(res, 500, { error: 'Could not send alerts.' });
  }
}
