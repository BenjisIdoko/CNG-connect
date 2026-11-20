import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PushAlertPrompt } from './PushAlertPrompt';

const html = renderToStaticMarkup(<PushAlertPrompt busy={false} onAccept={() => undefined} onDismiss={() => undefined} />);

describe('PushAlertPrompt', () => {
  it('asks the question and offers two ways to answer', () => {
    expect(html).toContain('Get an alert when gas arrives here?');
    expect(html).toContain('Turn on alerts');
    expect(html).toContain('Not now');
    expect((html.match(/<button/g) || []).length).toBe(2);
  });

  it('says what the alert is, in a line', () => {
    expect(html).toContain('community manager');
  });

  it('has 44px tap targets and is a labelled region', () => {
    for (const tag of html.match(/<button[^>]*>/g) || []) expect(tag).toMatch(/min-h-11|min-h-\[44px\]/);
    expect(html).toContain('aria-label="Gas alerts"');
  });

  it('shows a busy state', () => {
    const busy = renderToStaticMarkup(<PushAlertPrompt busy onAccept={() => undefined} onDismiss={() => undefined} />);
    expect(busy).toContain('Turning on…');
    expect(busy).toContain('disabled=""');
  });
});
