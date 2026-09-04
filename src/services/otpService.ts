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
   * Request a serverless email verification code for the given address.
   * Calls /api/otp/send. Email was chosen over SMS because there is no
   * genuinely free SMS gateway that delivers to Nigerian numbers at any
   * real volume — every provider (Termii, Africa's Talking, Twilio) charges
   * per message in production.
   */
  async sendOtp(email: string): Promise<SendOtpResponse> {
    try {
      const response = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      let data: any = {};
      const contentType = (response.headers && typeof response.headers.get === 'function')
        ? (response.headers.get('content-type') || 'application/json')
        : 'application/json';

      if (contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch {
          data = {};
        }
      }

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Verification request failed, please try again.',
        };
      }

      return {
        success: true,
        message: data.message || 'Verification code sent.',
        devCode: data.devCode,
        cooldownSeconds: data.cooldownSeconds || 60,
        expiresAt: data.expiresAt,
      };
    } catch (err: any) {
      console.error('otpService.sendOtp error:', err);
      return {
        success: false,
        error: 'Verification failed, please try again.',
      };
    }
  },

  /**
   * Verify entered 6-digit code against the serverless verification endpoint.
   * Calls /api/otp/verify.
   */
  async verifyOtp(email: string, code: string): Promise<VerifyOtpResponse> {
    try {
      const response = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      let data: any = {};
      const contentType = (response.headers && typeof response.headers.get === 'function')
        ? (response.headers.get('content-type') || 'application/json')
        : 'application/json';

      if (contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch {
          data = {};
        }
      }

      if (!response.ok || !data.verified) {
        return {
          verified: false,
          error: data.error || 'Verification failed, please try again.',
        };
      }

      return {
        verified: true,
        message: data.message || 'Verified successfully.',
      };
    } catch (err: any) {
      console.error('otpService.verifyOtp error:', err);
      return {
        verified: false,
        error: 'Verification failed, please try again.',
      };
    }
  },
};
