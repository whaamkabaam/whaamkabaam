// Renders assets/coach.svg (846 wide, the desktop README column) and
// assets/coach-narrow.svg (400 wide, served to phones through <picture>) from
// data/profile.json. Pure string building, no DOM, no browser, no dependencies.
// Every number comes from the data file; nothing is hardcoded except the copy.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { GOLD, INK, GREY, PAPER, fontFace, FONT_STACK, fmt, esc, monotonePath, pathLength, weeklyCumulative, textWidth, wrapText, assertGlyphs, assertNoDashes } from './svg-lib.mjs';

const data = JSON.parse(readFileSync('data/profile.json', 'utf8'));

// ---- copy (shared by both cards) ---------------------------------------------
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const lastDay = data.days.at(-1).date;                       // the last column of GitHub's own graph, never window.endedAt
const stamp = `${Number(lastDay.slice(8, 10))} ${MONTHS[Number(lastDay.slice(5, 7)) - 1]} ${lastDay.slice(0, 4)}`;
const stateB = process.env.STATE_B === '1' && data.trailing14 === 0;
const complaint = stateB ? 'nothing’s moved in weeks' : 'i can’t see what you build';
const reply = stateB
  ? `nothing new in 14 days. the year still reads ${fmt(data.total)}.`
  : `you’re looking at it. ${fmt(data.private)} of ${fmt(data.total)} contributions in the last year are private.`;
const goldValue = fmt(data.total), goldCaption = 'contributions in the last year';
const greyValue = fmt(data.public), greyNoun = 'in public repos';
const axisL = 'a year ago', axisR = stamp;
for (const [s, w] of [[complaint, 700], [reply, 500], [goldValue, 700], [goldCaption, 500], [greyValue, 700], [greyNoun, 500], [axisL, 500], [axisR, 500]]) { assertNoDashes(s); assertGlyphs(s, w); }

// ---- shared geometry helpers -------------------------------------------------
const all = weeklyCumulative(data.days, 'count');
const pub = weeklyCumulative(data.days, 'public');
const maxY = Math.max(all.at(-1).cum, 1);
function plot(X0, X1, TOP, FLOOR) {
  const x = i => X0 + (i / Math.max(all.length - 1, 1)) * (X1 - X0);
  const y = v => FLOOR - (v / maxY) * (FLOOR - TOP);
  const allPts = all.map((p, i) => [x(i), y(p.cum)]);
  const pubPts = pub.map((p, i) => [x(i), y(p.cum)]);
  const dAll = monotonePath(allPts), dPub = monotonePath(pubPts);
  const L = Math.max(1, Math.ceil(pathLength(allPts) * 1.02));
  const end = allPts.at(-1), pubEnd = pubPts.at(-1);
  const areaD = `${dAll} L${X1} ${FLOOR} L${X0} ${FLOOR} Z`;
  // Base attributes are the END state, so a renderer without SMIL shows the
  // finished card; <set> holds the delayed elements at 0 until their fade.
  // The grey public line is drawn LAST so the gold stroke never hides it.
  return `<defs>
  <linearGradient id="f" gradientUnits="userSpaceOnUse" x1="0" y1="${TOP}" x2="0" y2="${FLOOR}">
    <stop offset="0" stop-color="${GOLD}" stop-opacity=".16"/>
    <stop offset=".5" stop-color="${GOLD}" stop-opacity=".05"/>
    <stop offset=".78" stop-color="${GOLD}" stop-opacity=".005"/>
    <stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>
  </linearGradient>
</defs>
<path d="${areaD}" fill="url(#f)" opacity="1"><set attributeName="opacity" to="0" begin="0s" dur="1.25s"/><animate attributeName="opacity" from="0" to="1" begin="1.25s" dur=".5s" fill="freeze"/></path>
<g fill="none" stroke="${GOLD}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${L}" stroke-dashoffset="0">
  <animate attributeName="stroke-dashoffset" from="${L}" to="0" dur="1.6s" calcMode="spline" keySplines="0.22 1 0.36 1" fill="freeze"/>
  <path d="${dAll}" stroke-width="9" opacity=".05"/>
  <path d="${dAll}" stroke-width="5" opacity=".11"/>
  <path d="${dAll}" stroke-width="2.5"/>
</g>
<g opacity="1"><set attributeName="opacity" to="0" begin="0s" dur="1.5s"/><animate attributeName="opacity" from="0" to="1" begin="1.5s" dur=".3s" fill="freeze"/>
  <circle cx="${end[0].toFixed(1)}" cy="${end[1].toFixed(1)}" r="9" fill="${GOLD}" opacity=".16"/>
  <circle cx="${end[0].toFixed(1)}" cy="${end[1].toFixed(1)}" r="4.5" fill="${GOLD}"/>
</g>
<path d="${dPub}" fill="none" stroke="${GREY}" stroke-width="1.5" stroke-dasharray="5 5" opacity=".9"/>
<circle cx="${pubEnd[0].toFixed(1)}" cy="${pubEnd[1].toFixed(1)}" r="3.5" fill="${GREY}"/>`;
}
const head = (W, H) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<title>${esc(complaint)}</title>
<desc>${esc(reply)} ${esc(goldValue)} ${esc(goldCaption)}, as of ${esc(stamp)}. ${esc(greyValue)} ${esc(greyNoun)}.</desc>
<style>
${fontFace(500, 'inter-Medium.woff2')}
${fontFace(700, 'inter-Bold.woff2')}
text{font-family:${FONT_STACK};font-variant-numeric:tabular-nums}
</style>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="20" fill="${INK}" stroke="${PAPER}" stroke-opacity=".07"/>`;
const glyph = (x, y, k = 1) => `<path d="M${x},${y} C${x + 5 * k},${y} ${x + 8 * k},${y - 5 * k} ${x + 12 * k},${y - 10 * k} C${x + 16 * k},${y - 15 * k} ${x + 16 * k},${y - 12 * k} ${x + 20 * k},${y - 12 * k}" fill="none" stroke="${GOLD}" stroke-width="${(2.2 * k).toFixed(1)}" stroke-linecap="round"/>`;
const bubble = (X0, y, size, pad, maxW) => {
  let cSize = size, w = textWidth(complaint, 700, cSize, -0.02 * cSize) + 2 * pad;
  while (w > maxW && cSize > 20) { cSize -= 1; w = textWidth(complaint, 700, cSize, -0.02 * cSize) + 2 * pad; }
  const h = Math.round(cSize * 1.68), base = y + Math.round(h / 2 + cSize * 0.36);
  return { svg: `<rect x="${X0}" y="${y}" width="${Math.round(w)}" height="${h}" rx="${Math.round(h / 3)}" fill="${PAPER}" fill-opacity=".06"/>
<text x="${X0 + pad}" y="${base}" font-size="${cSize}" font-weight="700" letter-spacing="${(-0.02 * cSize).toFixed(2)}" fill="${PAPER}">${esc(complaint)}</text>`, bottom: y + h, cSize, w };
};

// ---- wide card: 846 x 404 ----------------------------------------------------
function wide() {
  const W = 846, H = 404, X0 = 40, X1 = 806, TOP = 230, FLOOR = 354;
  const b = bubble(X0, 40, 44, 26, X1 - X0);
  let rSize = 19; while (textWidth(reply, 500, rSize) > X1 - (X0 + 30) && rSize > 13) rSize -= 0.5;
  return { svg: `${head(W, H)}
${b.svg}
${glyph(X0, 150)}
<text x="${X0 + 30}" y="150" font-size="${rSize}" font-weight="500" fill="${PAPER}">${esc(reply)}</text>
${plot(X0, X1, TOP, FLOOR)}
<text x="${X1}" y="186" text-anchor="end" font-size="22" font-weight="700" letter-spacing="-0.22" fill="${GOLD}">${esc(goldValue)}</text>
<text x="${X1}" y="202" text-anchor="end" font-size="12" font-weight="500" letter-spacing=".24" fill="${GREY}">${esc(goldCaption)}</text>
<text x="${X1}" y="324" text-anchor="end" font-size="14" font-weight="700" fill="${GREY}">${esc(greyValue)}</text>
<text x="${X1}" y="339" text-anchor="end" font-size="11" font-weight="500" letter-spacing=".22" fill="${GREY}">${esc(greyNoun)}</text>
<text x="${X0}" y="380" font-size="13" font-weight="500" letter-spacing=".52" fill="${GREY}">${esc(axisL)}</text>
<text x="${X1}" y="380" text-anchor="end" font-size="13" font-weight="500" letter-spacing=".52" fill="${GREY}">${esc(axisR)}</text>
</svg>
`, note: `complaint ${b.cSize}px ${Math.round(b.w)}w | reply ${rSize}px` };
}

// ---- narrow card: 400 wide, scales to the 308px phone column (0.77x) ---------
function narrow() {
  const W = 400, X0 = 24, X1 = 376;
  const b = bubble(X0, 24, 30, 18, X1 - X0);
  const rSize = 17, rLine = Math.round(rSize * 1.35);
  const lines = wrapText(reply, 500, rSize, X1 - (X0 + 26));
  const rTop = b.bottom + 34;
  const TOP = rTop + (lines.length - 1) * rLine + 96, FLOOR = TOP + 150, H = FLOOR + 52;
  const replySvg = lines.map((l, i) => `<text x="${X0 + 26}" y="${rTop + i * rLine}" font-size="${rSize}" font-weight="500" fill="${PAPER}">${esc(l)}</text>`).join('\n');
  return { svg: `${head(W, H)}
${b.svg}
${glyph(X0, rTop, 0.9)}
${replySvg}
${plot(X0, X1, TOP, FLOOR)}
<text x="${X1}" y="${TOP - 44}" text-anchor="end" font-size="26" font-weight="700" letter-spacing="-0.26" fill="${GOLD}">${esc(goldValue)}</text>
<text x="${X1}" y="${TOP - 26}" text-anchor="end" font-size="12" font-weight="500" letter-spacing=".24" fill="${GREY}">${esc(goldCaption)}</text>
<text x="${X1}" y="${FLOOR - 32}" text-anchor="end" font-size="15" font-weight="700" fill="${GREY}">${esc(greyValue)}</text>
<text x="${X1}" y="${FLOOR - 16}" text-anchor="end" font-size="11" font-weight="500" letter-spacing=".22" fill="${GREY}">${esc(greyNoun)}</text>
<text x="${X0}" y="${H - 22}" font-size="12" font-weight="500" letter-spacing=".48" fill="${GREY}">${esc(axisL)}</text>
<text x="${X1}" y="${H - 22}" text-anchor="end" font-size="12" font-weight="500" letter-spacing=".48" fill="${GREY}">${esc(axisR)}</text>
</svg>
`, note: `complaint ${b.cSize}px | reply ${lines.length} lines | ${W}x${H}` };
}

mkdirSync('assets', { recursive: true });
const w = wide(), n = narrow();
writeFileSync('assets/coach.svg', w.svg);
writeFileSync('assets/coach-narrow.svg', n.svg);
console.log(`coach.svg ${(w.svg.length / 1024).toFixed(1)} KB (${w.note}) | coach-narrow.svg ${(n.svg.length / 1024).toFixed(1)} KB (${n.note}) | stamp "${stamp}"${stateB ? ' | STATE B' : ''}`);
