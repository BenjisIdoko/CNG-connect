import { describe, it, expect } from 'vitest';
import { validatePhoneNumber, generateMockOtp } from './phoneValidator';

describe('Strict Nigerian Phone Format Validation', () => {
  it('accepts valid 11-digit Nigerian number starting with 0 (e.g., 08031234567)', () => {
    const res = validatePhoneNumber('0803 123 4567');
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe('+2348031234567');
    expect(res.formatted).toBe('+234 803 123 4567');
  });

  it('accepts valid international format starting with +234 (e.g., +2348031234567)', () => {
    const res = validatePhoneNumber('+2348031234567');
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe('+2348031234567');
  });

  it('accepts 10-digit number without leading zero (e.g., 8031234567)', () => {
    const res = validatePhoneNumber('8031234567');
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe('+2348031234567');
  });

  it('rejects empty input', () => {
    const res = validatePhoneNumber('');
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('required');
  });

  it('rejects invalid area code prefixes (e.g., 01031234567)', () => {
    const res = validatePhoneNumber('01031234567');
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('valid Nigerian phone number');
  });

  it('rejects phone numbers with insufficient digits', () => {
    const res = validatePhoneNumber('0803123');
    expect(res.isValid).toBe(false);
  });

  it('rejects non-numeric input', () => {
    const res = validatePhoneNumber('0803ABC4567');
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('digits only');
  });
});

describe('Mock OTP Generator', () => {
  it('returns test OTP code 123456', () => {
    expect(generateMockOtp()).toBe('123456');
  });
});
