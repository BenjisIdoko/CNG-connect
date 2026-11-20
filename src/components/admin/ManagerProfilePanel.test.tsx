import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ManagerProfilePanel } from './ManagerProfilePanel';

const ok = async () => ({ success: true });

const html = renderToStaticMarkup(
  <ManagerProfilePanel
    name="Ada Obi"
    phone="+234 803 123 4567"
    email="ada@example.com"
    onSaveDetails={ok}
    onChangePassword={ok}
    flash={() => undefined}
  />,
);

describe('ManagerProfilePanel', () => {
  it('has labelled name and phone fields filled with the current details', () => {
    expect(html).toMatch(/<label[^>]*for="profile-name"[^>]*>Name<\/label>/);
    expect(html).toMatch(/<label[^>]*for="profile-phone"[^>]*>Phone number<\/label>/);
    expect(html).toContain('value="Ada Obi"');
    expect(html).toContain('value="+234 803 123 4567"');
  });

  it('lets a phone keyboard and autofill do their job', () => {
    expect(html).toMatch(/<input[^>]*id="profile-phone"[^>]*type="tel"|<input[^>]*type="tel"[^>]*id="profile-phone"/);
    expect(html).toContain('inputMode="tel"');
    expect(html).toContain('autoComplete="tel"');
    expect(html).toContain('autoComplete="name"');
  });

  it('shows the email as plain text, not as something to edit, and says why', () => {
    expect(html).toContain('ada@example.com');
    expect(html).not.toMatch(/<input[^>]*value="ada@example.com"/);
    expect(html).toContain('cannot be changed here');
  });

  it('has a Save details button and a Change password section with two new-password fields', () => {
    expect(html).toContain('Save details');
    expect(html).toContain('Change password');
    expect((html.match(/autoComplete="new-password"/g) || []).length).toBe(2);
    expect(html).not.toContain('Not now');
  });

  it('keeps fields at 16px on phones and buttons 44px tall', () => {
    expect(html).toContain('max-md:text-base');
    for (const tag of html.match(/<button[^>]*>/g) || []) expect(tag).toMatch(/min-h-\[44px\]|max-md:h-11/);
  });

  it('never shows a station contact number or a password', () => {
    expect(html).not.toMatch(/value="[^"]*password/i);
  });
});
