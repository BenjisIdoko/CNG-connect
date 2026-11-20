import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PasswordSignInForm } from './PasswordSignInForm';

const render = (footer?: React.ReactNode) =>
  renderToStaticMarkup(
    <PasswordSignInForm
      title="Station manager"
      description="Sign in with your email and password."
      onSubmit={async () => ({ success: true })}
      onExit={() => undefined}
      footer={footer}
    />,
  );

describe('PasswordSignInForm', () => {
  it('shows the title, the description, and a labelled email and password', () => {
    const out = render();
    expect(out).toContain('Station manager');
    expect(out).toContain('Sign in with your email and password.');
    expect(out).toMatch(/<label[^>]*for="admin-email"[^>]*>Email<\/label>/);
    expect(out).toMatch(/<label[^>]*for="admin-password"[^>]*>Password<\/label>/);
  });

  it('lets a password manager fill and save: username and current-password', () => {
    const out = render();
    expect(out).toMatch(/<input[^>]*id="admin-email"[^>]*autoComplete="username"|<input[^>]*autoComplete="username"[^>]*id="admin-email"/);
    expect(out).toMatch(/<input[^>]*id="admin-password"[^>]*autoComplete="current-password"|<input[^>]*autoComplete="current-password"[^>]*id="admin-password"/);
    expect(out).toContain('type="password"');
  });

  it('has a Sign in button, a way back to the app, and the footer only when one is given', () => {
    expect(render()).toContain('Sign in');
    expect(render()).toContain('Back to app');
    expect(render()).not.toContain('Email me a code');
    expect(render(<button type="button">First time, or forgot your password? Email me a code</button>)).toContain('Email me a code');
  });
});
