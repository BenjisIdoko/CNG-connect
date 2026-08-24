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

    const { phone } = body || {};
    if (!phone) {
      return sendJsonResponse(res, 400, { error: 'Phone number is required.' });
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

    const now = Date.now();
    const existing = await getOtpSession(normalizedPhone);

    // 1. Rate Limiting Check: 60-Second Cooldown between SMS dispatches
    if (existing && now - existing.lastSentAt < 60000) {
      const secondsLeft = Math.ceil((60000 - (now - existing.lastSentAt)) / 1000);
      return sendJsonResponse(res, 429, {
        error: `Rate limit exceeded. Please wait ${secondsLeft} seconds before requesting a new code.`,
        secondsLeft,
      });
    }

    // Dev-Mode Check: automatically active when no SMS provider key is configured
    const hasTermiiKey = Boolean(process.env.TERMII_API_KEY || process.env.AFRICAS_TALKING_API_KEY || process.env.TWILIO_AUTH_TOKEN);
    const isDevMode = !hasTermiiKey || process.env.DEV_MODE === 'true' || process.env.VITE_DEV_MODE === 'true';

    // Generate 6-Digit OTP Code
    const generatedOtp = isDevMode ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = now + 5 * 60 * 1000; // 5-minute expiry

    // Save challenge in persistent session store
    await saveOtpSession(normalizedPhone, {
      code: generatedOtp,
      expiresAt,
      lastSentAt: now,
    });

    if (isDevMode) {
      console.log(`DEV MODE: would send OTP code ${generatedOtp} to ${normalizedPhone}`);
    } else {
      // Dispatch real SMS if Termii API Key exists on server
      if (process.env.TERMII_API_KEY) {
        const termiiRes = await fetch('https://api.ng.termii.com/api/sms/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: normalizedPhone.replace('+', ''),
            from: process.env.TERMII_SENDER_ID || 'CNGConnect',
            sms: `Your CNG-Connect verification code is ${generatedOtp}. Valid for 5 minutes.`,
            type: 'plain',
            channel: 'generic',
            api_key: process.env.TERMII_API_KEY,
          }),
        });
        if (!termiiRes.ok) {
          console.error('Termii SMS Dispatch error:', await termiiRes.text());
        }
      } else if (process.env.AFRICAS_TALKING_API_KEY) {
        const atRes = await fetch('https://api.africastalking.com/version1/messaging', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            apiKey: process.env.AFRICAS_TALKING_API_KEY,
          },
          body: new URLSearchParams({
            username: process.env.AFRICAS_TALKING_USERNAME || 'sandbox',
            to: normalizedPhone,
            message: `Your CNG-Connect verification code is ${generatedOtp}. Valid for 5 minutes.`,
          }),
        });
        if (!atRes.ok) {
          console.error("Africa's Talking SMS error:", await atRes.text());
        }
      }
    }

    return sendJsonResponse(res, 200, {
      success: true,
      message: isDevMode
        ? `DEV MODE: would send OTP to ${normalizedPhone} (Use code: ${generatedOtp})`
        : `SMS verification code sent to ${normalizedPhone}`,
      devCode: isDevMode ? generatedOtp : undefined,
      isDevMode,
      cooldownSeconds: 60,
      expiresAt,
    });
  } catch (error: any) {
    console.error('Server-side OTP send error:', error);
    return sendJsonResponse(res, 500, { error: 'Something went wrong. Please try again.' });
  }
}
