// Renders every card from data/profile.json. No DOM, no browser, no deps.
//   assets/coach.svg          846 wide, the desktop README column
//   assets/coach-narrow.svg   400 wide, served to phones through <picture>
//   assets/demo.svg           the product itself: one complaint, one coached curve
//   assets/demo-narrow.svg
//   assets/social.svg         1280x640 source for the repo's social preview
// The year card has two states: with a per-project split (PROFILE_TOKEN was
// available) it shows where the year went; without, it shows private vs public.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { GOLD, INK, GREY, PAPER, fontFace, FONT_STACK, fmt, esc, monotonePath, pathLength, weeklyCumulative, textWidth, wrapText, assertGlyphs, assertNoDashes } from './svg-lib.mjs';

const data = JSON.parse(readFileSync('data/profile.json', 'utf8'));
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const lastDay = data.days.at(-1).date;
const stamp = `${Number(lastDay.slice(8, 10))} ${MONTHS[Number(lastDay.slice(5, 7)) - 1]} ${lastDay.slice(0, 4)}`;
const hhmm = iso => iso ? `${iso.slice(11, 13)}:${iso.slice(14, 16)} utc` : '';
// at most four named projects on the card; the rest folds into "other"
const MAX_NAMED = 4;
const split = (() => {
  if (!Array.isArray(data.projects) || data.projects.length < 2) return null;
  const named = data.projects.filter(p => p.label !== 'other').sort((a, b) => b.total - a.total);
  const keep = named.slice(0, MAX_NAMED), fold = named.slice(MAX_NAMED).concat(data.projects.filter(p => p.label === 'other'));
  if (!fold.length) return keep;
  const days = {}; let total = 0;
  for (const p of fold) { total += p.total; for (const [d, n] of Object.entries(p.days)) days[d] = (days[d] || 0) + n; }
  return [...keep, { label: 'other', total, days }];
})();
const BANDS = ['#FFD740', '#D9B23A', '#A98A33', '#7A6530', '#4E4630', '#33322f']; // gold family, brightest first; 'other' takes the last
const stateB = process.env.STATE_B === '1' && data.trailing14 === 0;

// ---- copy ---------------------------------------------------------------------
const complaint = stateB ? 'nothing’s moved in weeks' : 'i can’t see what you build';
let reply;
if (stateB) reply = `nothing new in 14 days. the year still reads ${fmt(data.total)}.`;
else if (split) {
  const top = split[0];
  const pct = Math.round(top.total / data.total * 100);
  reply = `mostly the coach. ${pct}% of the last year’s contributions went into ${top.label}.`;
} else reply = `you’re looking at it. ${fmt(data.private)} of ${fmt(data.total)} contributions in the last year are private.`;
const discordLine = data.discord ? `${fmt(data.discord.members)} in the discord, ${fmt(data.discord.online)} online, checked ${hhmm(data.discord.checked)}` : '';
const goldValue = fmt(data.total), goldCaption = 'contributions in the last year';
const greyValue = fmt(data.public), greyNoun = 'in public repos';
const axisL = 'a year ago', axisR = stamp;
const keyItems = split ? split.map((p, i) => ({ label: p.label, total: p.total, color: p.label === 'other' ? BANDS[BANDS.length - 1] : BANDS[Math.min(i, BANDS.length - 2)] })) : [];
for (const [s, w] of [[complaint, 700], [reply, 500], [discordLine, 500], [goldValue, 700], [goldCaption, 500], [greyValue, 700], [greyNoun, 500], [axisL, 500], [axisR, 500], ...keyItems.map(k => [`${k.label} ${fmt(k.total)}`, 500])]) { assertNoDashes(s); assertGlyphs(s, w); }

// ---- geometry --------------------------------------------------------------------
const all = weeklyCumulative(data.days, 'count');
const pub = weeklyCumulative(data.days, 'public');
const maxY = Math.max(all.at(-1).cum, 1);
// stacked cumulative bands, bottom to top in key order
const bandSeries = split ? (() => {
  const running = new Array(all.length).fill(0);
  return keyItems.map(k => {
    const proj = split.find(p => p.label === k.label);
    let cum = 0; const tops = [];
    data.days.forEach((d, i) => { cum += proj.days[d.date] || 0; if (i % 7 === 6 || i === data.days.length - 1) tops.push(cum); });
    const lower = running.slice(); const upper = running.map((v, i) => v + tops[i]);
    for (let i = 0; i < running.length; i++) running[i] = upper[i];
    return { ...k, lower, upper };
  });
})() : null;

function plot(X0, X1, TOP, FLOOR) {
  const x = i => X0 + (i / Math.max(all.length - 1, 1)) * (X1 - X0);
  const y = v => FLOOR - (v / maxY) * (FLOOR - TOP);
  const allPts = all.map((p, i) => [x(i), y(p.cum)]);
  const pubPts = pub.map((p, i) => [x(i), y(p.cum)]);
  const dAll = monotonePath(allPts), dPub = monotonePath(pubPts);
  const L = Math.max(1, Math.ceil(pathLength(allPts) * 1.02));
  const end = allPts.at(-1), pubEnd = pubPts.at(-1);
  let fills;
  if (bandSeries) {
    // each band: upper monotone path forward, lower path reversed
    fills = bandSeries.map(b => {
      const up = b.upper.map((v, i) => [x(i), y(v)]);
      const lo = b.lower.map((v, i) => [x(i), y(v)]).reverse();
      const d = monotonePath(up) + ' ' + monotonePath(lo).replace(/^M/, 'L') + ' Z';
      return `<path d="${d}" fill="${b.color}" fill-opacity="${b.label === 'other' ? .55 : .42}" stroke="${b.color}" stroke-opacity=".9" stroke-width="1"/>`;
    }).join('\n');
  } else {
    fills = `<path d="${dAll} L${X1} ${FLOOR} L${X0} ${FLOOR} Z" fill="url(#f)"/>`;
  }
  return `<defs>
  <linearGradient id="f" gradientUnits="userSpaceOnUse" x1="0" y1="${TOP}" x2="0" y2="${FLOOR}">
    <stop offset="0" stop-color="${GOLD}" stop-opacity=".16"/><stop offset=".5" stop-color="${GOLD}" stop-opacity=".05"/><stop offset=".78" stop-color="${GOLD}" stop-opacity=".005"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>
  </linearGradient>
</defs>
<g opacity="1"><set attributeName="opacity" to="0" begin="0s" dur="1.1s"/><animate attributeName="opacity" from="0" to="1" begin="1.1s" dur=".6s" fill="freeze"/>
${fills}
</g>
<g fill="none" stroke="${GOLD}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${L}" stroke-dashoffset="0">
  <animate attributeName="stroke-dashoffset" from="${L}" to="0" dur="1.6s" calcMode="spline" keySplines="0.22 1 0.36 1" fill="freeze"/>
  <path d="${dAll}" stroke-width="9" opacity=".05"/><path d="${dAll}" stroke-width="5" opacity=".11"/><path d="${dAll}" stroke-width="2.5"/>
</g>
<g opacity="1"><set attributeName="opacity" to="0" begin="0s" dur="1.5s"/><animate attributeName="opacity" from="0" to="1" begin="1.5s" dur=".3s" fill="freeze"/>
  <circle cx="${end[0].toFixed(1)}" cy="${end[1].toFixed(1)}" r="9" fill="${GOLD}" opacity=".16"/><circle cx="${end[0].toFixed(1)}" cy="${end[1].toFixed(1)}" r="4.5" fill="${GOLD}"/>
</g>
<path d="${dPub}" fill="none" stroke="${GREY}" stroke-width="1.5" stroke-dasharray="5 5" opacity=".9"/>
<circle cx="${pubEnd[0].toFixed(1)}" cy="${pubEnd[1].toFixed(1)}" r="3.5" fill="${GREY}"/>`;
}
const head = (W, H, title, desc) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<title>${esc(title)}</title>
<desc>${esc(desc)}</desc>
<style>
${fontFace(500, 'inter-Medium.woff2')}
${fontFace(700, 'inter-Bold.woff2')}
text{font-family:${FONT_STACK};font-variant-numeric:tabular-nums}
</style>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="20" fill="${INK}" stroke="${PAPER}" stroke-opacity=".07"/>`;
const glyph = (x, y, k = 1) => `<path d="M${x},${y} C${x + 5 * k},${y} ${x + 8 * k},${y - 5 * k} ${x + 12 * k},${y - 10 * k} C${x + 16 * k},${y - 15 * k} ${x + 16 * k},${y - 12 * k} ${x + 20 * k},${y - 12 * k}" fill="none" stroke="${GOLD}" stroke-width="${(2.2 * k).toFixed(1)}" stroke-linecap="round"/>`;
const bubble = (text, X0, y, size, pad, maxW) => {
  let cSize = size, w = textWidth(text, 700, cSize, -0.02 * cSize) + 2 * pad;
  while (w > maxW && cSize > 20) { cSize -= 1; w = textWidth(text, 700, cSize, -0.02 * cSize) + 2 * pad; }
  const h = Math.round(cSize * 1.68), base = y + Math.round(h / 2 + cSize * 0.36);
  return { svg: `<rect x="${X0}" y="${y}" width="${Math.round(w)}" height="${h}" rx="${Math.round(h / 3)}" fill="${PAPER}" fill-opacity=".06"/>
<text x="${X0 + pad}" y="${base}" font-size="${cSize}" font-weight="700" letter-spacing="${(-0.02 * cSize).toFixed(2)}" fill="${PAPER}">${esc(text)}</text>`, bottom: y + h, cSize, w };
};
// the project key: colour square + label + count, laid out left to right, wrapping
function keyRow(X0, X1, y, size) {
  if (!keyItems.length) return { svg: '', bottom: y };
  const gap = 18, sq = size * 0.72; let x = X0, line = 0, out = '';
  for (const k of keyItems) {
    const text = `${k.label} ${fmt(k.total)}`; const w = sq + 7 + textWidth(text, 500, size);
    if (x + w > X1 && x > X0) { x = X0; line++; }
    const yy = y + line * (size * 1.7);
    out += `<rect x="${x}" y="${(yy - sq * 0.85).toFixed(1)}" width="${sq.toFixed(1)}" height="${sq.toFixed(1)}" rx="2" fill="${k.color}" fill-opacity="${k.label === 'other' ? .8 : .95}"/><text x="${(x + sq + 7).toFixed(1)}" y="${yy}" font-size="${size}" font-weight="500" fill="${GREY}">${esc(k.label)} <tspan fill="${PAPER}">${fmt(k.total)}</tspan></text>`;
    x += w + gap;
  }
  return { svg: out, bottom: y + line * (size * 1.7) };
}
const desc = `${reply} ${goldValue} ${goldCaption}, as of ${stamp}. ${greyValue} ${greyNoun}. ${discordLine}`;

function wide() {
  const W = 846, X0 = 40, X1 = 806;
  const b = bubble(complaint, X0, 40, 44, 26, X1 - X0);
  let rSize = 19; while (textWidth(reply, 500, rSize) > X1 - (X0 + 30) && rSize > 13) rSize -= 0.5;
  const key = keyRow(X0, X1, 185, 13);
  const dY = key.bottom + (keyItems.length ? 26 : 0) + 4;      // discord line
  const TOP = Math.round(dY + (discordLine ? 58 : 46)), FLOOR = TOP + 124, H = FLOOR + 50;
  return { svg: `${head(W, H, complaint, desc)}
${b.svg}
${glyph(X0, 150)}
<text x="${X0 + 30}" y="150" font-size="${rSize}" font-weight="500" fill="${PAPER}">${esc(reply)}</text>
${key.svg}
${discordLine ? `<text x="${X0}" y="${dY}" font-size="13" font-weight="500" fill="${GREY}">${esc(discordLine)}</text>` : ''}
${plot(X0, X1, TOP, FLOOR)}
<text x="${X1}" y="${TOP - 44}" text-anchor="end" font-size="22" font-weight="700" letter-spacing="-0.22" fill="${GOLD}">${esc(goldValue)}</text>
<text x="${X1}" y="${TOP - 28}" text-anchor="end" font-size="12" font-weight="500" letter-spacing=".24" fill="${GREY}">${esc(goldCaption)}</text>
<text x="${X1}" y="${FLOOR - 30}" text-anchor="end" font-size="14" font-weight="700" fill="${GREY}">${esc(greyValue)}</text>
<text x="${X1}" y="${FLOOR - 15}" text-anchor="end" font-size="11" font-weight="500" letter-spacing=".22" fill="${GREY}">${esc(greyNoun)}</text>
<text x="${X0}" y="${H - 24}" font-size="13" font-weight="500" letter-spacing=".52" fill="${GREY}">${esc(axisL)}</text>
<text x="${X1}" y="${H - 24}" text-anchor="end" font-size="13" font-weight="500" letter-spacing=".52" fill="${GREY}">${esc(axisR)}</text>
</svg>
`, note: `${W}x${H} complaint ${b.cSize}px reply ${rSize}px${split ? ' split' : ' plain'}` };
}
function narrow() {
  const W = 400, X0 = 24, X1 = 376;
  const b = bubble(complaint, X0, 24, 30, 18, X1 - X0);
  const rSize = 17, rLine = Math.round(rSize * 1.35);
  const lines = wrapText(reply, 500, rSize, X1 - (X0 + 26));
  const rTop = b.bottom + 34;
  const key = keyRow(X0, X1, rTop + lines.length * rLine + 6, 12);
  const dLines = discordLine ? wrapText(discordLine, 500, 12, X1 - X0) : [];
  const dY = key.bottom + (keyItems.length ? 26 : 8);
  const TOP = Math.round(dY + dLines.length * 17 + 76), FLOOR = TOP + 150, H = FLOOR + 52;
  const replySvg = lines.map((l, i) => `<text x="${X0 + 26}" y="${rTop + i * rLine}" font-size="${rSize}" font-weight="500" fill="${PAPER}">${esc(l)}</text>`).join('\n');
  const dSvg = dLines.map((l, i) => `<text x="${X0}" y="${dY + i * 17}" font-size="12" font-weight="500" fill="${GREY}">${esc(l)}</text>`).join('\n');
  return { svg: `${head(W, H, complaint, desc)}
${b.svg}
${glyph(X0, rTop, 0.9)}
${replySvg}
${key.svg}
${dSvg}
${plot(X0, X1, TOP, FLOOR)}
<text x="${X1}" y="${TOP - 44}" text-anchor="end" font-size="26" font-weight="700" letter-spacing="-0.26" fill="${GOLD}">${esc(goldValue)}</text>
<text x="${X1}" y="${TOP - 26}" text-anchor="end" font-size="12" font-weight="500" letter-spacing=".24" fill="${GREY}">${esc(goldCaption)}</text>
<text x="${X1}" y="${FLOOR - 32}" text-anchor="end" font-size="15" font-weight="700" fill="${GREY}">${esc(greyValue)}</text>
<text x="${X1}" y="${FLOOR - 16}" text-anchor="end" font-size="11" font-weight="500" letter-spacing=".22" fill="${GREY}">${esc(greyNoun)}</text>
<text x="${X0}" y="${H - 22}" font-size="12" font-weight="500" letter-spacing=".48" fill="${GREY}">${esc(axisL)}</text>
<text x="${X1}" y="${H - 22}" text-anchor="end" font-size="12" font-weight="500" letter-spacing=".48" fill="${GREY}">${esc(axisR)}</text>
</svg>
`, note: `${W}x${H} reply ${lines.length} lines` };
}

// ---- the product card: one complaint, one coached curve ----------------------------
// Geometry is the site's own public demo pair (whaamkabaam.com/coach, "close range
// pulled back"): x is hand speed slow to fast, y is sensitivity. Numbers never
// render as text, per the product's own rule.
const DEMO = { x: [0, 30.5, 56.1, 70, 90, 100], before: [0.675, 0.69, 1.11, 1.7, 1.82, 1.82], after: [0.675, 0.69, 1.11, 1.63, 1.69, 1.71] };
const demoComplaint = 'my flicks overshoot', demoReply = 'Pulled your close range back.';
const demoLegendA = 'before', demoLegendB = 'now', demoAxis = ['slow', 'hand speed', 'fast'];
for (const [s, w] of [[demoComplaint, 700], [demoReply, 500], [demoLegendA, 500], [demoLegendB, 500], ...demoAxis.map(a => [a, 500])]) { assertNoDashes(s); assertGlyphs(s, w); }
function demoPlot(X0, X1, TOP, FLOOR) {
  const xs = DEMO.x, yMin = 0.55, yMax = 2.0;
  const x = v => X0 + (v / 100) * (X1 - X0);
  const y = v => FLOOR - ((v - yMin) / (yMax - yMin)) * (FLOOR - TOP);
  const pts = arr => xs.map((xv, i) => [x(xv), y(arr[i])]);
  const dBefore = monotonePath(pts(DEMO.before)), dAfter = monotonePath(pts(DEMO.after));
  const endB = pts(DEMO.before).at(-1), endA = pts(DEMO.after).at(-1);
  const area = `${dAfter} L${X1} ${FLOOR} L${X0} ${FLOOR} Z`;
  // base state is the coached curve; SMIL replays the morph once from the old shape
  return `<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="${TOP}" x2="0" y2="${FLOOR}"><stop offset="0" stop-color="${GOLD}" stop-opacity=".18"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></linearGradient></defs>
<path d="${area}" fill="url(#g)"><animate attributeName="d" values="${dBefore} L${X1} ${FLOOR} L${X0} ${FLOOR} Z;${area}" begin=".9s" dur=".9s" calcMode="spline" keySplines="0.2 0 0 1" fill="freeze"/></path>
<path d="${dBefore}" fill="none" stroke="${GREY}" stroke-width="1.8" stroke-dasharray="6 5" opacity="0"><animate attributeName="opacity" from="0" to=".85" begin=".9s" dur=".6s" fill="freeze"/><set attributeName="opacity" to="0" begin="0s" dur=".9s"/></path>
<circle cx="${endB[0].toFixed(1)}" cy="${endB[1].toFixed(1)}" r="3.5" fill="${GREY}" opacity=".85"/>
<g fill="none" stroke="${GOLD}" stroke-linecap="round" stroke-linejoin="round">
  <path d="${dAfter}" stroke-width="9" opacity=".05"><animate attributeName="d" values="${dBefore};${dAfter}" begin=".9s" dur=".9s" calcMode="spline" keySplines="0.2 0 0 1" fill="freeze"/></path>
  <path d="${dAfter}" stroke-width="5" opacity=".11"><animate attributeName="d" values="${dBefore};${dAfter}" begin=".9s" dur=".9s" calcMode="spline" keySplines="0.2 0 0 1" fill="freeze"/></path>
  <path d="${dAfter}" stroke-width="2.5"><animate attributeName="d" values="${dBefore};${dAfter}" begin=".9s" dur=".9s" calcMode="spline" keySplines="0.2 0 0 1" fill="freeze"/></path>
</g>
<g><circle cx="${endA[0].toFixed(1)}" cy="${endA[1].toFixed(1)}" r="9" fill="${GOLD}" opacity=".16"><animate attributeName="cy" values="${endB[1].toFixed(1)};${endA[1].toFixed(1)}" begin=".9s" dur=".9s" calcMode="spline" keySplines="0.2 0 0 1" fill="freeze"/></circle><circle cx="${endA[0].toFixed(1)}" cy="${endA[1].toFixed(1)}" r="4.5" fill="#FFEDB0" stroke="${INK}" stroke-width="2"><animate attributeName="cy" values="${endB[1].toFixed(1)};${endA[1].toFixed(1)}" begin=".9s" dur=".9s" calcMode="spline" keySplines="0.2 0 0 1" fill="freeze"/></circle></g>`;
}
function demoCard(W, X0, X1, cSize, pad, rSize) {
  const b = bubble(demoComplaint, X0, W > 500 ? 40 : 24, cSize, pad, X1 - X0);
  const rY = b.bottom + (W > 500 ? 32 : 30);
  const legY = rY + 30, TOP = legY + 34, FLOOR = TOP + (W > 500 ? 130 : 140), H = FLOOR + (W > 500 ? 50 : 52);
  const legend = `<line x1="${X0}" y1="${legY - 4}" x2="${X0 + 24}" y2="${legY - 4}" stroke="${GREY}" stroke-width="1.8" stroke-dasharray="5 4"/><text x="${X0 + 31}" y="${legY}" font-size="12" font-weight="500" fill="${GREY}">${demoLegendA}</text><line x1="${X0 + 92}" y1="${legY - 4}" x2="${X0 + 116}" y2="${legY - 4}" stroke="${GOLD}" stroke-width="2.5" stroke-linecap="round"/><text x="${X0 + 123}" y="${legY}" font-size="12" font-weight="500" fill="${GREY}">${demoLegendB}</text>`;
  return `${head(W, H, demoComplaint, `${demoComplaint}. ${demoReply} the coached curve (gold) against the previous one (dashed): the fast end of the sensitivity curve pulled down, slow end unchanged. axis: hand speed, slow to fast.`)}
${b.svg}
${glyph(X0, rY, W > 500 ? 1 : 0.9)}
<text x="${X0 + 30}" y="${rY}" font-size="${rSize}" font-weight="500" fill="${PAPER}">${esc(demoReply)}</text>
${legend}
${demoPlot(X0, X1, TOP, FLOOR)}
<text x="${X0}" y="${H - 22}" font-size="12" font-weight="500" letter-spacing=".48" fill="${GREY}">${demoAxis[0]}</text>
<text x="${(X0 + X1) / 2}" y="${H - 22}" text-anchor="middle" font-size="12" font-weight="500" letter-spacing=".48" fill="${GREY}">${demoAxis[1]}</text>
<text x="${X1}" y="${H - 22}" text-anchor="end" font-size="12" font-weight="500" letter-spacing=".48" fill="${GREY}">${demoAxis[2]}</text>
</svg>
`;
}

// ---- social preview 1280x640 --------------------------------------------------------
function social() {
  const W = 1280, H = 640, X0 = 80, X1 = 1200, TOP = 300, FLOOR = 560;
  const xs = DEMO.x, yMin = 0.55, yMax = 2.0;
  const x = v => X0 + (v / 100) * (X1 - X0), y = v => FLOOR - ((v - yMin) / (yMax - yMin)) * (FLOOR - TOP);
  const pts = arr => xs.map((xv, i) => [x(xv), y(arr[i])]);
  const dAfter = monotonePath(pts(DEMO.after)), dBefore = monotonePath(pts(DEMO.before)), end = pts(DEMO.after).at(-1);
  const line1 = 'i make people aim better, faster,', line2 = 'programmatically. no cheats.';
  for (const s of ['whaamkabaam', line1, line2, 'github.com/whaamkabaam']) { assertNoDashes(s); assertGlyphs(s, 700); }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<style>${fontFace(500, 'inter-Medium.woff2')}${fontFace(700, 'inter-Bold.woff2')}text{font-family:${FONT_STACK}}</style>
<defs><linearGradient id="s" gradientUnits="userSpaceOnUse" x1="0" y1="${TOP}" x2="0" y2="${FLOOR}"><stop offset="0" stop-color="${GOLD}" stop-opacity=".2"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="${INK}"/>
${glyph(X0, 108, 1.8)}
<text x="${X0 + 52}" y="110" font-size="30" font-weight="700" letter-spacing="1.5" fill="${PAPER}">whaamkabaam</text>
<text x="${X0}" y="196" font-size="54" font-weight="700" letter-spacing="-1.2" fill="${PAPER}">${esc(line1)}</text>
<text x="${X0}" y="258" font-size="54" font-weight="700" letter-spacing="-1.2" fill="${PAPER}">${esc(line2)}</text>
<path d="${dAfter} L${X1} ${FLOOR} L${X0} ${FLOOR} Z" fill="url(#s)"/>
<path d="${dBefore}" fill="none" stroke="${GREY}" stroke-width="2.5" stroke-dasharray="8 7" opacity=".8"/>
<g fill="none" stroke="${GOLD}" stroke-linecap="round"><path d="${dAfter}" stroke-width="16" opacity=".06"/><path d="${dAfter}" stroke-width="8" opacity=".12"/><path d="${dAfter}" stroke-width="4"/></g>
<circle cx="${end[0].toFixed(1)}" cy="${end[1].toFixed(1)}" r="14" fill="${GOLD}" opacity=".16"/><circle cx="${end[0].toFixed(1)}" cy="${end[1].toFixed(1)}" r="7" fill="#FFEDB0" stroke="${INK}" stroke-width="3"/>
<text x="${X1}" y="${H - 34}" text-anchor="end" font-size="18" font-weight="500" letter-spacing=".6" fill="${GREY}">github.com/whaamkabaam</text>
</svg>
`;
}

mkdirSync('assets', { recursive: true });
const w = wide(), n = narrow();
writeFileSync('assets/coach.svg', w.svg);
writeFileSync('assets/coach-narrow.svg', n.svg);
writeFileSync('assets/demo.svg', demoCard(846, 40, 806, 44, 26, 19));
writeFileSync('assets/demo-narrow.svg', demoCard(400, 24, 376, 30, 18, 17));
writeFileSync('assets/social.svg', social());
console.log(`coach ${w.note} | narrow ${n.note} | stamp "${stamp}"${stateB ? ' | STATE B' : ''} | discord ${data.discord ? data.discord.members : 'none'}`);
