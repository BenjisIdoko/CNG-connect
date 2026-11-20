/**
 * Password rules and plain-language error text for station managers. Managers choose their own
 * password; nothing here creates or shows one. Supabase messages are mapped to short sentences and an
 * unknown message is never echoed back.
 */

const MIN_LENGTH = 8;
/** bcrypt, which Supabase uses, ignores everything after 72 characters. */
const MAX_LENGTH = 72;

/** An error sentence, or null when the new password and its repeat are acceptable. Spaces count. */
export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_LENGTH) return `Use at least ${MIN_LENGTH} characters`;
  if (password.length > MAX_LENGTH) return `Use ${MAX_LENGTH} characters or fewer`;
  if (password !== confirm) return "The two passwords don't match";
  return null;
}

export function friendlyPasswordError(message: string): string {
  const text = (message || '').toLowerCase();
  if (text.includes('different from the old')) return "Choose a password you haven't used here before";
  if (text.includes('weak') || text.includes('easy to guess') || text.includes('pwned')) {
    return 'That password is too easy to guess. Try a longer one';
  }
  if (text.includes('session') || text.includes('jwt') || text.includes('not authenticated')) {
    return 'Sign in again, then set your password';
  }
  return 'Could not save the password. Try again';
}

/** One message for a wrong password and for an account that has no password yet, so nobody can probe accounts. */
export const SIGN_IN_FAILED_MESSAGE = "That email and password don't match. First time, or forgot your password? Email yourself a code.";

export function friendlySignInError(message: string): string {
  const text = (message || '').toLowerCase();
  if (text.includes('invalid login credentials') || text.includes('invalid_credentials')) return SIGN_IN_FAILED_MESSAGE;
  if (text.includes('failed to fetch') || text.includes('network')) return 'No connection. Check your internet and try again';
  return 'Could not sign in. Try again';
}
