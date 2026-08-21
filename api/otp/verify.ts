import { otpSessionStore } from './send';

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

    const { phone, code } = body || {};
    if (!phone || !code) {
      const err = 'Phone number and verification code are required.';
      if (res && typeof res.status === 'function') return res.status(400).json({ verified: false, error: err });
      return new Response(JSON.stringify({ verified: false, error: err }), { status: 400 });
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
    const isDevMode =
      process.env.VITE_DEV_MODE === 'true' ||
      process.env.DEV_MODE === 'true' ||
      (!process.env.TERMII_API_KEY && !process.env.AFRICAS_TALKING_API_KEY && !process.env.TWILIO_AUTH_TOKEN);

    // Dev Mode Bypass Verification
    if (isDevMode && (trimmedCode === '123456' || trimmedCode === '000000')) {
      const payload = { verified: true, message: 'Dev Mode OTP verified successfully.' };
      if (res && typeof res.status === 'function') return res.status(200).json(payload);
      return new Response(JSON.stringify(payload), { status: 200 });
    }

    // Check Server-Side OTP Session Cache
    const session = otpSessionStore.get(normalizedPhone);
    if (!session) {
      const err = 'No active OTP verification code found for this phone number. Please request a new code.';
      if (res && typeof res.status === 'function') return res.status(400).json({ verified: false, error: err });
      return new Response(JSON.stringify({ verified: false, error: err }), { status: 400 });
    }

    // Expiry Check (5 Minutes)
    if (Date.now() > session.expiresAt) {
      otpSessionStore.delete(normalizedPhone);
      const err = 'OTP verification code has expired (5 minute limit). Please request a new code.';
      if (res && typeof res.status === 'function') return res.status(400).json({ verified: false, error: err });
      return new Response(JSON.stringify({ verified: false, error: err }), { status: 400 });
    }

    // Code Match Check
    if (session.code !== trimmedCode) {
      const err = isDevMode
        ? `Incorrect verification code. Use dev code 123456 to verify.`
        : 'Incorrect verification code. Please check the SMS sent to your phone.';
      if (res && typeof res.status === 'function') return res.status(400).json({ verified: false, error: err });
      return new Response(JSON.stringify({ verified: false, error: err }), { status: 400 });
    }

    // Success: Remove code from session store (one-time use)
    otpSessionStore.delete(normalizedPhone);

    const payload = { verified: true, message: 'Phone number verified successfully.' };
    if (res && typeof res.status === 'function') return res.status(200).json(payload);
    return new Response(JSON.stringify(payload), { status: 200 });
  } catch (error: any) {
    console.error('Server-side OTP verify error:', error);
    const err = error?.message || 'Failed to verify OTP code.';
    if (res && typeof res.status === 'function') return res.status(500).json({ verified: false, error: err });
    return new Response(JSON.stringify({ verified: false, error: err }), { status: 500 });
  }
}
