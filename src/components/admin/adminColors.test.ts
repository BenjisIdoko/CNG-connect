import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The admin colours are tokens (`adm-*` in src/index.css), measured against WCAG AA, and never retyped as hex:
 * DESIGN.md "Prefix Rule" and "Data Colors Rule". These checks read the real token values, so changing a
 * colour that drops text below 4.5:1 fails here instead of in somebody's eyes.
 */
const ADMIN_DIR = join(__dirname);
const UI_DIR = join(__dirname, '..', 'ui');
const CSS = readFileSync(join(__dirname, '..', '..', 'index.css'), 'utf8');

const sourceFiles = (dir: string) =>
  readdirSync(dir)
    .filter((f) => /\.(tsx|ts|css)$/.test(f) && !/\.test\./.test(f))
    .map((f) => ({ name: f, text: readFileSync(join(dir, f), 'utf8') }));
const allSources = [...sourceFiles(ADMIN_DIR), ...sourceFiles(UI_DIR)];

const token = (name: string): string => {
  const match = CSS.match(new RegExp(`--color-adm-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`token adm-${name} not found in index.css`);
  return match[1];
};
const WHITE = '#ffffff';

const channel = (hex: string, i: number) => {
  const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('admin colour contrast', () => {
  // [label, foreground, background]: every text pair the admin actually draws.
  const textPairs: Array<[string, string, string]> = [
    ['ink on paper', token('ink'), token('paper')],
    ['ink on card', token('ink'), token('card')],
    ['mute text on card', token('mute-text'), token('card')],
    ['mute text on paper', token('mute-text'), token('paper')],
    ['warn on warn wash (warning badge, alerts)', token('warn'), token('warn-soft')],
    ['warn on card (percent, "No position yet")', token('warn'), token('card')],
    ['danger on danger wash (badge, inline errors)', token('danger'), token('danger-soft')],
    ['danger on card (field errors)', token('danger'), token('card')],
    ['white on danger (destructive button)', WHITE, token('danger')],
    ['white on leaf green (badge, secondary button, toast, active nav count)', WHITE, token('note')],
    ['leaf green on card (links, verified percent)', token('note'), token('card')],
    ['leaf green on leaf tint (nav count)', token('note'), token('note-text')],
    ['ink on mint (primary button)', token('ink'), token('foil')],
    ['ink on new tint (new badge)', token('ink'), token('new')],
  ];

  it.each(textPairs)('%s reads at 4.5:1 or better', (_label, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['warn', token('warn')],
    ['danger', token('danger')],
    ['emerald', token('emerald')],
    ['leaf green', token('note')],
  ])('%s dots and bars hold 3:1 against a white card', (_label, color) => {
    expect(contrast(color, WHITE)).toBeGreaterThanOrEqual(3);
  });
});

describe('admin colour tokens', () => {
  it('never retypes a palette colour as raw hex in admin or kit components', () => {
    for (const file of allSources) {
      expect(file.text, file.name).not.toMatch(/#(?:16a34a|84cc16|4ade80)\b/i);
    }
  });

  it('never uses emerald or lime as a text colour, or white text on an emerald fill', () => {
    for (const file of allSources) {
      expect(file.text, file.name).not.toMatch(/\btext-adm-(?:emerald|lime)\b/);
      expect(file.text, file.name).not.toMatch(/bg-adm-emerald[^'"`\n]*\btext-white\b|\btext-white\b[^'"`\n]*bg-adm-emerald/);
    }
  });

  it('gives floating layers a neutral ink shadow, not the retired deep-green tint', () => {
    for (const file of allSources) {
      expect(file.text, file.name).not.toMatch(/rgba\(\s*13\s*,\s*59\s*,\s*46/);
    }
  });
});

describe('admin drawer', () => {
  const sheet = readFileSync(join(UI_DIR, 'sheet.tsx'), 'utf8');
  const closeClasses = sheet.match(/<SheetPrimitive\.Close className="([^"]+)"/)?.[1] ?? '';

  it('draws its close button in a colour that shows on the white drawer', () => {
    expect(closeClasses).not.toBe('');
    expect(closeClasses).not.toMatch(/\btext-adm-note-text\b/);
    expect(closeClasses).toMatch(/\btext-adm-mute-text\b/);
    expect(closeClasses).toMatch(/\bhover:text-adm-ink\b/);
  });
});
