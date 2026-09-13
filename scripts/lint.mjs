// Fails if any dash-like character or entity lands in the README or the card.
import { readFileSync } from 'node:fs';
const bad = /[–—―−]|&mdash;|&#8212;|&ndash;|&#8211;/;
let ok = true;
for (const f of ['README.md', 'assets/coach.svg', 'assets/coach-narrow.svg', 'assets/social.svg']) {
  let s; try { s = readFileSync(f, 'utf8'); } catch { continue; }
  const m = s.match(bad);
  if (m) { ok = false; console.error(`lint: ${f} contains ${JSON.stringify(m[0])}`); }
}
if (!ok) process.exit(1);
console.log('lint ok');
