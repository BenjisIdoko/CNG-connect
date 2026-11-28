import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The driver app reads like the ride apps drivers already use: one typeface, a handful of sizes, nothing tiny,
 * no shouting. This keeps screens from drifting back (the admin has its own rules in adminFonts.test.ts).
 */
const SRC = join(__dirname);
const CSS = readFileSync(join(SRC, 'index.css'), 'utf8');

const driverSources = (dir: string): { name: string; text: string }[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return entry === 'admin' || entry === 'ui' ? [] : driverSources(path);
    }
    return /\.tsx?$/.test(entry) && !/\.test\./.test(entry) ? [{ name: path.slice(SRC.length + 1), text: readFileSync(path, 'utf8') }] : [];
  });
const SOURCES = driverSources(SRC);

/** The quoted strings that look like class lists, so an icon's own size is not read as text size. */
const textClassStrings = (text: string) =>
  (text.match(/(["'`])(?:(?!\1).)*\1/g) ?? []).filter((s) => !s.includes('material-symbols'));

const tokenPx = (name: string) => {
  const match = CSS.match(new RegExp(`--text-${name}:\\s*([0-9.]+)rem`));
  expect(match, `--text-${name} is defined`).not.toBeNull();
  return Number(match![1]) * 16;
};

describe('driver app typography', () => {
  it('uses Geist alone: no Inter or Urbanist face, stack or heading rule', () => {
    expect(CSS).not.toMatch(/Urbanist/);
    expect(CSS).not.toMatch(/font-family:\s*'Inter'/);
    expect(CSS).not.toMatch(/\bInter\b[^*]*sans-serif/);
    expect(CSS).toMatch(/body\s*{\s*font-family:\s*'Geist'/);
  });

  it('keeps the naira sign and Yoruba letters, which Geist does not draw, under the Geist name', () => {
    expect(CSS).toMatch(/font-family:\s*'Geist';[^}]*inter-extra\.woff2[^}]*U\+20A6/);
  });

  it('has a size ramp that ascends and never goes below 13px', () => {
    const ramp = ['overline', 'micro', 'caption', 'body', 'body-lg', 'title', 'heading', 'display'].map(tokenPx);
    expect(ramp[0]).toBeGreaterThanOrEqual(13);
    expect(ramp[1]).toBeGreaterThanOrEqual(14);
    expect(ramp[2]).toBeGreaterThanOrEqual(15);
    expect([...ramp].sort((a, b) => a - b)).toEqual(ramp);
  });

  it('sets no text smaller than 13px with an arbitrary size or text-xs', () => {
    const tiny: string[] = [];
    for (const { name, text } of SOURCES) {
      for (const cls of textClassStrings(text)) {
        for (const m of cls.matchAll(/text-\[([0-9.]+)(px|rem)\]/g)) {
          const px = m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1]);
          if (px < 13) tiny.push(`${name}: ${m[0]}`);
        }
        if (/(?<![\w-])text-xs(?![\w-])/.test(cls)) tiny.push(`${name}: text-xs`);
      }
    }
    expect(tiny).toEqual([]);
  });

  it('never sets a heavier weight than bold, or all-caps text', () => {
    const loud: string[] = [];
    for (const { name, text } of SOURCES) {
      for (const cls of textClassStrings(text)) {
        if (/(?<![\w-])font-(extrabold|black)(?![\w-])/.test(cls)) loud.push(`${name}: extra-heavy weight`);
        if (/(?<![\w-])uppercase(?![\w-])/.test(cls)) loud.push(`${name}: uppercase`);
      }
    }
    expect(loud).toEqual([]);
  });
});
