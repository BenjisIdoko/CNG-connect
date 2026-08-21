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
        message: data.message || 'SMS code dispatched.',
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
