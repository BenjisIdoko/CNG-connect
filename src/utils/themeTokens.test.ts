import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Dark mode is a set of CSS custom properties overridden in two places (the system-preference
// media query and the explicit data-theme="dark"), and forced-light regions (onboarding, sign-in,
// the desktop panels) restore the light values through [data-theme="light"]. If a token is
// darkened but never restored, those light regions silently turn dark-on-dark.
const css = readFileSync('src/index.css', 'utf8');

const tokensIn = (block: string) => new Set([...block.matchAll(/(--color-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));

function blockAfter(marker: string): string {
  const start = css.indexOf(marker);
  if (start < 0) throw new Error(`marker not found: ${marker}`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`unterminated block: ${marker}`);
}

describe('theme tokens', () => {
  const darkExplicit = tokensIn(blockAfter(':root[data-theme="dark"]'));
  const darkSystem = tokensIn(blockAfter(':root:not([data-theme="light"])'));
  const lightForced = tokensIn(blockAfter('[data-theme="light"] {'));

  it('darkens the same tokens for the system preference and the explicit choice', () => {
    expect([...darkSystem].sort()).toEqual([...darkExplicit].sort());
  });

  it('restores every darkened token inside forced-light regions', () => {
    const missing = [...darkExplicit].filter((t) => !lightForced.has(t));
    expect(missing).toEqual([]);
  });

  it('has dark values for the roles that flip around the constant ink surface', () => {
    for (const role of ['--color-rd-fg', '--color-rd-surface', '--color-rd-selected', '--color-rd-on-selected', '--color-rd-bg']) {
      expect(darkExplicit.has(role), role).toBe(true);
    }
  });
});
