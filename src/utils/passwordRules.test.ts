import { describe, expect, it } from 'vitest';
import { SIGN_IN_FAILED_MESSAGE, friendlyPasswordError, friendlySignInError, validateNewPassword } from './passwordRules';

describe('validateNewPassword', () => {
  it('needs at least 8 characters', () => {
    expect(validateNewPassword('1234567', '1234567')).toBe('Use at least 8 characters');
    expect(validateNewPassword('', '')).toBe('Use at least 8 characters');
    expect(validateNewPassword('12345678', '12345678')).toBeNull();
  });

  it('allows up to 72 characters and no more', () => {
    expect(validateNewPassword('a'.repeat(72), 'a'.repeat(72))).toBeNull();
    expect(validateNewPassword('a'.repeat(73), 'a'.repeat(73))).toBe('That password is too long. Use a shorter one');
  });

  it('counts bytes, not letters: the limit is 72 bytes, so 40 Cyrillic letters are too long', () => {
    expect(validateNewPassword('ж'.repeat(36), 'ж'.repeat(36))).toBeNull(); // 72 bytes
    expect(validateNewPassword('ж'.repeat(40), 'ж'.repeat(40))).toBe('That password is too long. Use a shorter one');
  });

  it('needs both entries to match', () => {
    expect(validateNewPassword('longenough1', 'longenough2')).toBe("The two passwords don't match");
  });

  it('does not trim: spaces are part of a password', () => {
    expect(validateNewPassword('  1234   ', '  1234   ')).toBeNull();
  });
});

describe('friendlyPasswordError', () => {
  it('turns the usual Supabase messages into plain text', () => {
    expect(friendlyPasswordError('New password should be different from the old password.')).toBe("Choose a password you haven't used here before");
    expect(friendlyPasswordError('Password is known to be weak and easy to guess')).toBe('That password is too easy to guess. Try a longer one');
    expect(friendlyPasswordError('Auth session missing!')).toBe('Sign in again, then set your password');
    expect(friendlyPasswordError('invalid JWT')).toBe('Sign in again, then set your password');
  });

  it('never echoes an unknown message', () => {
    expect(friendlyPasswordError('PGRST500 internal: secret detail')).toBe('Could not save the password. Try again');
    expect(friendlyPasswordError('')).toBe('Could not save the password. Try again');
  });
});

describe('friendlySignInError', () => {
  it('gives one message for a wrong password and for an account with no password yet', () => {
    expect(friendlySignInError('Invalid login credentials')).toBe(SIGN_IN_FAILED_MESSAGE);
    expect(friendlySignInError('invalid_credentials')).toBe(SIGN_IN_FAILED_MESSAGE);
    expect(SIGN_IN_FAILED_MESSAGE).toBe("That email and password don't match. First time, or forgot your password? Email yourself a code.");
  });

  it('says so when there is no connection', () => {
    expect(friendlySignInError('Failed to fetch')).toBe('No connection. Check your internet and try again');
    expect(friendlySignInError('NetworkError when attempting to fetch resource.')).toBe('No connection. Check your internet and try again');
  });

  it('never echoes an unknown message', () => {
    expect(friendlySignInError('something odd with token abc123')).toBe('Could not sign in. Try again');
    expect(friendlySignInError('Email not confirmed')).toBe('Could not sign in. Try again');
  });
});
