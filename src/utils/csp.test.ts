import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const vercel = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'));

const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

const globalHeaders: { key: string; value: string }[] =
  vercel.headers.find((h: { source: string }) => h.source === '/(.*)')?.headers ?? [];
const csp = globalHeaders.find((h) => h.key === 'Content-Security-Policy')?.value ?? '';

describe('Content-Security-Policy', () => {
  it('is enforcing, not report-only', () => {
    expect(csp).not.toBe('');
    expect(globalHeaders.some((h) => h.key === 'Content-Security-Policy-Report-Only')).toBe(false);
  });

  it('does not allow arbitrary inline or eval scripts', () => {
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src')) ?? '';
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it("allow-lists every inline <script> in index.html by hash — update vercel.json if you edit one", () => {
    expect(inlineScripts.length).toBeGreaterThan(0);
    for (const body of inlineScripts) {
      const hash = `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`;
      expect(csp, `inline script hash ${hash} missing from the CSP`).toContain(hash);
    }
  });
});
