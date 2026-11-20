import { describe, expect, it } from 'vitest';
import { clearSetPasswordPrompt, markSetPasswordPrompt, shouldPromptSetPassword, verifyWithSetPasswordPrompt } from './passwordPrompt';

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

describe('verifyWithSetPasswordPrompt', () => {
  it('has the flag set BEFORE the code check finishes, so the page that appears on sign-in already sees it', async () => {
    const storage = memoryStorage();
    let flagWhileVerifying: boolean | null = null;
    await verifyWithSetPasswordPrompt(async () => {
      flagWhileVerifying = shouldPromptSetPassword(storage);
      return { success: true };
    }, storage);
    expect(flagWhileVerifying).toBe(true);
    expect(shouldPromptSetPassword(storage)).toBe(true);
  });

  it('clears the flag when the code was wrong, and returns the failure', async () => {
    const storage = memoryStorage();
    const result = await verifyWithSetPasswordPrompt(async () => ({ success: false, error: 'bad code' }), storage);
    expect(result).toEqual({ success: false, error: 'bad code' });
    expect(shouldPromptSetPassword(storage)).toBe(false);
  });

  it('clears the flag and rethrows when the check itself throws', async () => {
    const storage = memoryStorage();
    await expect(
      verifyWithSetPasswordPrompt(async () => {
        throw new Error('offline');
      }, storage),
    ).rejects.toThrow('offline');
    expect(shouldPromptSetPassword(storage)).toBe(false);
  });
});
