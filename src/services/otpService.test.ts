import { describe, it, expect, vi } from 'vitest';
import { otpService } from './otpService';

describe('Client OTP Service (otpService)', () => {
  it('sends OTP request to /api/otp/send and returns success response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Verification code sent.',
        devCode: '123456',
        cooldownSeconds: 60,
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await otpService.sendOtp('driver@example.com');
    expect(res.success).toBe(true);
    expect(res.devCode).toBe('123456');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/otp/send',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'driver@example.com' }) })
    );

    vi.unstubAllGlobals();
  });

  it('handles rate-limiting error response from /api/otp/send', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'Please wait 60 seconds before requesting a new code.',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await otpService.sendOtp('driver@example.com');
    expect(res.success).toBe(false);
    expect(res.error).toContain('wait 60 seconds');

    vi.unstubAllGlobals();
  });

  it('verifies valid OTP with /api/otp/verify', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        verified: true,
        message: 'Verified',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await otpService.verifyOtp('driver@example.com', '123456');
    expect(res.verified).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/otp/verify',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'driver@example.com', code: '123456' }) })
    );

    vi.unstubAllGlobals();
  });

  it('returns failure when /api/otp/verify rejects invalid code', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        verified: false,
        error: 'Incorrect verification code.',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await otpService.verifyOtp('driver@example.com', '999999');
    expect(res.verified).toBe(false);
    expect(res.error).toContain('Incorrect verification code');

    vi.unstubAllGlobals();
  });
});
