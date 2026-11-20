import { describe, expect, it } from 'vitest';
import { clearSetPasswordPrompt, markSetPasswordPrompt, shouldPromptSetPassword } from './passwordPrompt';

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
};

describe('set-password prompt flag', () => {
  it('is off until a code sign-in marks it, and off again once cleared', () => {
    const storage = memoryStorage();
    expect(shouldPromptSetPassword(storage)).toBe(false);
    markSetPasswordPrompt(storage);
    expect(shouldPromptSetPassword(storage)).toBe(true);
    clearSetPasswordPrompt(storage);
    expect(shouldPromptSetPassword(storage)).toBe(false);
  });

  it('never throws when storage is unavailable, and then does not prompt', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => markSetPasswordPrompt(broken)).not.toThrow();
    expect(() => clearSetPasswordPrompt(broken)).not.toThrow();
    expect(shouldPromptSetPassword(broken)).toBe(false);
  });
});
