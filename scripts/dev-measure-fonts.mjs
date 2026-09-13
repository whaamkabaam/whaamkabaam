// One-off: measure advance widths of the subset Inter weights with Chromium's
// canvas so the runtime renderer can size boxes without a font library.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const weights = { 500: 'inter-Medium.woff2', 700: 'inter-Bold.woff2' };
const faces = Object.entries(weights).map(([w, f]) => `@font-face{font-family:'InterM';font-weight:${w};src:url(data:font/woff2;base64,${readFileSync('fonts/' + f).toString('base64')}) format('woff2')}`).join('\n');
const chars = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).concat([' ', '·', '’', '–']);
const b = await chromium.launch();
const p = await b.newPage();
await p.setContent(`<style>${faces}</style><canvas id=c></canvas>`);
const out = await p.evaluate(async ({ chars, weights }) => {
  await Promise.all(Object.keys(weights).map(w => document.fonts.load(`${w} 100px InterM`)));
  const ctx = document.getElementById('c').getContext('2d');
  const res = {};
  for (const w of Object.keys(weights)) {
    ctx.font = `${w} 100px InterM`;
    res[w] = {};
    for (const ch of chars) res[w][ch] = Math.round(ctx.measureText(ch).width * 100) / 100 / 100; // em units
    // kerning-inclusive check string
    res[w].__pairs = {};
    for (const s of ["where's", 'Pulled', 'Ty', 'AV', 'r.']) res[w].__pairs[s] = Math.round(ctx.measureText(s).width) / 100;
  }
  return res;
}, { chars, weights });
await b.close();
writeFileSync('fonts/metrics.json', JSON.stringify(out));
console.log('700 W em:', out[700]['W'], '| 700 i em:', out[700]['i'], "| 700 \"where's\" em:", out[700].__pairs["where's"]);
