import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const b64 = f => readFileSync(`fonts/${f}`).toString('base64');
const css = `
@font-face{font-family:I;font-weight:500;src:url(data:font/woff2;base64,${b64('inter-Medium.woff2')}) format('woff2')}
@font-face{font-family:I;font-weight:700;src:url(data:font/woff2;base64,${b64('inter-Bold.woff2')}) format('woff2')}
body{margin:0}span{font-family:I;white-space:pre}`;
const items = [
 ['cA38', "i can’t tell what you build", 38, 700, '-0.9px'],
 ['cB38', "nothing’s moved in weeks", 38, 700, '-0.9px'],
 ['qr1', "Last contribution was 26 october.", 20, 500, '0'],
 ['qr2', "The year still reads 6,734, 81 of them public.", 20, 500, '0'],
 ['alt1', "Pulled 6,734 in the last year. 81 of them public.", 20, 500, '0'],
 ['fb2', "179 of the last 371 days had something on them.", 20, 500, '0'],
];
const html = `<style>${css}</style>` + items.map(([id,t,s,w,ls])=>`<div><span id="${id}" style="font-size:${s}px;font-weight:${w};letter-spacing:${ls}">${t}</span></div>`).join('');
writeFileSync('/tmp/m2.html', html);
const br = await chromium.launch(); const p = await br.newPage();
await p.goto('file:///tmp/m2.html'); await p.waitForTimeout(500);
for (const [id,t] of items) console.log(id.padEnd(7), Math.round(await p.$eval('#'+id, e=>e.getBoundingClientRect().width)), '|', t);
await br.close();
