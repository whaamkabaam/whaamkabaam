import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'url';
writeFileSync('shots/_f.html', `<!doctype html><body style="margin:0;padding:24px;background:#0d1117"><img id=i src="../assets/coach.svg" style="width:846px;display:block"></body>`);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 894, height: 452 } });
await p.goto(pathToFileURL(process.cwd() + '/shots/_f.html').href);
for (const t of [100, 700, 1400, 2600]) { await p.waitForTimeout(t === 100 ? 100 : t - (t === 700 ? 100 : t === 1400 ? 700 : 1400)); await p.screenshot({ path: `shots/frame-${t}.png` }); }
await b.close(); console.log('frames ok');
