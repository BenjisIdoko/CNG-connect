import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StationQuickUpdate } from './StationQuickUpdate';
import { formatWatTime, type ManagerState, type ManagerStateReason } from '../../utils/managerState';

const minsAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();

const render = (patch: { state?: ManagerState | null; reason?: ManagerStateReason | null; until?: string | null; minsOld?: number } = {}) =>
  renderToStaticMarkup(
    <StationQuickUpdate
      stationId="s1"
      stationName="NIPCO Kubwa"
      city="Abuja FCT"
      managerState={patch.state ?? null}
      managerStateAt={patch.state ? minsAgo(patch.minsOld ?? 10) : null}
      managerStateReason={patch.reason ?? null}
      managerStateUntil={patch.until ?? null}
      managerSelling={null}
      managerSellingAt={null}
      livePressureBar={null}
      livePressureAt={null}
      pumpPressure={null}
      flash={() => undefined}
      onPosted={() => undefined}
    />,
  );

describe('StationQuickUpdate details', () => {
  it('offers a reason and an expected time under a Closed post', () => {
    const out = render({ state: 'closed' });
    expect(out).toContain('Why?');
    for (const label of ['Waiting for supply', 'Technical fault', 'No power', 'Other']) expect(out).toContain(label);
    expect(out).toContain('Expected back');
    for (const label of ['In 1 hour', 'In 2 hours', 'In 4 hours']) expect(out).toContain(label);
    expect(out).toContain('type="time"');
    expect(out).toContain('Save details');
  });

  it('offers them under an Open, waiting post too', () => {
    expect(render({ state: 'open' })).toContain('Save details');
  });

  it('shows nothing of the kind under a gas-available post or with no post', () => {
    for (const out of [render({ state: 'selling' }), render()]) {
      expect(out).not.toContain('Why?');
      expect(out).not.toContain('Save details');
    }
  });

  it('marks the current reason as pressed and says what drivers currently read', () => {
    const untilMs = Date.now() + 2 * 3600000;
    const out = render({ state: 'closed', reason: 'supply', until: new Date(untilMs).toISOString() });
    expect(out).toMatch(/aria-pressed="true"[^>]*>Waiting for supply/);
    expect(out).toContain(`Expected back about ${formatWatTime(untilMs)}`);
  });

  it('every new control is at least 44px tall', () => {
    const out = render({ state: 'closed' });
    const details = out.slice(out.indexOf('Why?'), out.indexOf('Gas pressure'));
    const buttons = details.match(/<button[^>]*>/g) || [];
    expect(buttons.length).toBeGreaterThanOrEqual(9);
    for (const tag of buttons) expect(tag).toContain('min-h-[44px]');
    expect(details.match(/<input[^>]*type="time"[^>]*>/)?.[0]).toContain('min-h-[44px]');
    expect(details.match(/<input[^>]*type="time"[^>]*>/)?.[0]).toContain('max-md:text-base');
  });
});

describe('StationQuickUpdate WhatsApp share', () => {
  it('is disabled until there is a post to share', () => {
    expect(render()).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*Share update on WhatsApp/);
  });

  it('is enabled once the manager has posted', () => {
    const out = render({ state: 'selling' });
    expect(out).toContain('Share update on WhatsApp');
    expect(out).not.toMatch(/<button[^>]*disabled=""[^>]*>[^<]*Share update on WhatsApp/);
  });
});

describe('StationQuickUpdate with an old post', () => {
  it('says drivers now see it as "last said" and asks the manager to post again', () => {
    const out = render({ state: 'closed', minsOld: 500 });
    expect(out).toContain('last said');
    expect(out).toContain('Tap a status to post again');
  });

  it('still offers the reason and time controls', () => {
    expect(render({ state: 'closed', minsOld: 500 })).toContain('Save details');
  });

  it('does not offer to share a post that is no longer current', () => {
    expect(render({ state: 'closed', minsOld: 500 })).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*Share update on WhatsApp/);
  });

  it('a current post says how long drivers see it', () => {
    expect(render({ state: 'closed' })).toContain('drivers see it');
  });
});

describe('StationQuickUpdate with a community post of gas not available', () => {
  it('does not offer a reason and time for it: that post has none and the card cannot resend it', () => {
    const out = render({ state: 'out' });
    expect(out).not.toContain('Why?');
    expect(out).not.toContain('Save details');
  });
});

