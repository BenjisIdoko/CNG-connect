import { describe, expect, it } from 'vitest';
import { describeAlertsCard, parseIosVersion, type AlertsCardFacts } from './alertsCard';

const ready: AlertsCardFacts = {
  isSignedIn: true,
  keyConfigured: true,
  device: { platform: 'android', iosVersion: null, isStandalone: false, canPush: true },
  permission: 'default',
  subscribed: false,
  homeState: 'Abuja FCT',
  favoriteCount: 0,
};
const facts = (over: Partial<AlertsCardFacts> = {}, device: Partial<AlertsCardFacts['device']> = {}): AlertsCardFacts => ({
  ...ready,
  ...over,
  device: { ...ready.device, ...device },
});

describe('parseIosVersion', () => {
  it('reads the iOS version from an iPhone or iPad user agent', () => {
    expect(parseIosVersion('Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15')).toEqual({ major: 16, minor: 4 });
    expect(parseIosVersion('Mozilla/5.0 (iPad; CPU OS 17_2_1 like Mac OS X)')).toEqual({ major: 17, minor: 2 });
  });
  it('is null for anything else, including an iPad that reports as a Mac', () => {
    expect(parseIosVersion('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120')).toBeNull();
    expect(parseIosVersion('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBeNull();
    expect(parseIosVersion('')).toBeNull();
  });
});

describe('describeAlertsCard: which state the card shows', () => {
  it('asks a signed-out person to sign in, before anything about their phone', () => {
    const card = describeAlertsCard(facts({ isSignedIn: false }, { platform: 'ios', isStandalone: false }));
    expect(card.kind).toBe('signed_out');
    expect(card.title).toBe('Sign in to get gas alerts');
    expect(card.primary).toEqual({ label: 'Sign in', action: 'sign_in' });
  });

  it('says alerts are not set up yet, with no button, when the build has no push key', () => {
    const card = describeAlertsCard(facts({ keyConfigured: false }));
    expect(card.kind).toBe('not_set_up');
    expect(card.primary).toBeUndefined();
  });

  it('tells an iPhone older than iOS 16.4 to update', () => {
    const card = describeAlertsCard(facts({}, { platform: 'ios', iosVersion: { major: 16, minor: 3 } }));
    expect(card.kind).toBe('ios_old');
    expect(card.body).toContain('iOS 16.4');
    expect(card.primary).toBeUndefined();
  });

  it('gives an iPhone in a Safari tab three steps to the Home Screen', () => {
    const card = describeAlertsCard(facts({}, { platform: 'ios', iosVersion: { major: 17, minor: 0 }, isStandalone: false }));
    expect(card.kind).toBe('ios_install');
    expect(card.steps).toHaveLength(3);
    expect(card.steps?.[0]).toContain('Share');
    expect(card.steps?.[1]).toContain('Add to Home Screen');
    expect(card.steps?.[2]).toContain('Home Screen');
    expect(card.primary).toBeUndefined();
  });

  it('treats iOS 16.4 exactly as new enough, and an installed iPhone as ready', () => {
    expect(describeAlertsCard(facts({}, { platform: 'ios', iosVersion: { major: 16, minor: 4 }, isStandalone: true })).kind).toBe('off');
    expect(describeAlertsCard(facts({}, { platform: 'ios', iosVersion: { major: 18, minor: 0 }, isStandalone: true })).kind).toBe('off');
  });

  it('says so when this browser cannot receive alerts', () => {
    const card = describeAlertsCard(facts({}, { canPush: false }));
    expect(card.kind).toBe('unsupported');
    expect(card.primary).toBeUndefined();
  });

  it('shows the turn-on button when alerts are off and the phone is ready', () => {
    const card = describeAlertsCard(facts());
    expect(card.kind).toBe('off');
    expect(card.title).toBe('Get gas alerts');
    expect(card.primary).toEqual({ label: 'Turn on gas alerts', action: 'enable' });
  });

  it('shows steps for the phone when notifications are blocked, even if alerts were on before', () => {
    const android = describeAlertsCard(facts({ permission: 'denied', subscribed: true }));
    expect(android.kind).toBe('blocked');
    expect(android.steps?.join(' ')).toMatch(/lock icon|App info/);
    expect(android.primary).toEqual({ label: 'Try again', action: 'enable' });

    const iphone = describeAlertsCard(facts({ permission: 'denied' }, { platform: 'ios', iosVersion: { major: 17, minor: 0 }, isStandalone: true }));
    expect(iphone.kind).toBe('blocked');
    expect(iphone.steps?.join(' ')).toContain('Settings');
    expect(iphone.steps?.join(' ')).toContain('Notifications');

    const desktop = describeAlertsCard(facts({ permission: 'denied' }, { platform: 'other' }));
    expect(desktop.steps?.join(' ')).toContain('address bar');
  });
});

describe('describeAlertsCard: alerts on', () => {
  const on = (over: Partial<AlertsCardFacts> = {}) => describeAlertsCard(facts({ subscribed: true, permission: 'granted', ...over }));

  it('names what the phone is watching: the state and the favourites', () => {
    expect(on({ favoriteCount: 2 }).body).toBe('On for Abuja FCT and 2 favourite stations.');
    expect(on({ favoriteCount: 1 }).body).toBe('On for Abuja FCT and 1 favourite station.');
    expect(on({ favoriteCount: 0 }).body).toBe('On for Abuja FCT.');
  });

  it('offers the test alert and turning off', () => {
    const card = on();
    expect(card.kind).toBe('on');
    expect(card.title).toBe('Gas alerts are on');
    expect(card.primary).toEqual({ label: 'Send me a test alert', action: 'test' });
    expect(card.secondary).toEqual({ label: 'Turn off', action: 'disable' });
  });

  it('asks for a home state when there is none, and says only favourites can alert without one', () => {
    const withFavourites = on({ homeState: '', favoriteCount: 3 });
    expect(withFavourites.body).toBe('On for your 3 favourite stations.');
    expect(withFavourites.note).toEqual({
      text: 'Choose your home state so we know which stations to alert you about.',
      action: { label: 'Choose state', action: 'choose_state' },
    });
    const nothing = on({ homeState: '', favoriteCount: 0 });
    expect(nothing.body).toBe('Choose your home state or favourite a station, and alerts will start.');
  });

  it('asks for a home state while alerts are off too', () => {
    expect(describeAlertsCard(facts({ homeState: '' })).note?.action?.action).toBe('choose_state');
    expect(describeAlertsCard(facts({ homeState: 'Lagos' })).note).toBeUndefined();
  });
});
