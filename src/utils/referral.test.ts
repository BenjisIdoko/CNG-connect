import { beforeEach, describe, expect, it } from 'vitest';
import { buildInviteUrl, captureReferralFromUrl, clearPendingReferral, getPendingReferral, parseReferralCode } from './referral';

// Minimal browser stand-ins (the test environment is plain node).
const store: Record<string, string> = {};
let href = 'https://cngconnect.com.ng/';
const setUrl = (path: string) => {
  href = `https://cngconnect.com.ng${path}`;
};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  setUrl('/');
  (globalThis as any).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  };
  (globalThis as any).window = {
    get location() {
      return { href, get search() { return new URL(href).search; } };
    },
    history: {
      state: null,
      replaceState: (_s: unknown, _t: string, url: string) => {
        href = `https://cngconnect.com.ng${url}`;
      },
    },
  };
});

describe('referral links', () => {

  it('accepts only clean codes', () => {
    expect(parseReferralCode(' k7m2qx ')).toBe('K7M2QX');
    expect(parseReferralCode('ab')).toBeNull();
    expect(parseReferralCode('<script>alert(1)</script>')).toBeNull();
    expect(parseReferralCode(null)).toBeNull();
  });

  it('builds the invite link', () => {
    expect(buildInviteUrl('k7m2qx')).toBe('https://cngconnect.com.ng/?ref=K7M2QX');
    expect(buildInviteUrl(null)).toBe('https://cngconnect.com.ng');
  });

  it('captures the code from the address bar, removes it from the URL and can clear it', () => {
    setUrl('/?ref=k7m2qx&station=abc');
    captureReferralFromUrl();
    expect(getPendingReferral()).toBe('K7M2QX');
    expect(window.location.search).toBe('?station=abc');
    clearPendingReferral();
    expect(getPendingReferral()).toBeNull();
  });

  it('ignores an invalid code but still cleans the URL', () => {
    setUrl('/?ref=!!');
    captureReferralFromUrl();
    expect(getPendingReferral()).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('drops a code older than 30 days', () => {
    localStorage.setItem('cng_ref_code', JSON.stringify({ code: 'K7M2QX', at: Date.now() - 31 * 24 * 3600 * 1000 }));
    expect(getPendingReferral()).toBeNull();
  });
});
