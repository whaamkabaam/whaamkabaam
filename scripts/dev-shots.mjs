// Dev only: screenshot the card embedded as <img> like GitHub does, on GitHub's
// page colours, at desktop and phone widths, before and after the animation.
import { chromium } from 'playwright';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'url';
mkdirSync('shots', { recursive: true });
const bgs = { light: '#ffffff', dark: '#0d1117', dimmed: '#22272e' };
const svg = readFileSync('assets/coach.svg', 'utf8');
writeFileSync('shots/static.svg', svg.replace(/<animate[^>]*\/>/g, ''));   // the no-SMIL end state
const b = await chromium.launch();
for (const [name, bg] of Object.entries(bgs)) {
  for (const width of [846, 308]) {
    const html = `<!doctype html><body style="margin:0;padding:24px;background:${bg}"><img src="../assets/coach.svg" style="width:${width}px;max-width:100%;display:block"></body>`;
    writeFileSync('shots/_p.html', html);
    const p = await b.newPage({ viewport: { width: width + 48, height: Math.round(width * 404 / 846) + 48 }, deviceScaleFactor: width < 400 ? 2 : 1 });
    await p.goto(pathToFileURL(process.cwd() + '/shots/_p.html').href);
    if (width === 846 && name === 'dark') { await p.waitForTimeout(120); await p.screenshot({ path: `shots/${name}-${width}-t0.png` }); }
    await p.waitForTimeout(2400);
    await p.screenshot({ path: `shots/${name}-${width}.png` });
    await p.close();
  }
}
writeFileSync('shots/_s.html', `<!doctype html><body style="margin:0;padding:24px;background:#0d1117"><img src="static.svg" style="width:846px;display:block"></body>`);
const p = await b.newPage({ viewport: { width: 894, height: 452 } });
await p.goto(pathToFileURL(process.cwd() + '/shots/_s.html').href); await p.waitForTimeout(300);
await p.screenshot({ path: 'shots/static-nosmil.png' }); await p.close();
await b.close();
console.log('shots done');
