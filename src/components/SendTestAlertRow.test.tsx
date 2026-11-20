import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SendTestAlertRow } from './SendTestAlertRow';

const html = (busy = false) => renderToStaticMarkup(<SendTestAlertRow busy={busy} onSend={() => undefined} />);

describe('SendTestAlertRow', () => {
  it('says what it does and offers one button', () => {
    expect(html()).toContain('Send a test alert');
    expect(html()).toContain('Checks that alerts reach this phone');
    expect((html().match(/<button/g) || []).length).toBe(1);
  });

  it('has a 44px tap target and a clear label', () => {
    expect(html()).toMatch(/<button[^>]*min-h-11/);
    expect(html()).toContain('Send test');
  });

  it('shows a busy state and blocks a second tap', () => {
    const busy = html(true);
    expect(busy).toContain('Sending…');
    expect(busy).toContain('disabled=""');
  });
});
