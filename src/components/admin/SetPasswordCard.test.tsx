import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SetPasswordCard } from './SetPasswordCard';

const html = renderToStaticMarkup(<SetPasswordCard onSave={async () => ({ success: true })} onDone={() => undefined} />);

describe('SetPasswordCard', () => {
  it('says what it is for', () => {
    expect(html).toContain('Set a password');
    expect(html).toContain('So you won&#x27;t need an emailed code next time.');
  });

  it('has two labelled password fields that a password manager will offer to save', () => {
    expect(html).toMatch(/<label[^>]*for="new-password"[^>]*>New password<\/label>/);
    expect(html).toMatch(/<label[^>]*for="new-password-again"[^>]*>Type it again<\/label>/);
    expect((html.match(/autoComplete="new-password"/g) || []).length).toBe(2);
    expect((html.match(/type="password"/g) || []).length).toBe(2);
  });

  it('has Save password and Not now buttons', () => {
    expect(html).toContain('Save password');
    expect(html).toContain('Not now');
  });

  it('keeps the fields readable on a phone (16px text) and the buttons 44px tall', () => {
    expect(html).toContain('max-md:text-base');
    const buttons = html.match(/<button[^>]*>/g) || [];
    expect(buttons.length).toBe(2);
    for (const tag of buttons) expect(tag).toMatch(/min-h-\[44px\]|max-md:h-11/);
  });

  it('shows the 8 character rule up front', () => {
    expect(html).toContain('At least 8 characters');
  });
});
