export interface SendOtpResponse {
  success: boolean;
  message?: string;
  devCode?: string;
  cooldownSeconds?: number;
  expiresAt?: number;
  error?: string;
}

export interface VerifyOtpResponse {
  verified: boolean;
  message?: string;
  error?: string;
}

export const otpService = {
  /**
   * Request serverless SMS OTP code send for a given phone number.
   * Calls /api/otp/send.
   */
  async sendOtp(phone: string): Promise<SendOtpResponse> {
    try {
      const response = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Failed to send OTP verification code.',
        };
      }

      return {
        success: true,
        message: data.message,
        devCode: data.devCode,
        cooldownSeconds: data.cooldownSeconds || 60,
        expiresAt: data.expiresAt,
      };
    } catch (err: any) {
      console.error('otpService.sendOtp error:', err);
      return {
        success: false,
        error: err.message || 'Unable to connect to OTP service. Please try again.',
      };
    }
  },

  /**
   * Verify entered 6-digit OTP code against serverless verification endpoint.
   * Calls /api/otp/verify.
   */
  async verifyOtp(phone: string, code: string): Promise<VerifyOtpResponse> {
    try {
      const response = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });

      const data = await response.json();
      if (!response.ok || !data.verified) {
        return {
          verified: false,
          error: data.error || 'Invalid or expired OTP code.',
        };
      }

      return {
        verified: true,
        message: data.message,
      };
    } catch (err: any) {
      console.error('otpService.verifyOtp error:', err);
      return {
        verified: false,
        error: err.message || 'Network error verifying OTP code.',
      };
    }
  },
};
