import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The admin dashboard uses one family, Geist (Geist Mono for ids): DESIGN.md "Weight Ladder Rule".
 * The driver app's base styles set Inter on the body and Urbanist on every heading, so the admin has to
 * opt out explicitly; these checks keep it from drifting back.
 */
const ADMIN_DIR = join(__dirname);
const UI_DIR = join(__dirname, '..', 'ui');
const THEME = readFileSync(join(ADMIN_DIR, 'admin-theme.css'), 'utf8');

const sourceFiles = (dir: string) =>
  readdirSync(dir)
    .filter((f) => /\.(tsx|ts|css)$/.test(f) && !/\.test\./.test(f))
    .map((f) => ({ name: f, text: readFileSync(join(dir, f), 'utf8') }));

describe('admin typography', () => {
  it('names only Geist and Geist Mono in the admin font stacks', () => {
    const stacks = [...THEME.matchAll(/font-family:\s*([^;]+);/g)].map((m) => m[1]).filter((stack) => stack.trim() !== 'inherit');
    expect(stacks.length).toBeGreaterThan(0);
    for (const stack of stacks) {
      expect(stack).not.toMatch(/Inter|Urbanist/);
      expect(stack).toMatch(/Geist/);
    }
  });

  it('makes headings inside .admin-ui inherit Geist instead of the driver app heading face', () => {
    expect(THEME).toMatch(/\.admin-ui\s+:is\(h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\)\s*{[^}]*font-family:\s*inherit/);
  });

  it('never reaches for the driver app faces from admin or kit components', () => {
    for (const file of [...sourceFiles(ADMIN_DIR), ...sourceFiles(UI_DIR)]) {
      expect(file.text, file.name).not.toMatch(/font-headline|font-sans|Urbanist|'Inter'/);
    }
  });

  it('keeps admin labels at 11px or larger', () => {
    for (const file of sourceFiles(ADMIN_DIR)) {
      expect(file.text, file.name).not.toMatch(/text-\[(?:[0-9]|10)px\]/);
    }
  });
});
