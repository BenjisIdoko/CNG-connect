/**
 * The email an invited station manager receives. It carries no sign-in code: it tells them which
 * station they can manage and where to sign in, and the code arrives in a separate email once they
 * enter their address there. Fixed text only; the station name is the one variable and is escaped.
 */

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
