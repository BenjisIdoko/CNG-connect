import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SuccessBurst } from './SuccessBurst';
import { CountUp } from './CountUp';
import { BottomNav } from '../BottomNav';

describe('motion components render', () => {
  it('SuccessBurst shows the confirmation in the status colour', () => {
    const html = renderToString(<SuccessBurst status="out" onDone={() => {}} />);
    expect(html).toContain('Report sent');
    expect(html).toContain('#E5484D');
    expect(html).toContain('check-draw');
  });

  it('CountUp renders its initial value with formatting', () => {
    expect(renderToString(<CountUp value={1234} format={(n) => n.toLocaleString('en-US')} />)).toContain('1,234');
  });

  it('BottomNav raises the active tab in a floating green circle', () => {
    const html = renderToString(<BottomNav activeTab="community" onTabChange={() => {}} />);
    // Redesign (2026-10): no shared sliding bubble — each tab's own button
    // renders the raised circle when it's the active one.
    expect(html).toContain('aria-label="Community" aria-current="page"');
    expect(html).toContain('-top-[34px]');
    expect(html.match(/-top-\[34px\]/g)).toHaveLength(1);
  });
});
