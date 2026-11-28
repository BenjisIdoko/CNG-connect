import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectAlertsDevice, readNotificationPermission } from './alertsDevice';

const stubBrowser = (opts: { ua: string; platform?: string; touch?: number; standalone?: boolean; push?: boolean; permission?: string }) => {
  vi.stubGlobal('navigator', {
    userAgent: opts.ua,
    platform: opts.platform ?? '',
    maxTouchPoints: opts.touch ?? 0,
    standalone: opts.standalone,
    ...(opts.push === false ? {} : { serviceWorker: {} }),
  });
  vi.stubGlobal('window', {
    matchMedia: () => ({ matches: opts.standalone === true }),
    ...(opts.push === false ? {} : { PushManager: function PushManager() {}, Notification: { permission: opts.permission ?? 'default' } }),
  });
};

afterEach(() => vi.unstubAllGlobals());

describe('detectAlertsDevice', () => {
  it('knows an iPhone in a Safari tab, with its iOS version', () => {
    stubBrowser({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) Safari/604.1', standalone: false });
    expect(detectAlertsDevice()).toEqual({ platform: 'ios', iosVersion: { major: 17, minor: 2 }, isStandalone: false, canPush: true });
  });

  it('knows an installed iPhone app', () => {
    stubBrowser({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X)', standalone: true });
    expect(detectAlertsDevice()).toMatchObject({ platform: 'ios', isStandalone: true });
  });

  it('knows an iPad that reports itself as a Mac, with no version', () => {
    stubBrowser({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', touch: 5 });
    expect(detectAlertsDevice()).toMatchObject({ platform: 'ios', iosVersion: null });
  });

  it('knows Android and other browsers', () => {
    stubBrowser({ ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120 Mobile' });
    expect(detectAlertsDevice().platform).toBe('android');
    stubBrowser({ ua: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120' });
    expect(detectAlertsDevice().platform).toBe('other');
  });

  it('says a browser without push support cannot get alerts', () => {
    stubBrowser({ ua: 'Mozilla/5.0 (Linux; Android 9) Chrome/70', push: false });
    expect(detectAlertsDevice().canPush).toBe(false);
  });
});

describe('readNotificationPermission', () => {
  it('reads the browser permission, and treats no Notification support as default', () => {
    stubBrowser({ ua: 'x', permission: 'denied' });
    expect(readNotificationPermission()).toBe('denied');
    stubBrowser({ ua: 'x', permission: 'granted' });
    expect(readNotificationPermission()).toBe('granted');
    stubBrowser({ ua: 'x', push: false });
    expect(readNotificationPermission()).toBe('default');
  });
});
