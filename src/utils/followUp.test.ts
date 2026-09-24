import { beforeEach, describe, expect, it } from 'vitest';
import { rememberFollowUp, takeDueFollowUp } from './followUp';

const store: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  (globalThis as any).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  };
});

const T0 = 1_700_000_000_000;
const min = (n: number) => n * 60_000;

describe('follow-up prompt timing', () => {
  it('waits until the driver has had time to get there', () => {
    rememberFollowUp({ id: 's1', name: 'Test' }, T0);
    expect(takeDueFollowUp(T0 + min(2))).toBeNull();
    expect(takeDueFollowUp(T0 + min(10))).toEqual({ id: 's1', name: 'Test' });
  });

  it('only asks once per visit', () => {
    rememberFollowUp({ id: 's1', name: 'Test' }, T0);
    expect(takeDueFollowUp(T0 + min(10))).not.toBeNull();
    expect(takeDueFollowUp(T0 + min(11))).toBeNull();
  });

  it('drops it after 4 hours', () => {
    rememberFollowUp({ id: 's1', name: 'Test' }, T0);
    expect(takeDueFollowUp(T0 + min(300))).toBeNull();
    expect(takeDueFollowUp(T0 + min(301))).toBeNull(); // and does not resurface
  });

  it('does not nag about the same station again within 6 hours', () => {
    rememberFollowUp({ id: 's1', name: 'Test' }, T0);
    expect(takeDueFollowUp(T0 + min(10))).not.toBeNull();
    rememberFollowUp({ id: 's1', name: 'Test' }, T0 + min(30));
    expect(takeDueFollowUp(T0 + min(60))).toBeNull();
    // a different station is fine
    rememberFollowUp({ id: 's2', name: 'Other' }, T0 + min(70));
    expect(takeDueFollowUp(T0 + min(90))).toEqual({ id: 's2', name: 'Other' });
  });
});
