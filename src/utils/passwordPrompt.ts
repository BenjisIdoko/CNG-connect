/**
 * Remembers, for this browser tab, that a manager just signed in with an emailed code and should be
 * asked to set a password. Session storage on purpose: the question is about this visit only.
 * Every call is safe when storage is blocked (private modes): the prompt is then simply not shown.
 */
type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const KEY = 'cng_manager_set_password_prompt';

const defaultStorage = (): KeyValueStorage | null => {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
};

export function markSetPasswordPrompt(storage: KeyValueStorage | null = defaultStorage()): void {
  try {
    storage?.setItem(KEY, '1');
  } catch {
    /* storage blocked: no prompt */
  }
}

export function shouldPromptSetPassword(storage: KeyValueStorage | null = defaultStorage()): boolean {
  try {
    return storage?.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function clearSetPasswordPrompt(storage: KeyValueStorage | null = defaultStorage()): void {
  try {
    storage?.removeItem(KEY);
  } catch {
    /* storage blocked */
  }
}
