// Dev only: screenshot every card embedded as <img> like GitHub does, after the animation settles.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'url';
mkdirSync('shots', { recursive: true });
const b = await chromium.launch();
const jobs = [['coach-dark', 'coach.svg', 846, '#0d1117', 1], ['coach-light', 'coach.svg', 846, '#ffffff', 1], ['coach-narrow', 'coach-narrow.svg', 308, '#0d1117', 3], ['demo-dark', 'demo.svg', 846, '#0d1117', 1], ['demo-narrow', 'demo-narrow.svg', 308, '#0d1117', 3]];
for (const [name, file, width, bg, dpr] of jobs) {
  writeFileSync('shots/_p.html', `<!doctype html><body style="margin:0;padding:16px;background:${bg}"><img src="../assets/${file}" style="width:${width}px;display:block"></body>`);
  const p = await b.newPage({ viewport: { width: width + 32, height: 900 }, deviceScaleFactor: dpr });
  await p.goto(pathToFileURL(process.cwd() + '/shots/_p.html').href);
  await p.waitForTimeout(2800);
  const h = await p.$eval('img', i => Math.ceil(i.getBoundingClientRect().height) + 32);
  await p.setViewportSize({ width: width + 32, height: h });
  await p.screenshot({ path: `shots/${name}.png` });
  await p.close();
}
await b.close(); console.log('shots done');
