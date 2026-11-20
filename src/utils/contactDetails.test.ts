import { describe, expect, it } from 'vitest';
import { friendlyProfileError, validateContactDetails } from './contactDetails';

describe('validateContactDetails', () => {
  it('accepts a name and a Nigerian number and returns the number in the app format', () => {
    expect(validateContactDetails('  Ada Obi  ', '08031234567')).toEqual({ ok: true, name: 'Ada Obi', phone: '+234 803 123 4567' });
    expect(validateContactDetails('Ada', '+234 803 123 4567')).toEqual({ ok: true, name: 'Ada', phone: '+234 803 123 4567' });
  });

  it('needs a name', () => {
    expect(validateContactDetails('   ', '08031234567')).toEqual({ ok: false, error: 'Enter your name' });
  });

  it('limits the name to 80 characters', () => {
    expect(validateContactDetails('a'.repeat(81), '08031234567')).toEqual({ ok: false, error: 'Use 80 characters or fewer for your name' });
    expect(validateContactDetails('a'.repeat(80), '08031234567').ok).toBe(true);
  });

  it('needs a valid Nigerian phone number, with the same wording the driver app gives', () => {
    expect(validateContactDetails('Ada', '')).toEqual({ ok: false, error: 'Phone number is required.' });
    expect(validateContactDetails('Ada', '12345')).toEqual({
      ok: false,
      error: 'Please enter a valid Nigerian phone number (e.g. 0803 123 4567 or +234 803 123 4567).',
    });
  });
});

describe('friendlyProfileError', () => {
  it('explains a phone problem, a lost session, and never echoes anything else', () => {
    expect(friendlyProfileError('A valid Nigerian phone number is required')).toBe("That phone number isn't valid. Use a Nigerian number like 0803 123 4567");
    expect(friendlyProfileError('JWT expired')).toBe('Sign in again, then try once more');
    expect(friendlyProfileError('permission denied for table profiles')).toBe('Sign in again, then try once more');
    expect(friendlyProfileError('internal secret detail 500')).toBe('Could not save your details. Try again');
    expect(friendlyProfileError('')).toBe('Could not save your details. Try again');
  });
});
