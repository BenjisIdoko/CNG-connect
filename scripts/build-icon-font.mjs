// Rebuilds public/fonts/material-symbols.woff2 — a ~20 KB subset of Material
// Symbols Outlined containing ONLY the icons listed in scripts/icon-names.json.
// Run after adding a new icon name:   node scripts/build-icon-font.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const names = JSON.parse(readFileSync(new URL('./icon-names.json', import.meta.url), 'utf8'))
  .slice()
  .sort();
const css = await (
  await fetch(
    `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL@24,400..600,0..1&icon_names=${names.join(',')}&display=block`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' } }
  )
).text();
const url = css.match(/url\((https:[^)]+)\)\s*format\('woff2'\)/)?.[1];
if (!url) throw new Error('No woff2 URL in Google Fonts response:\n' + css);
const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
mkdirSync(new URL('../public/fonts/', import.meta.url), { recursive: true });
writeFileSync(new URL('../public/fonts/material-symbols.woff2', import.meta.url), buf);
console.log(`Wrote material-symbols.woff2 (${buf.length} bytes) for ${names.length} icons`);
