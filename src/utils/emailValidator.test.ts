import { describe, it, expect } from 'vitest';
import { validateEmail } from './emailValidator';

describe('validateEmail', () => {
  it('rejects empty input', () => {
    expect(validateEmail('').isValid).toBe(false);
    expect(validateEmail('   ').isValid).toBe(false);
  });

  it('rejects strings without an @ or domain', () => {
    expect(validateEmail('notanemail').isValid).toBe(false);
    expect(validateEmail('missing@domain').isValid).toBe(false);
    expect(validateEmail('@nodomain.com').isValid).toBe(false);
  });

  it('accepts a well-formed address and normalizes case/whitespace', () => {
    const res = validateEmail('  Driver@Example.COM  ');
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe('driver@example.com');
  });
});
