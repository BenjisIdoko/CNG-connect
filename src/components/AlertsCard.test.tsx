import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AlertsCard } from './AlertsCard';
import { describeAlertsCard, type AlertsCardFacts } from '../utils/alertsCard';

const ready: AlertsCardFacts = {
  isSignedIn: true,
  keyConfigured: true,
  device: { platform: 'android', iosVersion: null, isStandalone: false, canPush: true },
  permission: 'default',
  subscribed: false,
  homeState: 'Abuja FCT',
  favoriteCount: 2,
};
const render = (over: Partial<AlertsCardFacts> = {}, props: { busy?: boolean; testBusy?: boolean } = {}, device: Partial<AlertsCardFacts['device']> = {}) =>
  renderToStaticMarkup(
    <AlertsCard model={describeAlertsCard({ ...ready, ...over, device: { ...ready.device, ...device } })} onAction={() => undefined} {...props} />,
  );
const buttons = (html: string) => html.match(/<button[^>]*>/g) ?? [];

describe('AlertsCard', () => {
  it('is a labelled region with the state title and its words', () => {
    const html = render();
    expect(html).toContain('aria-label="Gas alerts"');
    expect(html).toContain('Get gas alerts');
    expect(html).toContain('Turn on gas alerts');
  });

  it('shows the three Home Screen steps as a numbered list for an iPhone in a Safari tab', () => {
    const html = render({}, {}, { platform: 'ios', iosVersion: { major: 17, minor: 1 }, isStandalone: false });
    expect(html).toContain('<ol');
    expect((html.match(/<li/g) ?? []).length).toBe(3);
    expect(html).toContain('Add to Home Screen');
    expect(buttons(html)).toHaveLength(0);
  });

  it('shows the turn-off and test buttons when alerts are on, with what the phone is watching', () => {
    const html = render({ subscribed: true, permission: 'granted' });
    expect(html).toContain('Gas alerts are on');
    expect(html).toContain('On for Abuja FCT and 2 favourite stations.');
    expect(html).toContain('Send me a test alert');
    expect(html).toContain('Turn off');
  });

  it('shows the blocked steps with a Try again button', () => {
    const html = render({ permission: 'denied' });
    expect(html).toContain('Notifications are blocked');
    expect(html).toContain('<ol');
    expect(html).toContain('Try again');
  });

  it('shows the note with a Choose state button when there is no home state', () => {
    const html = render({ homeState: '' });
    expect(html).toContain('Choose your home state');
    expect(html).toContain('Choose state');
  });

  it('gives every button a 44px tap target and a button type', () => {
    for (const html of [render(), render({ subscribed: true, permission: 'granted' }), render({ isSignedIn: false }), render({ homeState: '' })]) {
      expect(buttons(html).length).toBeGreaterThan(0);
      for (const tag of buttons(html)) {
        expect(tag).toMatch(/min-h-11/);
        expect(tag).toContain('type="button"');
      }
    }
  });

  it('says what is happening and disables the buttons while it works', () => {
    const turningOn = render({}, { busy: true });
    expect(turningOn).toContain('Turning on…');
    expect(turningOn).toContain('disabled=""');
    const testing = render({ subscribed: true, permission: 'granted' }, { testBusy: true });
    expect(testing).toContain('Sending…');
    expect(testing).toContain('disabled=""');
  });
});
