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

  // The service worker re-fetches runtime-cached URLs itself, and a worker's own fetches are
  // governed by connect-src (not img-src) — so a host that is fine as an <img> can still break
  // once the worker is controlling the page. Forgetting this blanked every map tile in production.
  it('allows, in connect-src, every host the service worker runtime-caches', () => {
    const viteConfig = readFileSync(resolve(root, 'vite.config.ts'), 'utf8');
    const patterns = [...viteConfig.matchAll(/urlPattern:\s*\/\^https:\\\/\\\/(.+?)\\\/\.\*\//g)].map((m) => m[1]);
    expect(patterns.length).toBeGreaterThan(0);
    const connectSrc = csp.split(';').find((d) => d.trim().startsWith('connect-src')) ?? '';
    for (const raw of patterns) {
      const host = raw.replace(/\.\*\\\./g, '*.').replace(/\\\./g, '.');
      expect(connectSrc, `service worker caches https://${host} but connect-src does not allow it`).toContain(`https://${host}`);
    }
  });
});
