/**
 * Validates an email address for CNG-Connect sign-up. Email is the primary
 * (and only free) verification channel — see src/services/otpService.ts.
 */
export function validateEmail(emailRaw: string): { isValid: boolean; error?: string; normalized?: string } {
  const trimmed = (emailRaw || '').trim();

  if (!trimmed) {
    return { isValid: false, error: 'Email address is required.' };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid email address.' };
  }

  return { isValid: true, normalized: trimmed.toLowerCase() };
}
