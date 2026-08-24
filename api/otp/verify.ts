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

export default async function handler(req: any, res: any) {
  try {
    // CORS & Method Check
    if (req.method === 'OPTIONS') {
      return sendJsonResponse(res, 200, {});
    }

    if (req.method !== 'POST') {
      return sendJsonResponse(res, 405, { error: 'Method not allowed' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch {}
    }

    const { phone, code } = body || {};
    if (!phone || !code) {
      return sendJsonResponse(res, 400, {
        verified: false,
        error: 'Phone number and verification code are required.',
      });
    }

    // Normalize phone number (e.g. +2348031234567)
    const cleanedDigits = phone.replace(/\D/g, '');
    let normalizedPhone = cleanedDigits;
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '234' + normalizedPhone.slice(1);
    }
    if (!normalizedPhone.startsWith('234')) {
      normalizedPhone = '234' + normalizedPhone;
    }
    normalizedPhone = '+' + normalizedPhone;

    const trimmedCode = String(code).trim();
    const hasTermiiKey = Boolean(process.env.TERMII_API_KEY || process.env.AFRICAS_TALKING_API_KEY || process.env.TWILIO_AUTH_TOKEN);
    const isDevMode = !hasTermiiKey || process.env.DEV_MODE === 'true' || process.env.VITE_DEV_MODE === 'true';

    // Dev Mode Verification
    if (isDevMode) {
      console.log(`DEV MODE: verifying test OTP code "${trimmedCode}" for ${normalizedPhone}`);
      const session = await getOtpSession(normalizedPhone);
      if (session) {
        if (Date.now() > session.expiresAt) {
          await deleteOtpSession(normalizedPhone);
          return sendJsonResponse(res, 400, {
            verified: false,
            error: 'OTP verification code has expired (5 minute limit). Please request a new code.',
          });
        }
        if (session.code === trimmedCode || trimmedCode === '123456' || trimmedCode === '000000') {
          await deleteOtpSession(normalizedPhone);
          return sendJsonResponse(res, 200, {
            verified: true,
            message: 'Dev Mode OTP verified successfully.',
          });
        }
      } else if (trimmedCode === '123456' || trimmedCode === '000000') {
        return sendJsonResponse(res, 200, {
          verified: true,
          message: 'Dev Mode OTP verified successfully.',
        });
      }

      return sendJsonResponse(res, 400, {
        verified: false,
        error: 'Incorrect verification code.',
      });
    }

    // Real Mode Verification via persistent session store
    const session = await getOtpSession(normalizedPhone);
    if (!session) {
      return sendJsonResponse(res, 400, {
        verified: false,
        error: 'No active OTP verification code found for this phone number. Please request a new code.',
      });
    }

    // Expiry Check (5 Minutes)
    if (Date.now() > session.expiresAt) {
      await deleteOtpSession(normalizedPhone);
      return sendJsonResponse(res, 400, {
        verified: false,
        error: 'OTP verification code has expired (5 minute limit). Please request a new code.',
      });
    }

    // Code Match Check
    if (session.code !== trimmedCode) {
      return sendJsonResponse(res, 400, {
        verified: false,
        error: 'Incorrect verification code. Please check the SMS sent to your phone.',
      });
    }

    // Success: Remove code from session store (one-time use)
    await deleteOtpSession(normalizedPhone);

    return sendJsonResponse(res, 200, {
      verified: true,
      message: 'Phone number verified successfully.',
    });
  } catch (error: any) {
    console.error('Server-side OTP verify error:', error);
    return sendJsonResponse(res, 500, {
      verified: false,
      error: 'Something went wrong. Please try again.',
    });
  }
}
