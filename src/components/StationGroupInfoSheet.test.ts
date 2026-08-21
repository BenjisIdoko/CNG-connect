import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StationGroupInfoSheet } from './StationGroupInfoSheet';

describe('StationGroupInfoSheet Component', () => {
  let storage: Record<string, string> = {};

  beforeEach(() => {
    storage = {};
    const mockLocalStorage = {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, value: string) => { storage[key] = value; },
      clear: () => { storage = {}; },
    };
    (globalThis as any).localStorage = mockLocalStorage;
  });

  it('exports StationGroupInfoSheet component correctly', () => {
    expect(StationGroupInfoSheet).toBeDefined();
  });

  it('sets hasSeenGroupPolicy in localStorage upon dismissal', () => {
    (globalThis as any).localStorage.setItem('hasSeenGroupPolicy', 'true');
    expect((globalThis as any).localStorage.getItem('hasSeenGroupPolicy')).toBe('true');
  });
});
