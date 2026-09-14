import { chromium } from 'playwright'; import { writeFileSync } from 'node:fs'; import { pathToFileURL } from 'url';
writeFileSync('shots/_f.html', `<!doctype html><body style="margin:0;padding:16px;background:#0d1117"><img src="../assets/coach.svg" style="width:846px;display:block"></body>`);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 878, height: 500 } });
await p.goto(pathToFileURL(process.cwd() + '/shots/_f.html').href);
let last = 0; for (const t of [1500, 1560, 1620, 1700, 2400, 4000]) { await p.waitForTimeout(t - last); last = t; await p.screenshot({ path: `shots/frame-${t}.png` }); }
await b.close(); console.log('frames ok');
