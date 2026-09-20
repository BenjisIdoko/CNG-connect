import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The icon font (public/fonts/material-symbols.woff2) only contains the glyphs
// listed in scripts/icon-names.json. An icon used in code but missing there
// renders as blank/plain text, so fail loudly instead.
const listed = new Set<string>(JSON.parse(readFileSync('scripts/icon-names.json', 'utf8')));

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(f) && !/\.test\./.test(f)) out.push(p);
  }
  return out;
}

function usedIconNames(): Map<string, string> {
  const used = new Map<string, string>();
  const add = (name: string, file: string) => used.set(name, file);
  for (const file of walk('src')) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/material-symbols-outlined[^>]*>\s*([a-z][a-z0-9_]*)\s*<\/span>/g)) add(m[1], file);
    for (const m of src.matchAll(/\bicon[:=]\s*\{?\s*['"]([a-z][a-z0-9_]*)['"]/g)) add(m[1], file);
    for (const m of src.matchAll(/<Icon[^>]*\bname=["']([a-z][a-z0-9_]*)["']/g)) add(m[1], file);
    for (const m of src.matchAll(/\bname:\s*['"]([a-z][a-z0-9_]*)['"]/g)) if (listed.has(m[1])) add(m[1], file);
  }
  return used;
}

describe('icon font subset', () => {
  it('lists every icon used in the source', () => {
    const used = usedIconNames();
    expect(used.size).toBeGreaterThan(40); // guards against the scanner silently matching nothing
    const missing = [...used].filter(([name]) => !listed.has(name));
    expect(missing.map(([n, f]) => `${n} (${f})`)).toEqual([]);
  });

  it('keeps the list sorted and unique', () => {
    const arr: string[] = JSON.parse(readFileSync('scripts/icon-names.json', 'utf8'));
    expect(arr).toEqual([...new Set(arr)].sort());
  });
});
