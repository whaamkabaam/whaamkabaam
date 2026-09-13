// Dev only: rasterise assets/social.svg to social.png at exactly 1280x640 for the repo's social preview.
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import { writeFileSync } from 'node:fs';
writeFileSync('shots/_s.html', `<!doctype html><body style="margin:0"><img src="../assets/social.svg" style="width:1280px;height:640px;display:block"></body>`);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 1 });
await p.goto(pathToFileURL(process.cwd() + '/shots/_s.html').href); await p.waitForTimeout(800);
await p.screenshot({ path: 'shots/social.png', clip: { x: 0, y: 0, width: 1280, height: 640 } });
await b.close(); console.log('social.png written');
