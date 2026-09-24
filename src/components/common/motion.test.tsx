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

  it('BottomNav positions the sliding bubble under the active tab', () => {
    const html = renderToString(<BottomNav activeTab="community" onTabChange={() => {}} />);
    expect(html).toContain('translateX(200%)');
  });
});
