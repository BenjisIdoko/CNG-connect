import { describe, it, expect } from 'vitest';
import { parseCsv, toCsv } from './csv';

describe('csv', () => {
  it('parses a simple header + row', () => {
    expect(parseCsv('id,name\nabc,Hello')).toEqual([
      ['id', 'name'],
      ['abc', 'Hello'],
    ]);
  });

  it('handles quoted fields with embedded commas and newlines', () => {
    const text = 'id,name\n1,"Nipco, Agbor Road"\n2,"Multi\nline"';
    expect(parseCsv(text)).toEqual([
      ['id', 'name'],
      ['1', 'Nipco, Agbor Road'],
      ['2', 'Multi\nline'],
    ]);
  });

  it('unescapes doubled quotes', () => {
    expect(parseCsv('name\n"Say ""hi"""')).toEqual([['name'], ['Say "hi"']]);
  });

  it('ignores trailing blank lines', () => {
    expect(parseCsv('id,name\n1,A\n\n')).toEqual([
      ['id', 'name'],
      ['1', 'A'],
    ]);
  });

  it('round-trips values that need escaping', () => {
    const csv = toCsv(['id', 'name'], [['1', 'Nipco, Agbor Road'], ['2', 'Say "hi"']]);
    expect(parseCsv(csv)).toEqual([
      ['id', 'name'],
      ['1', 'Nipco, Agbor Road'],
      ['2', 'Say "hi"'],
    ]);
  });
});
