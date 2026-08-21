// Server-Side In-Memory Cache for OTP Verification Challenges
// Map key: normalized phone number -> { code, expiresAt, lastSentAt }
export const otpSessionStore = new Map<string, { code: string; expiresAt: number; lastSentAt: number }>();

export default async function handler(req: any, res: any) {
  // CORS & Method Check
  if (req.method === 'OPTIONS') {
    if (res && typeof res.status === 'function') return res.status(200).json({});
    return new Response(null, { status: 200 });
  }

  if (req.method !== 'POST') {
    if (res && typeof res.status === 'function') return res.status(405).json({ error: 'Method not allowed' });
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch {}
    }

    const { phone } = body || {};
    if (!phone) {
      const err = 'Phone number is required.';
      if (res && typeof res.status === 'function') return res.status(400).json({ error: err });
      return new Response(JSON.stringify({ error: err }), { status: 400 });
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
    const existing = otpSessionStore.get(normalizedPhone);

    // 1. Rate Limiting Check: 60-Second Cooldown between SMS dispatches
    if (existing && now - existing.lastSentAt < 60000) {
      const secondsLeft = Math.ceil((60000 - (now - existing.lastSentAt)) / 1000);
      const rateLimitMsg = `Rate limit exceeded. Please wait ${secondsLeft} seconds before requesting a new code.`;
      if (res && typeof res.status === 'function') return res.status(429).json({ error: rateLimitMsg, secondsLeft });
      return new Response(JSON.stringify({ error: rateLimitMsg, secondsLeft }), { status: 429 });
    }

    // Check Dev Mode or Provider Configuration
    const isDevMode =
      process.env.VITE_DEV_MODE === 'true' ||
      process.env.DEV_MODE === 'true' ||
      (!process.env.TERMII_API_KEY && !process.env.AFRICAS_TALKING_API_KEY && !process.env.TWILIO_AUTH_TOKEN);

    // Generate 6-Digit OTP Code
    const generatedOtp = isDevMode ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = now + 5 * 60 * 1000; // 5-minute expiry

    // Save challenge in server-side session cache
    otpSessionStore.set(normalizedPhone, {
      code: generatedOtp,
      expiresAt,
      lastSentAt: now,
    });

    // 2. Dispatch real SMS if Provider Secret Keys exist on server
    if (!isDevMode) {
      if (process.env.TERMII_API_KEY) {
        // Termii Nigeria SMS Dispatch
        const termiiRes = await fetch('https://api.ng.termii.com/api/sms/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: normalizedPhone.replace('+', ''),
            from: process.env.TERMII_SENDER_ID || 'GasFinder',
            sms: `Your GasFinder CNG verification code is ${generatedOtp}. Valid for 5 minutes.`,
            type: 'plain',
            channel: 'generic',
            api_key: process.env.TERMII_API_KEY,
          }),
        });
        if (!termiiRes.ok) {
          console.error('Termii SMS Dispatch error:', await termiiRes.text());
        }
      } else if (process.env.AFRICAS_TALKING_API_KEY) {
        // Africa's Talking SMS Dispatch
        const atRes = await fetch('https://api.africastalking.com/version1/messaging', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            apiKey: process.env.AFRICAS_TALKING_API_KEY,
          },
          body: new URLSearchParams({
            username: process.env.AFRICAS_TALKING_USERNAME || 'sandbox',
            to: normalizedPhone,
            message: `Your GasFinder CNG verification code is ${generatedOtp}. Valid for 5 minutes.`,
          }),
        });
        if (!atRes.ok) {
          console.error("Africa's Talking SMS error:", await atRes.text());
        }
      }
    }

    const payload = {
      success: true,
      message: isDevMode
        ? `SMS code sent to ${normalizedPhone} (Dev Mode Code: ${generatedOtp})`
        : `SMS verification code sent to ${normalizedPhone}`,
      devCode: isDevMode ? generatedOtp : undefined,
      cooldownSeconds: 60,
      expiresAt,
    };

    if (res && typeof res.status === 'function') return res.status(200).json(payload);
    return new Response(JSON.stringify(payload), { status: 200 });
  } catch (error: any) {
    console.error('Server-side OTP send error:', error);
    const err = error?.message || 'Failed to send OTP code.';
    if (res && typeof res.status === 'function') return res.status(500).json({ error: err });
    return new Response(JSON.stringify({ error: err }), { status: 500 });
  }
}
