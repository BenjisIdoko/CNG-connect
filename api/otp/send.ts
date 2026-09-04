import { getOtpSession, saveOtpSession } from './store.js';

function sendJsonResponse(res: any, statusCode: number, data: any) {
  if (res) {
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(statusCode).json(data);
    }
    if (typeof res.setHeader === 'function' && typeof res.end === 'function') {
      res.statusCode = statusCode;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
      return;
    }
  }
  return new Response(JSON.stringify(data), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Dev-mode OTP bypass. Requires an EXPLICIT opt-in (ALLOW_DEV_OTP=true) and is
 * hard-disabled on Vercel's production environment regardless of that flag —
 * this is a security boundary, so it must fail closed, never fail open. An
 * earlier version of this endpoint enabled the bypass by default whenever no
 * SMS provider key was configured, which meant every phone number on the live
 * site could be "verified" with a universal code. Do not reintroduce that.
 */
function isDevModeAllowed(): boolean {
  const isProdEnv = process.env.VERCEL_ENV === 'production';
  return process.env.ALLOW_DEV_OTP === 'true' && !isProdEnv;
}

async function sendVerificationEmail(email: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'Email delivery is not configured on the server (RESEND_API_KEY missing).' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_ADDRESS || 'CNG-Connect <onboarding@resend.dev>',
        to: [email],
        subject: `${code} is your CNG-Connect verification code`,
        html: `<div style="font-family:sans-serif;max-width:420px;margin:0 auto">
          <h2 style="color:#004D40">CNG-Connect</h2>
          <p>Your verification code is:</p>
          <p style="font-size:32px;font-weight:800;letter-spacing:6px;color:#004D40">${code}</p>
          <p style="color:#666;font-size:13px">This code expires in 5 minutes. If you didn't request this, you can ignore this email.</p>
        </div>`,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Resend email dispatch error:', res.status, errText);
      return { ok: false, error: 'Failed to send verification email. Please try again.' };
    }
    return { ok: true };
  } catch (err) {
    console.error('Resend email dispatch exception:', err);
    return { ok: false, error: 'Failed to send verification email. Please try again.' };
  }
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'OPTIONS') {
      return sendJsonResponse(res, 200, {});
    }

    if (req.method !== 'POST') {
      return sendJsonResponse(res, 405, { error: 'Method not allowed' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { /* leave body as-is; validated below */ }
    }

    const email = String(body?.email || '').trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      return sendJsonResponse(res, 400, { error: 'A valid email address is required.' });
    }

    const now = Date.now();
    const existing = await getOtpSession(email);

    // Rate limit: 60-second cooldown between sends per identifier
    if (existing && now - existing.lastSentAt < 60000) {
      const secondsLeft = Math.ceil((60000 - (now - existing.lastSentAt)) / 1000);
      return sendJsonResponse(res, 429, {
        error: `Please wait ${secondsLeft} seconds before requesting a new code.`,
        secondsLeft,
      });
    }

    const devMode = isDevModeAllowed();
    const generatedOtp = devMode ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = now + 5 * 60 * 1000; // 5-minute expiry

    await saveOtpSession(email, {
      channel: 'email',
      code: generatedOtp,
      expiresAt,
      lastSentAt: now,
    });

    if (devMode) {
      console.log(`DEV MODE (ALLOW_DEV_OTP=true, non-production): would email OTP ${generatedOtp} to ${email}`);
      return sendJsonResponse(res, 200, {
        success: true,
        message: `DEV MODE: use code ${generatedOtp} (no email was actually sent)`,
        devCode: generatedOtp,
        isDevMode: true,
        cooldownSeconds: 60,
        expiresAt,
      });
    }

    const dispatch = await sendVerificationEmail(email, generatedOtp);
    if (!dispatch.ok) {
      return sendJsonResponse(res, 500, { error: dispatch.error });
    }

    return sendJsonResponse(res, 200, {
      success: true,
      message: `Verification code sent to ${email}.`,
      isDevMode: false,
      cooldownSeconds: 60,
      expiresAt,
    });
  } catch (error: any) {
    console.error('Server-side OTP send error:', error);
    return sendJsonResponse(res, 500, { error: 'Something went wrong. Please try again.' });
  }
}
