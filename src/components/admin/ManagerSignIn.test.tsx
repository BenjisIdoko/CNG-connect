import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ManagerSignIn } from './ManagerSignIn';

const ok = async () => ({ success: true });

describe('ManagerSignIn', () => {
  const html = renderToStaticMarkup(
    <ManagerSignIn title="Station manager" onExit={() => undefined} signInWithPassword={ok} sendCode={ok} verifyCode={ok} />,
  );

  it('opens on the password form, never on the code screen, so signing out and in sends no code', () => {
    expect(html).toContain('Sign in with your email and password.');
    expect(html).toContain('type="password"');
    expect(html).not.toContain('Send me a code');
  });

  it('offers the code on request, for the first time or a forgotten password', () => {
    expect(html).toContain('First time, or forgot your password? Email me a code');
  });
});
