import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OverviewData, OverviewView } from './OverviewView';
import type { QueueItem } from '../../utils/adminQueue';

const noop = () => undefined;
const TOTALS = { stations: 100, users: 161, managers: 2 };

const render = (data: OverviewData, extra: Partial<React.ComponentProps<typeof OverviewView>> = {}) =>
  renderToStaticMarkup(
    <OverviewView data={data} loading={false} errors={[]} lastVisitMs={null} onNavigate={noop} onRetry={noop} {...extra} />,
  );

const flagged = (id: string, createdAt: string): QueueItem => ({
  id,
  kind: 'flagged',
  title: `Station ${id}`,
  detail: '2 flags · by Ada',
  createdAt,
});

describe('OverviewView', () => {
  it('shows a closed thread and an honest empty state when nothing is waiting', () => {
    const html = render({ counts: { flagged: 0, suggestion: 0, pin: 0 }, items: [], totals: TOTALS });
    expect(html).toContain('All clear');
    expect(html).toContain('aria-label="Nothing needs attention"');
    expect(html).toContain('Nothing is waiting');
    expect(html).not.toContain('<table');
  });

  it('says how many things need attention and describes the thread for screen readers', () => {
    const html = render({
      counts: { flagged: 2, suggestion: 1, pin: 0 },
      items: [flagged('a', '2026-11-10T10:00:00Z'), flagged('b', '2026-11-11T10:00:00Z')],
      totals: TOTALS,
    });
    expect(html).toContain('3 things need you');
    expect(html).toContain('3 waiting: 2 flagged reports, 1 suggestions');
  });

  it('uses the singular for one item', () => {
    const html = render({ counts: { flagged: 1, suggestion: 0, pin: 0 }, items: [flagged('a', '2026-11-10T10:00:00Z')], totals: TOTALS });
    expect(html).toContain('1 thing needs you');
  });

  it('ranks the queue oldest first and tints items that are new since the last visit', () => {
    const html = render(
      {
        counts: { flagged: 2, suggestion: 0, pin: 0 },
        items: [flagged('newer', '2026-11-18T09:00:00Z'), flagged('older', '2026-11-10T09:00:00Z')],
        totals: TOTALS,
      },
      { lastVisitMs: Date.parse('2026-11-18T08:00:00Z') },
    );
    expect(html.indexOf('Station older')).toBeLessThan(html.indexOf('Station newer'));
    expect(html).toContain('data-state="new"');
    expect(html.match(/data-state="new"/g)).toHaveLength(1);
  });

  it('shows a dash for totals that could not be loaded and a Retry with the problem', () => {
    const html = render(
      { counts: null, items: [], totals: { stations: null, users: null, managers: null } },
      { errors: ['Flagged reports could not be loaded.'] },
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('Flagged reports could not be loaded.');
    expect(html).toContain('Retry');
    expect(html).toContain('Could not count what is waiting.');
    expect(html).not.toContain('All clear');
    expect(html).toContain('>—<');
  });

  it('limits the queue to 12 rows and says how many more there are', () => {
    const items = Array.from({ length: 15 }, (_, i) => flagged(String(i), `2026-11-${String(i + 1).padStart(2, '0')}T10:00:00Z`));
    const html = render({ counts: { flagged: 15, suggestion: 0, pin: 0 }, items, totals: TOTALS });
    expect(html.match(/<tr/g)).toHaveLength(13);
    expect(html).toContain('Showing the 12 oldest of 15');
  });

  it('shows the totals', () => {
    const html = render({ counts: { flagged: 0, suggestion: 0, pin: 0 }, items: [], totals: TOTALS });
    expect(html).toContain('Stations');
    expect(html).toContain('>161<');
    expect(html).toContain('Station managers');
  });
});
