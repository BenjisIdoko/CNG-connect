/**
 * What the Alerts card on Profile shows. Every situation a phone can be in gets its own state with its own
 * words, so a driver is never left with a switch that does nothing and a toast that says why.
 */
export type IosVersion = { major: number; minor: number };

export type AlertsDevice = {
  platform: 'ios' | 'android' | 'other';
  /** Only known on an iPhone or iPad. */
  iosVersion: IosVersion | null;
  /** Running as an installed app from the Home Screen, not in a browser tab. */
  isStandalone: boolean;
  /** The browser has a service worker, a push manager and notifications. */
  canPush: boolean;
};

export type AlertsCardFacts = {
  isSignedIn: boolean;
  /** The public push key is configured for this build. */
  keyConfigured: boolean;
  device: AlertsDevice;
  permission: 'default' | 'granted' | 'denied';
  /** This phone is registered for alerts. */
  subscribed: boolean;
  /** The profile's home state, or '' when none is saved. */
  homeState: string;
  favoriteCount: number;
};

export type AlertsCardAction = 'sign_in' | 'enable' | 'disable' | 'test' | 'choose_state';
export type AlertsCardButton = { label: string; action: AlertsCardAction };

export type AlertsCardModel = {
  kind: 'signed_out' | 'not_set_up' | 'ios_old' | 'ios_install' | 'unsupported' | 'blocked' | 'off' | 'on';
  title: string;
  body?: string;
  steps?: string[];
  primary?: AlertsCardButton;
  secondary?: AlertsCardButton;
  note?: { text: string; action?: AlertsCardButton };
};

/** iPhone and iPad user agents carry the version as "OS 16_4". An iPad that reports as a Mac has none. */
export function parseIosVersion(userAgent: string): IosVersion | null {
  const match = /\b(?:iPhone |CPU )OS (\d+)_(\d+)/.exec(userAgent);
  return match ? { major: Number(match[1]), minor: Number(match[2]) } : null;
}

/** Web push on an iPhone arrived in iOS 16.4. */
const iosHasWebPush = (v: IosVersion | null) => v === null || v.major > 16 || (v.major === 16 && v.minor >= 4);

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const BLOCKED_STEPS: Record<AlertsDevice['platform'], string[]> = {
  ios: [
    'Open the Settings app on your iPhone.',
    'Tap Notifications, then CNG-Connect.',
    'Turn on Allow Notifications, then come back here.',
  ],
  android: [
    'Tap the lock icon next to the address, or hold the app icon and tap App info.',
    'Tap Notifications.',
    'Allow notifications, then come back here.',
  ],
  other: [
    'Click the lock icon in the address bar.',
    'Set Notifications to Allow.',
    'Reload this page.',
  ],
};

const STATE_NOTE: AlertsCardModel['note'] = {
  text: 'Choose your home state so we know which stations to alert you about.',
  action: { label: 'Choose state', action: 'choose_state' },
};

export function describeAlertsCard(f: AlertsCardFacts): AlertsCardModel {
  if (!f.isSignedIn) {
    return {
      kind: 'signed_out',
      title: 'Sign in to get gas alerts',
      body: 'We tell you when gas arrives at your favourite stations and across your state.',
      primary: { label: 'Sign in', action: 'sign_in' },
    };
  }
  if (!f.keyConfigured) {
    return { kind: 'not_set_up', title: 'Gas alerts are not ready yet', body: 'They will be available soon.' };
  }
  const { device } = f;
  if (device.platform === 'ios' && !iosHasWebPush(device.iosVersion)) {
    return {
      kind: 'ios_old',
      title: 'Update your iPhone for gas alerts',
      body: 'Gas alerts need iOS 16.4 or newer. Update, then add CNG-Connect to your Home Screen.',
    };
  }
  if (device.platform === 'ios' && !device.isStandalone) {
    return {
      kind: 'ios_install',
      title: 'Add CNG-Connect to your Home Screen',
      body: 'On iPhone, gas alerts work from the Home Screen app.',
      steps: [
        'Tap the Share button in Safari.',
        'Choose Add to Home Screen.',
        'Open CNG-Connect from your Home Screen and come back here.',
      ],
    };
  }
  if (!device.canPush) {
    return {
      kind: 'unsupported',
      title: "This browser can't get alerts",
      body: 'Open CNG-Connect in Chrome or Safari.',
    };
  }
  if (f.permission === 'denied') {
    return {
      kind: 'blocked',
      title: 'Notifications are blocked',
      body: 'Allow them for CNG-Connect to get gas alerts.',
      steps: BLOCKED_STEPS[device.platform],
      primary: { label: 'Try again', action: 'enable' },
    };
  }

  const hasState = f.homeState.trim() !== '';
  const note = hasState ? undefined : STATE_NOTE;
  if (f.subscribed) {
    const favourites = plural(f.favoriteCount, 'favourite station', 'favourite stations');
    let body: string;
    if (hasState && f.favoriteCount > 0) body = `On for ${f.homeState} and ${favourites}.`;
    else if (hasState) body = `On for ${f.homeState}.`;
    else if (f.favoriteCount > 0) body = `On for your ${favourites}.`;
    else body = 'Choose your home state or favourite a station, and alerts will start.';
    return {
      kind: 'on',
      title: 'Gas alerts are on',
      body,
      primary: { label: 'Send me a test alert', action: 'test' },
      secondary: { label: 'Turn off', action: 'disable' },
      // With favourites but no state, the body already says so; the note then asks for the state.
      note: hasState || f.favoriteCount === 0 ? undefined : note,
    };
  }
  return {
    kind: 'off',
    title: 'Get gas alerts',
    body: 'We tell you when gas arrives at your favourite stations and across your state.',
    primary: { label: 'Turn on gas alerts', action: 'enable' },
    note,
  };
}
