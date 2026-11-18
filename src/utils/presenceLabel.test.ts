import { describe, it, expect } from 'vitest';
import { describePresence } from './presenceLabel';

describe('describePresence', () => {
  it('says "1 car here - queuing" for one driver at a queuing station', () => {
    expect(describePresence(1, 'queue')).toBe('1 car here - queuing');
  });

  it('pluralises for more than one', () => {
    expect(describePresence(3, 'queue')).toBe('3 cars here - queuing');
  });

  it('leaves off "queuing" when the station is not queuing', () => {
    expect(describePresence(2, 'full')).toBe('2 cars here');
    expect(describePresence(1, 'out')).toBe('1 car here');
    expect(describePresence(1, 'unknown')).toBe('1 car here');
  });

  it('shows nothing when nobody is here', () => {
    expect(describePresence(0, 'queue')).toBeNull();
    expect(describePresence(-1, 'queue')).toBeNull();
  });
});
