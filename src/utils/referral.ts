// Referral links: a driver shares https://cngconnect.com.ng/?ref=CODE. The code is kept in this
// browser until the friend finishes signing up, then claimed once (see App.tsx).

export const APP_URL = 'https://cngconnect.com.ng';
const KEY = 'cng_ref_code';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Codes are 4-12 letters/digits; anything else is ignored. */
export function parseReferralCode(value: string | null | undefined): string | null {
  const v = (value ?? '').trim().toUpperCase();
  return /^[A-Z0-9]{4,12}$/.test(v) ? v : null;
}

export function buildInviteUrl(code?: string | null): string {
  const c = parseReferralCode(code);
  return c ? `${APP_URL}/?ref=${c}` : APP_URL;
}

/** Remember ?ref=CODE from the address bar (and tidy it out of the URL). */
export function captureReferralFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    const code = parseReferralCode(url.searchParams.get('ref'));
    if (!url.searchParams.has('ref')) return;
    if (code) localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }));
    url.searchParams.delete('ref');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  } catch {
    /* storage or history unavailable: the promo just won't attach */
  }
}

export function setPendingReferral(code: string): void {
  const c = parseReferralCode(code);
  if (!c) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ code: c, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function getPendingReferral(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { code, at } = JSON.parse(raw);
    if (typeof at !== 'number' || Date.now() - at > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parseReferralCode(code);
  } catch {
    return null;
  }
}

export function clearPendingReferral(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
