import { describe, it, expect, vi } from 'vitest';
import { otpService } from './otpService';

describe('Client OTP Service (otpService)', () => {
  it('sends OTP request to /api/otp/send and returns success response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: 'SMS code sent',
        devCode: '123456',
        cooldownSeconds: 60,
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await otpService.sendOtp('08031234567');
    expect(res.success).toBe(true);
    expect(res.devCode).toBe('123456');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/otp/send',
      expect.objectContaining({ method: 'POST' })
    );

    vi.unstubAllGlobals();
  });

  it('handles rate-limiting error response from /api/otp/send', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'Please wait 60 seconds before requesting another SMS code.',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await otpService.sendOtp('08031234567');
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

    const res = await otpService.verifyOtp('08031234567', '123456');
    expect(res.verified).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/otp/verify',
      expect.objectContaining({ method: 'POST' })
    );

    vi.unstubAllGlobals();
  });

  it('returns failure when /api/otp/verify rejects invalid code', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        verified: false,
        error: 'Invalid or expired OTP code.',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await otpService.verifyOtp('08031234567', '999999');
    expect(res.verified).toBe(false);
    expect(res.error).toContain('Invalid or expired');

    vi.unstubAllGlobals();
  });
});
