import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CodeSignIn } from './CodeSignIn';
import { RESEND_COOLDOWN_MS, canResend, cleanCode, initialSignIn, nextSignIn } from './codeSignInState';

describe('nextSignIn', () => {
  it('starts on the email step with no error', () => {
    expect(initialSignIn()).toEqual({ step: 'email', email: '', error: null, sentAt: null });
  });

  it('moves to the code step once the code is sent, remembering the email and the time', () => {
    const s = nextSignIn(initialSignIn(), { type: 'sent', email: 'ada@example.com' }, 1000);
    expect(s).toEqual({ step: 'code', email: 'ada@example.com', error: null, sentAt: 1000 });
  });

  it('stays on the email step with the error when sending fails', () => {
    const s = nextSignIn(initialSignIn(), { type: 'failed', error: 'Could not send the code' }, 1000);
    expect(s.step).toBe('email');
    expect(s.error).toBe('Could not send the code');
  });

  it('stays on the code step with an error for a wrong code, and clears it on a resend', () => {
    const sent = nextSignIn(initialSignIn(), { type: 'sent', email: 'a@b.co' }, 1000);
    const wrong = nextSignIn(sent, { type: 'failed', error: 'That code is not right' }, 2000);
    expect(wrong.step).toBe('code');
    expect(wrong.error).toBe('That code is not right');
    const resent = nextSignIn(wrong, { type: 'sent', email: 'a@b.co' }, 9000);
    expect(resent).toEqual({ step: 'code', email: 'a@b.co', error: null, sentAt: 9000 });
  });

  it('goes back to the email step when the person wants a different email', () => {
    const sent = nextSignIn(initialSignIn(), { type: 'sent', email: 'a@b.co' }, 1000);
    const back = nextSignIn(sent, { type: 'change-email' }, 2000);
    expect(back).toEqual({ step: 'email', email: 'a@b.co', error: null, sentAt: null });
  });
});

describe('canResend', () => {
  it('is false before the cooldown ends and true after it', () => {
    const sent = nextSignIn(initialSignIn(), { type: 'sent', email: 'a@b.co' }, 1000);
    expect(canResend(sent, 1000 + RESEND_COOLDOWN_MS - 1)).toBe(false);
    expect(canResend(sent, 1000 + RESEND_COOLDOWN_MS)).toBe(true);
  });

  it('is false on the email step', () => {
    expect(canResend(initialSignIn(), 999999)).toBe(false);
  });
});

describe('cleanCode', () => {
  it('keeps only digits and accepts 4 to 10 of them', () => {
    expect(cleanCode(' 123 456 ')).toBe('123456');
    expect(cleanCode('12-34')).toBe('1234');
    expect(cleanCode('123')).toBeNull();
    expect(cleanCode('12345678901')).toBeNull();
    expect(cleanCode('')).toBeNull();
    expect(cleanCode('abcdef')).toBeNull();
  });
});

describe('CodeSignIn', () => {
  const html = renderToStaticMarkup(
    <CodeSignIn title="Station manager" onExit={() => undefined} sendCode={async () => ({ success: true })} verifyCode={async () => ({ success: true })} />,
  );

  it('opens on the email step with a Send me a code button and no password field', () => {
    expect(html).toContain('Station manager');
    expect(html).toContain('Send me a code');
    expect(html).toContain('type="email"');
    expect(html).not.toContain('type="password"');
  });

  it('tells the manager they need no password or driver sign-up, and offers a way back', () => {
    expect(html).toContain('No password');
    expect(html).toContain('Back to app');
  });
});

describe('CodeSignIn with a password option', () => {
  const render = (extra: { onUsePassword?: () => void; intro?: string } = {}) =>
    renderToStaticMarkup(
      <CodeSignIn title="Station manager" onExit={() => undefined} sendCode={async () => ({ success: true })} verifyCode={async () => ({ success: true })} {...extra} />,
    );

  it('offers "Use my password instead" only when asked to', () => {
    expect(render()).not.toContain('Use my password instead');
    expect(render({ onUsePassword: () => undefined })).toContain('Use my password instead');
  });

  it('can replace the sentence on the email step', () => {
    expect(render({ intro: 'After you sign in you can set a password.' })).toContain('After you sign in you can set a password.');
    expect(render()).toContain('No password and no CNG-Connect sign-up needed.');
  });
});
