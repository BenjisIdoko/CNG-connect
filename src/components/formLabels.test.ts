import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every form control has an accessible name. A visible <label> printed beside an input does nothing for a
 * screen reader unless it is tied to it (htmlFor + id), wraps it, or the control carries an aria-label.
 * Placeholder text is not a label: it vanishes as soon as the driver types.
 */
const ROOT = join(__dirname);

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'ui' ? [] : walk(path); // ui/* primitives spread caller props
    return /\.tsx$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });

type Control = { file: string; line: number; tag: string; text: string; labelledBy: boolean; wrapped: boolean; hidden: boolean };

/** The opening tag of a control, found by walking to the first `>` that is not inside a JSX `{ }` expression. */
const controlsIn = (file: string): Control[] => {
  const src = readFileSync(file, 'utf8');
  const found: Control[] = [];
  for (const m of src.matchAll(/<(input|textarea|select)\b/g)) {
    const start = m.index ?? 0;
    let depth = 0;
    let end = start;
    for (; end < src.length; end++) {
      const c = src[end];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    const text = src.slice(start, end + 1);
    const before = src.slice(Math.max(0, start - 600), start);
    found.push({
      file: relative(ROOT, file),
      line: src.slice(0, start).split('\n').length,
      tag: m[1],
      text,
      labelledBy: /aria-label=|aria-labelledby=/.test(text),
      wrapped: before.lastIndexOf('<label') > before.lastIndexOf('</label>'),
      hidden: /type="hidden"/.test(text) || (/type="file"/.test(text) && /\bhidden\b/.test(text)),
    });
  }
  return found;
};

const files = walk(ROOT);
const controls = files.flatMap(controlsIn);

describe('form controls have accessible names', () => {
  it('finds the controls it is meant to check', () => {
    expect(files.length).toBeGreaterThan(20);
    expect(controls.length).toBeGreaterThan(40);
  });

  it('gives every visible control an aria-label, a wrapping label, or an id that a label points at', () => {
    const unnamed: string[] = [];
    for (const c of controls) {
      if (c.hidden || c.wrapped || c.labelledBy) continue;
      const id = c.text.match(/\bid=(?:"([^"]+)"|\{([^}]+)\})/);
      const src = readFileSync(join(ROOT, c.file), 'utf8');
      const pointedAt = id ? new RegExp(`htmlFor=(?:"${id[1] ?? ''}"|\\{${(id[2] ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\})`).test(src) && (id[1] || id[2]) : false;
      if (!pointedAt) unnamed.push(`${c.file}:${c.line} <${c.tag}>`);
    }
    expect(unnamed).toEqual([]);
  });

  it('never reuses an id inside one file', () => {
    const dupes: string[] = [];
    for (const file of files) {
      const ids = [...readFileSync(file, 'utf8').matchAll(/<(?:input|textarea|select)\b[^>]*?\bid="([^"]+)"/g)].map((m) => m[1]);
      for (const id of new Set(ids.filter((v, i) => ids.indexOf(v) !== i))) dupes.push(`${relative(ROOT, file)}: ${id}`);
    }
    expect(dupes).toEqual([]);
  });
});
