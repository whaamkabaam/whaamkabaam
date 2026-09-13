import { chromium } from 'playwright'; import { writeFileSync } from 'node:fs'; import { pathToFileURL } from 'url';
const [file, out, bg = '#0d1117', width = '846'] = process.argv.slice(2);
writeFileSync('shots/_o.html', `<!doctype html><body style="margin:0;padding:16px;background:${bg}"><img src="../assets/${file}" style="width:${width}px;display:block"></body>`);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: Number(width) + 32, height: 900 } });
await p.goto(pathToFileURL(process.cwd() + '/shots/_o.html').href); await p.waitForTimeout(3600);
const h = await p.$eval('img', i => Math.ceil(i.getBoundingClientRect().height) + 32); await p.setViewportSize({ width: Number(width) + 32, height: h });
await p.screenshot({ path: `shots/${out}` }); await b.close(); console.log('shot', out);
