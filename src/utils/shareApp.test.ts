import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../services/analytics', () => ({ track: vi.fn() }));

import { track } from '../services/analytics';
import { APP_SHARE_TEXT, APP_SHARE_TITLE, shareApp, shareAppToast } from './shareApp';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(track).mockClear();
});

describe('shareApp', () => {
  it('opens the share sheet with the bare app link when there is no referral code', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share });
    expect(await shareApp(null)).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: APP_SHARE_TITLE, text: APP_SHARE_TEXT, url: 'https://cngconnect.com.ng' });
    expect(track).toHaveBeenCalledWith('share_clicked', { kind: 'app', referral: false });
  });

  it('never mentions the airtime promo in what it shares', () => {
    expect(APP_SHARE_TEXT).not.toMatch(/₦|naira|airtime|earn/i);
  });

  it('copies the message and link where there is no share sheet', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await shareApp(null)).toBe('copied');
    expect(writeText).toHaveBeenCalledWith(`${APP_SHARE_TEXT} https://cngconnect.com.ng`);
  });

  it('treats closing the share sheet as cancelled, not a failure', async () => {
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new DOMException('closed', 'AbortError')) });
    expect(await shareApp(null)).toBe('cancelled');
  });

  it('reports a failure when sharing and copying are both unavailable', async () => {
    vi.stubGlobal('navigator', {});
    expect(await shareApp(null)).toBe('failed');
  });
});

describe('shareAppToast', () => {
  it('says something only when the driver needs to know', () => {
    expect(shareAppToast('shared')).toBeNull();
    expect(shareAppToast('cancelled')).toBeNull();
    expect(shareAppToast('copied')).toMatch(/copied/i);
    expect(shareAppToast('failed')).toMatch(/could not/i);
  });
});
