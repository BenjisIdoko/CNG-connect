import { describe, it, expect } from 'vitest';
import { isDarkTheme } from './theme';

describe('isDarkTheme', () => {
  it('follows the system when no theme is chosen', () => {
    expect(isDarkTheme(null, true)).toBe(true);
    expect(isDarkTheme(null, false)).toBe(false);
  });

  it('lets an explicit choice beat the system either way', () => {
    expect(isDarkTheme('dark', false)).toBe(true);
    expect(isDarkTheme('light', true)).toBe(false);
  });
});
