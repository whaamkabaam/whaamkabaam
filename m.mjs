import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const b64 = f => readFileSync(`fonts/${f}`).toString('base64');
const css = `
@font-face{font-family:I;font-weight:500;src:url(data:font/woff2;base64,${b64('inter-Medium.woff2')}) format('woff2')}
@font-face{font-family:I;font-weight:700;src:url(data:font/woff2;base64,${b64('inter-Bold.woff2')}) format('woff2')}
body{margin:0}
span{font-family:I;white-space:pre}`;
const items = [
 ['complaintA', "i can’t tell what you build", 34, 700, '-0.8px'],
 ['complaintB', "nothing’s moved in weeks", 34, 700, '-0.8px'],
 ['replyA1', "6,734 contributions in the last year. 81 of them public.", 20, 500, '0'],
 ['replyA2', "2,026 of them landed in the four weeks to 26 april.", 20, 500, '0'],
 ['replyB1', "Last contribution was 26 october. The year still reads 6,734.", 20, 500, '0'],
 ['stamp', "last run 12 sep 2026, 05:17 utc", 13, 500, '0'],
 ['whaam', "whaam", 15, 700, '1.2px'],
 ['legendA', "public repos", 14, 500, '0'],
 ['legendB', "everything", 14, 500, '0'],
 ['axisL', "a year ago", 14, 500, '0'],
 ['axisR', "today", 14, 500, '0'],
 ['marker', "378 in one day", 13, 500, '0'],
];
const html = `<style>${css}</style>` + items.map(([id,t,s,w,ls])=>`<div><span id="${id}" style="font-size:${s}px;font-weight:${w};letter-spacing:${ls}">${t}</span></div>`).join('');
writeFileSync('/tmp/m.html', html);
const br = await chromium.launch(); const p = await br.newPage();
await p.goto('file:///tmp/m.html'); await p.waitForTimeout(500);
for (const [id,t] of items) {
  const w = await p.$eval('#'+id, e => e.getBoundingClientRect().width);
  console.log(id.padEnd(12), Math.round(w*100)/100, '|', t);
}
await br.close();
