/**
 * The two steps of the station manager's sign-in: type the email, then type the code that was
 * emailed. Kept as small pure functions so the screen only has to draw the state.
 */

export type SignInStep = 'email' | 'code';

export interface SignInState {
  step: SignInStep;
  email: string;
  error: string | null;
  /** When the current code was sent (ms), for the resend cooldown; null before one is sent. */
  sentAt: number | null;
}

export type SignInEvent =
  | { type: 'sent'; email: string }
  | { type: 'failed'; error: string }
  | { type: 'change-email' };

/** How long a person must wait before asking for another code. */
export const RESEND_COOLDOWN_MS = 30_000;

export const initialSignIn = (): SignInState => ({ step: 'email', email: '', error: null, sentAt: null });

export function nextSignIn(state: SignInState, event: SignInEvent, now: number): SignInState {
  switch (event.type) {
    case 'sent':
      return { step: 'code', email: event.email, error: null, sentAt: now };
    case 'failed':
      return { ...state, error: event.error };
    case 'change-email':
      return { step: 'email', email: state.email, error: null, sentAt: null };
  }
}

export function canResend(state: SignInState, now: number): boolean {
  return state.step === 'code' && state.sentAt !== null && now - state.sentAt >= RESEND_COOLDOWN_MS;
}

/** The digits of what was typed, if there are 4 to 10 of them (the code length is a Supabase setting). */
export function cleanCode(raw: string): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  return /^\d{4,10}$/.test(digits) && digits === (raw || '').replace(/[\s-]/g, '') ? digits : null;
}
