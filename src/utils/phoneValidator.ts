/**
 * Validates Nigerian phone numbers for CNG-connect registration.
 * Format rules:
 * - 0 + 10 digits (e.g., 08031234567, 07012345678, 09012345678)
 * - +234 + 10 digits (e.g., +2348031234567)
 * - 234 + 10 digits (e.g., 2348031234567)
 */
export function validatePhoneNumber(phoneRaw: string): { isValid: boolean; error?: string; formatted?: string; normalized?: string } {
  if (!phoneRaw || !phoneRaw.trim()) {
    return {
      isValid: false,
      error: 'Phone number is required.',
    };
  }

  // Strip spaces, dashes, parentheses
  const cleaned = phoneRaw.replace(/[\s\-\(\)]/g, '');

  // Check for non-digit characters (except optional leading +)
  if (!/^\+?\d+$/.test(cleaned)) {
    return {
      isValid: false,
      error: 'Phone number must contain digits only.',
    };
  }

  // Strict Nigerian format check:
  // Starts with 0 + 10 digits (total 11 digits starting 070, 080, 081, 090, 091, 070, 090, 091, etc.)
  // OR starts with +234 / 234 + 10 digits (total 13 or 12 digits)
  // OR 10 digits starting with 7, 8, 9
  const isNigerianFormat =
    /^0[789][01]\d{8}$/.test(cleaned) ||
    /^\+?234[789][01]\d{8}$/.test(cleaned) ||
    /^[789][01]\d{8}$/.test(cleaned);

  if (!isNigerianFormat) {
    return {
      isValid: false,
      error: 'Please enter a valid Nigerian phone number (e.g. 0803 123 4567 or +234 803 123 4567).',
    };
  }

  // Extract core 10 digits
  let digits = cleaned;
  if (digits.startsWith('+234')) {
    digits = digits.slice(4);
  } else if (digits.startsWith('234')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  const normalized = `+234${digits}`;
  const formatted = `+234 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;

  return {
    isValid: true,
    normalized,
    formatted,
  };
}

/**
 * Generates a mock 6-digit OTP code for local dev fallback.
 */
export function generateMockOtp(): string {
  return '123456';
}
