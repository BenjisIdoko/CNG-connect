import { getOtpSession, deleteOtpSession } from './store.js';

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

/**
 * Same fail-closed rule as api/otp/send.ts: the dev bypass requires an
 * explicit ALLOW_DEV_OTP=true and is hard-disabled on Vercel production
 * regardless of that flag. Never let this default to "on".
 */
function isDevModeAllowed(): boolean {
  const isProdEnv = process.env.VERCEL_ENV === 'production';
  return process.env.ALLOW_DEV_OTP === 'true' && !isProdEnv;
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
    const code = body?.code;
    if (!email || !code) {
      return sendJsonResponse(res, 400, {
        verified: false,
        error: 'Email address and verification code are required.',
      });
    }

    const trimmedCode = String(code).trim();
    const devMode = isDevModeAllowed();

    if (devMode) {
      console.log(`DEV MODE (ALLOW_DEV_OTP=true, non-production): verifying test code "${trimmedCode}" for ${email}`);
      if (trimmedCode !== '123456') {
        return sendJsonResponse(res, 400, { verified: false, error: 'Incorrect verification code.' });
      }
      await deleteOtpSession(email);
      return sendJsonResponse(res, 200, { verified: true, message: 'Dev mode OTP verified successfully.' });
    }

    const session = await getOtpSession(email);
    if (!session) {
      return sendJsonResponse(res, 400, {
        verified: false,
        error: 'No active verification code found for this email. Please request a new code.',
      });
    }

    if (Date.now() > session.expiresAt) {
      await deleteOtpSession(email);
      return sendJsonResponse(res, 400, {
        verified: false,
        error: 'Verification code has expired (5 minute limit). Please request a new code.',
      });
    }

    if (session.code !== trimmedCode) {
      return sendJsonResponse(res, 400, {
        verified: false,
        error: 'Incorrect verification code. Please check the email we sent you.',
      });
    }

    // Success: remove the code from the store (one-time use)
    await deleteOtpSession(email);

    return sendJsonResponse(res, 200, {
      verified: true,
      message: 'Email verified successfully.',
    });
  } catch (error: any) {
    console.error('Server-side OTP verify error:', error);
    return sendJsonResponse(res, 500, {
      verified: false,
      error: 'Something went wrong. Please try again.',
    });
  }
}
