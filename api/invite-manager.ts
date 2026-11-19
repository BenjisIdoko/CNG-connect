import { createClient } from '@supabase/supabase-js';

/**
 * Invites an email to manage a station and emails them. Runs the invite as the signed-in caller, so the
 * database's own admin check decides who may invite; a non-admin gets 403 and nothing is sent. The email
 * is best effort: if the email service is not set up or refuses, the invite is still saved and the
 * response says emailed:false. Provider errors are never echoed back.
 */

// The invite email lives in this file on purpose: a separate helper file under api/ is not
// bundled into the serverless function (the first deploy failed with ERR_MODULE_NOT_FOUND).
// It carries no sign-in code; the station name is the one variable and is escaped.
export type InviteEmail = { subject: string; html: string; text: string };

const oneLine = (value: string) => value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function buildInviteEmail({ stationName, signInUrl }: { stationName: string; signInUrl: string }): InviteEmail {
  const station = oneLine(stationName).slice(0, 120) || 'a station';
  const subject = `You can manage ${station} on CNG-Connect`;

  const text = [
    `You have been invited to manage ${station} on CNG-Connect.`,
    '',
    'As its manager you can post whether the station is open and has gas, update the pump pressure, and edit its details so drivers see the right information.',
    '',
    `1. Open ${signInUrl}`,
    '2. Enter this same email address. You do not need a CNG-Connect account first.',
    '3. We email you a code. Type it in and your station is there.',
    '',
    'If you were not expecting this, you can ignore this email.',
  ].join('\n');

  const safeStation = escapeHtml(station);
  const safeUrl = escapeHtml(signInUrl);
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f3f6f4;font-family:Arial,Helvetica,sans-serif;color:#10231b;">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #d6e0da;border-radius:12px;padding:24px;">
<h1 style="font-size:18px;margin:0 0 12px;">You can manage ${safeStation}</h1>
<p style="font-size:14px;line-height:1.5;margin:0 0 12px;">You have been invited to manage <strong>${safeStation}</strong> on CNG-Connect. As its manager you can post whether the station is open and has gas, update the pump pressure, and edit its details.</p>
<ol style="font-size:14px;line-height:1.6;padding-left:20px;margin:0 0 16px;">
<li>Open the manager page below.</li>
<li>Enter this same email address. You do not need a CNG-Connect account first.</li>
<li>We email you a code. Type it in and your station is there.</li>
</ol>
<p style="margin:0 0 16px;"><a href="${safeUrl}" style="display:inline-block;background:#0f3b2c;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 18px;border-radius:8px;">Open the manager page</a></p>
<p style="font-size:12px;color:#5b6b63;margin:0;">If you were not expecting this, you can ignore this email.</p>
</div></body></html>`;

  return { subject, html, text };
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

function plausibleEmail(email: string): boolean {
  if (email.length < 5 || email.length > 254 || /\s/.test(email)) return false;
  const at = email.indexOf('@');
  if (at < 1 || at !== email.lastIndexOf('@')) return false;
  const domain = email.slice(at + 1);
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
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

async function sendInviteEmail(to: string, stationName: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_FROM_EMAIL;
  if (!apiKey || !from) return false;
  const siteUrl = (process.env.SITE_URL || 'https://cngconnect.com.ng').replace(/\/+$/, '');
  const mail = buildInviteEmail({ stationName, signInUrl: `${siteUrl}/station-manager` });
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: mail.subject, html: mail.html, text: mail.text }),
    });
    if (!response.ok) {
      console.error('invite-manager: email service refused with status', response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error('invite-manager: email request failed:', error);
    return false;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return send(res, 200, {});
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnon) {
      console.error('invite-manager: server is missing Supabase env vars');
      return send(res, 503, { error: 'Invites are unavailable right now.' });
    }

    const token = bearerToken(req);
    if (!token) return send(res, 401, { error: 'Sign in as the app admin to invite managers.' });

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return send(res, 400, { error: 'Invalid request.' });
      }
    }
    const stationId = typeof body?.stationId === 'string' ? body.stationId.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!stationId || stationId.length > 120) return send(res, 400, { error: 'Choose a station first.' });
    if (!plausibleEmail(email)) return send(res, 400, { error: "That doesn't look like an email address." });

    // Acts as the caller: auth.uid() inside the database function is this user.
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) return send(res, 401, { error: 'Sign in as the app admin to invite managers.' });
    if (rateLimited(userData.user.id)) return send(res, 429, { error: 'Too many invites. Wait a minute and try again.' });

    const { data, error } = await supabase.rpc('admin_invite_station_manager', { p_station_id: stationId, p_email: email });
    if (error) {
      const text = (error.message || '').toLowerCase();
      if (text.includes('not authorized')) return send(res, 403, { error: 'Only the app admin can invite managers.' });
      if (text.includes('invalid email')) return send(res, 400, { error: "That doesn't look like an email address." });
      if (text.includes('no station')) return send(res, 404, { error: 'That station no longer exists.' });
      console.error('invite-manager: invite failed:', error.message);
      return send(res, 500, { error: 'Could not invite, try again.' });
    }

    const { data: station } = await supabase.from('stations').select('name').eq('id', stationId).maybeSingle();
    const emailed = await sendInviteEmail(email, String(station?.name || ''));
    return send(res, 200, { result: data === 'assigned' ? 'assigned' : 'invited', emailed });
  } catch (error) {
    console.error('invite-manager: unexpected failure:', error);
    return send(res, 500, { error: 'Could not invite, try again.' });
  }
}
