import { validatePhoneNumber } from './phoneValidator';

const MAX_NAME_LENGTH = 80;

export type ContactDetailsResult = { ok: true; name: string; phone: string } | { ok: false; error: string };

/**
 * Checks the name and phone a person types on their profile before anything is sent. The phone must be a
 * valid Nigerian number (the same rule the driver app and the database apply) and is returned in the
 * app's usual format, "+234 803 123 4567".
 */
export function validateContactDetails(nameRaw: string, phoneRaw: string): ContactDetailsResult {
  const name = nameRaw.trim();
  if (!name) return { ok: false, error: 'Enter your name' };
  if (name.length > MAX_NAME_LENGTH) return { ok: false, error: `Use ${MAX_NAME_LENGTH} characters or fewer for your name` };

  const phone = validatePhoneNumber(phoneRaw);
  if (!phone.isValid) return { ok: false, error: phone.error || 'Enter a valid Nigerian phone number.' };
  return { ok: true, name, phone: phone.formatted || phoneRaw.trim() };
}

/** Plain-language text for a failed profile save. An unknown message is never echoed. */
export function friendlyProfileError(message: string): string {
  const text = (message || '').toLowerCase();
  if (text.includes('phone')) return "That phone number isn't valid. Use a Nigerian number like 0803 123 4567";
  if (text.includes('jwt') || text.includes('session') || text.includes('permission denied') || text.includes('not authenticated')) {
    return 'Sign in again, then try once more';
  }
  return 'Could not save your details. Try again';
}
