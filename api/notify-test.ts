import { createClient } from '@supabase/supabase-js';
import * as webpush from 'web-push';

/**
 * Sends a test push notification to the caller's OWN phone, so a driver can see that alerts reach it without
 * waiting for a station post. It runs as the caller (their own sign-in, with the public anon key): row
 * security lets them read and remove only their own saved phones, so no service key is involved. The app
 * says which phone it is (`endpoint`); with none named, every phone the caller has registered gets it.
 * Self-contained on purpose (a helper file under api/ is not bundled into the serverless function). Needs
 * VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT in Vercel, plus the usual Supabase URL and anon key;
 * without them it answers 503. Provider errors are never echoed back.
 */

export const TEST_NOTIFICATION = {
  title: 'CNG-Connect test alert',
  body: 'Alerts are working on this phone.',
  url: '/',
  tag: 'cng-test',
} as const;

const RATE_LIMIT = 5;
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

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return send(res, 200, {});
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT;
    if (!supabaseUrl || !supabaseAnon || !vapidPublic || !vapidPrivate || !vapidSubject) {
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
    const endpointRaw = body?.endpoint;
    if (endpointRaw !== undefined && (typeof endpointRaw !== 'string' || endpointRaw.length > 2000)) {
      return send(res, 400, { error: 'Invalid request.' });
    }
    const endpoint = typeof endpointRaw === 'string' && endpointRaw.trim() ? endpointRaw.trim() : null;

    const client = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData?.user) return send(res, 401, { error: 'Sign in again.' });
    const userId = userData.user.id;
    if (rateLimited(userId)) return send(res, 429, { error: 'Too many test alerts. Try again in a minute.' });

    // Row security already limits this to the caller's own phones; the filters say so explicitly as well.
    let phones = client.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', userId);
    if (endpoint) phones = phones.eq('endpoint', endpoint);
    const { data: rows, error: readError } = await phones;
    if (readError) {
      console.error('notify-test: could not read the phones');
      return send(res, 500, { error: 'Could not send the test alert.' });
    }
    const devices = (rows || []) as Array<{ endpoint: string; p256dh: string; auth: string }>;
    if (devices.length === 0) return send(res, 200, { sent: 0, devices: 0, removed: 0 });

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
    const payload = JSON.stringify(TEST_NOTIFICATION);
    const outcomes = await Promise.allSettled(
      devices.map((d) => webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload, { TTL: 300, urgency: 'high' })),
    );

    let sent = 0;
    const gone: string[] = [];
    outcomes.forEach((outcome, index) => {
      if (outcome.status === 'fulfilled') {
        sent += 1;
      } else {
        const code = (outcome.reason as { statusCode?: number } | undefined)?.statusCode;
        if (code === 404 || code === 410) gone.push(devices[index].endpoint);
      }
    });
    if (gone.length > 0) await client.from('push_subscriptions').delete().eq('user_id', userId).in('endpoint', gone);

    return send(res, 200, { sent, devices: devices.length, removed: gone.length });
  } catch (error) {
    console.error('notify-test: unexpected error:', error instanceof Error ? error.message : 'unknown');
    return send(res, 500, { error: 'Could not send the test alert.' });
  }
}
