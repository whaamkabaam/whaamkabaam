// Renders assets/coach.svg from data/profile.json. Pure string building, no
// DOM, no browser, no dependencies. Every number on the card comes from the
// data file; nothing is hardcoded except the copy.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { GOLD, INK, GREY, PAPER, fontFace, FONT_STACK, fmt, esc, monotonePath, pathLength, weeklyCumulative, textWidth, assertGlyphs, assertNoDashes } from './svg-lib.mjs';

const data = JSON.parse(readFileSync('data/profile.json', 'utf8'));
const W = 846, H = 404, X0 = 40, X1 = 806;
const PLOT_TOP = 230, FLOOR = 354;

// ---- copy -------------------------------------------------------------------
const lastDay = data.days.at(-1).date;                       // the last column of GitHub's own graph, never window.endedAt
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const stamp = `${Number(lastDay.slice(8, 10))} ${MONTHS[Number(lastDay.slice(5, 7)) - 1]} ${lastDay.slice(0, 4)}`;
const stateB = process.env.STATE_B === '1' && data.trailing14 === 0;
const complaint = stateB ? 'nothing’s moved in weeks' : 'i can’t see what you build';
const reply = stateB
  ? `nothing new in 14 days. the year still reads ${fmt(data.total)}.`
  : `you’re looking at it. ${fmt(data.private)} of ${fmt(data.total)} contributions this year are private.`;
const goldValue = fmt(data.total), goldCaption = `contributions as of ${stamp}`;
const greyValue = fmt(data.public), greyNoun = 'in public repos';
const axisL = 'a year ago', axisR = 'today';
for (const s of [complaint, reply, goldValue, goldCaption, greyValue, greyNoun, axisL, axisR]) { assertNoDashes(s); assertGlyphs(s); }

// ---- geometry ---------------------------------------------------------------
const all = weeklyCumulative(data.days, 'count');
const pub = weeklyCumulative(data.days, 'public');
const maxY = Math.max(all.at(-1).cum, 1);
const x = i => X0 + (i / Math.max(all.length - 1, 1)) * (X1 - X0);
const y = v => FLOOR - (v / maxY) * (FLOOR - PLOT_TOP);
const allPts = all.map((p, i) => [x(i), y(p.cum)]);
const pubPts = pub.map((p, i) => [x(i), y(p.cum)]);
const dAll = monotonePath(allPts), dPub = monotonePath(pubPts);
const L = Math.max(1, Math.ceil(pathLength(allPts) * 1.02));
const end = allPts.at(-1), pubEnd = pubPts.at(-1);
const areaD = `${dAll} L${X1} ${FLOOR} L${X0} ${FLOOR} Z`;

// complaint bubble sized from the measured glyph table; shrink the type until it fits the column
let cSize = 44;
const PAD = 26;
let cWidth = textWidth(complaint, 700, cSize, -0.02 * cSize) + 2 * PAD;
while (cWidth > X1 - X0 && cSize > 28) { cSize -= 1; cWidth = textWidth(complaint, 700, cSize, -0.02 * cSize) + 2 * PAD; }
cWidth = Math.round(cWidth);
const bubbleH = 74, bubbleY = 40, cBase = bubbleY + Math.round(bubbleH / 2 + cSize * 0.36);

// reply sized to fit the remaining column beside the coach glyph
let rSize = 19;
while (textWidth(reply, 500, rSize) > X1 - (X0 + 30) && rSize > 13) rSize -= 0.5;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<title>${esc(complaint)}</title>
<desc>${esc(reply)} ${esc(goldValue)} ${esc(goldCaption)}. ${esc(greyValue)} ${esc(greyNoun)}.</desc>
<style>
${fontFace(500, 'inter-Medium.woff2')}
${fontFace(700, 'inter-Bold.woff2')}
text{font-family:${FONT_STACK};font-variant-numeric:tabular-nums}
</style>
<defs>
  <linearGradient id="f" gradientUnits="userSpaceOnUse" x1="0" y1="${PLOT_TOP}" x2="0" y2="${FLOOR}">
    <stop offset="0" stop-color="${GOLD}" stop-opacity=".16"/>
    <stop offset=".5" stop-color="${GOLD}" stop-opacity=".05"/>
    <stop offset=".78" stop-color="${GOLD}" stop-opacity=".005"/>
    <stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>
  </linearGradient>
</defs>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="20" fill="${INK}" stroke="${PAPER}" stroke-opacity=".07"/>
<rect x="${X0}" y="${bubbleY}" width="${cWidth}" height="${bubbleH}" rx="24" fill="${PAPER}" fill-opacity=".06"/>
<text x="${X0 + PAD}" y="${cBase}" font-size="${cSize}" font-weight="700" letter-spacing="${(-0.02 * cSize).toFixed(2)}" fill="${PAPER}">${esc(complaint)}</text>
<path d="M${X0},150 C${X0 + 5},150 ${X0 + 8},145 ${X0 + 12},140 C${X0 + 16},135 ${X0 + 16},138 ${X0 + 20},138" fill="none" stroke="${GOLD}" stroke-width="2.2" stroke-linecap="round" transform="translate(0,-2)"/>
<text x="${X0 + 30}" y="150" font-size="${rSize}" font-weight="500" fill="${PAPER}">${esc(reply)}</text>
<path d="${areaD}" fill="url(#f)" opacity="1"><set attributeName="opacity" to="0" begin="0s" dur="1.25s"/><animate attributeName="opacity" from="0" to="1" begin="1.25s" dur=".5s" fill="freeze"/></path>
<path d="${dPub}" fill="none" stroke="${GREY}" stroke-width="1.5" stroke-dasharray="5 5" opacity=".9"/>
<circle cx="${pubEnd[0].toFixed(1)}" cy="${pubEnd[1].toFixed(1)}" r="3.5" fill="${GREY}"/>
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
<text x="${X1}" y="186" text-anchor="end" font-size="22" font-weight="700" letter-spacing="-0.22" fill="${GOLD}">${esc(goldValue)}</text>
<text x="${X1}" y="202" text-anchor="end" font-size="12" font-weight="500" letter-spacing=".24" fill="${GREY}">${esc(goldCaption)}</text>
<text x="${X1}" y="324" text-anchor="end" font-size="14" font-weight="700" fill="${GREY}">${esc(greyValue)}</text>
<text x="${X1}" y="339" text-anchor="end" font-size="11" font-weight="500" letter-spacing=".22" fill="${GREY}">${esc(greyNoun)}</text>
<text x="${X0}" y="380" font-size="13" font-weight="500" letter-spacing=".52" fill="${GREY}">${esc(axisL)}</text>
<text x="${X1}" y="380" text-anchor="end" font-size="13" font-weight="500" letter-spacing=".52" fill="${GREY}">${esc(axisR)}</text>
</svg>
`;
mkdirSync('assets', { recursive: true });
writeFileSync('assets/coach.svg', svg);
console.log(`coach.svg ${(svg.length / 1024).toFixed(1)} KB | complaint ${cSize}px ${cWidth}w | reply ${rSize}px | L ${L} | gold end ${end.map(v => v.toFixed(1))} | public end y ${pubEnd[1].toFixed(1)} | stamp "${stamp}"${stateB ? ' | STATE B' : ''}`);
