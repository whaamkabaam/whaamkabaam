// Renders the cards from data/profile.json. No DOM, no browser, no dependencies.
//   assets/coach.svg          846 wide: the year as a drip painting, desktop column
//   assets/coach-narrow.svg   400 wide: the same, served to phones through <picture>
//   assets/social.svg         1280x640 source for the repo's social preview
// One fling of paint per active day, heavier days throw more. Gold is the coach,
// white is summerup, orange is everything else (needs the per-project split;
// without it every day is gold). Deterministic: the same data draws the same
// painting. Reveals left to right once on load; the base state is the finished
// painting, so a renderer without SMIL still shows it.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { GOLD, INK, GREY, PAPER, fontFace, FONT_STACK, fmt, esc, monotonePath, textWidth, assertGlyphs, assertNoDashes } from './svg-lib.mjs';

const data = JSON.parse(readFileSync('data/profile.json', 'utf8'));
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const lastDay = data.days.at(-1).date;
const stamp = `${Number(lastDay.slice(8, 10))} ${MONTHS[Number(lastDay.slice(5, 7)) - 1]} ${lastDay.slice(0, 4)}`;
const CANVAS = '#0d0d0f';
const COL = { coach: '#FFD740', summerup: '#F4F1EA', other: '#FF8A3D' };
const TINTS = { [COL.coach]: ['#FFD740', '#FFE066', '#F2C21F', '#FFEDB0'], [COL.summerup]: ['#F4F1EA', '#FFFFFF', '#E6E2D6'], [COL.other]: ['#FF8A3D', '#FF9F5A', '#F0742A'] };
const proj = Object.fromEntries((data.projects || []).map(p => [p.label, p.days]));
const split = Boolean(data.projects && data.projects.length > 1);
const sumOf = m => m ? Object.values(m).reduce((a, b) => a + b, 0) : 0;
const coachTotal = sumOf(proj['whaamkabaam.com']), summerupTotal = sumOf(proj['summerup']);
const elseTotal = data.total - coachTotal - summerupTotal;

// ---- copy ----------------------------------------------------------------------
const stateB = process.env.STATE_B === '1' && data.trailing14 === 0;
const complaint = stateB ? 'nothing’s moved in weeks' : 'i can’t see what you build';
const reply = stateB ? 'nothing new in 14 days.' : 'you’re looking at it.';
const replyGrey = stateB ? 'the paint is the last 365 days.' : 'one stroke per day for the last year. busy days get bigger strokes.';
const key = split
  ? [['whaamkabaam.com', COL.coach, coachTotal], ['summerup', COL.summerup, summerupTotal], ['everything else', COL.other, elseTotal]]
  : [['contributions', COL.coach, data.total], ['in public repos', GREY, data.public]];
const totalLine = `${fmt(data.total)} in the last year`;
const discordLine = data.discord ? `${fmt(data.discord.members)} in the discord, checked ${data.discord.checked.slice(11, 16)} utc` : '';
for (const [s, w] of [[complaint, 700], [reply, 500], [replyGrey, 500], [totalLine, 500], [discordLine, 500], ['a year ago', 500], [stamp, 500], ...key.map(k => [`${k[0]} ${fmt(k[2])}`, 500])]) { assertNoDashes(s); assertGlyphs(s, w); }

// ---- the painting -------------------------------------------------------------------
function rng(seed) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function colourFor(d) {
  if (!split) return COL.coach;
  const c = proj['whaamkabaam.com']?.[d.date] || 0, s = proj['summerup']?.[d.date] || 0, o = Math.max(0, d.count - c - s);
  const m = Math.max(c, s, o); return m === c ? COL.coach : m === s ? COL.summerup : COL.other;
}
function painting(X0, X1, TOP, BOT, k) {
  // k scales stroke lengths and widths for the narrow cut
  let paint = '';
  const n = data.days.length;
  data.days.forEach((d, i) => {
    if (!d.count) return;
    const r = rng(Number(d.date.replace(/-/g, '')));
    const cx = X0 + (i / (n - 1)) * (X1 - X0);
    const col = colourFor(d), tints = TINTS[col];
    const strokes = 1 + Math.floor(Math.sqrt(d.count) / 2.6);
    for (let s = 0; s < strokes; s++) {
      const t = tints[Math.floor(r() * tints.length)];
      const x = cx + (r() - .5) * 26 * k, y = TOP + r() * (BOT - TOP);
      const len = (14 + Math.sqrt(d.count) * (5 + r() * 9)) * k;
      const a = (r() - .5) * Math.PI * 1.4 + (r() < .5 ? 0 : Math.PI);
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len * .55;
      const c1x = x + (ex - x) * .3 + (r() - .5) * len * .5, c1y = y + (ey - y) * .3 + (r() - .5) * len * .5;
      const c2x = x + (ex - x) * .7 + (r() - .5) * len * .5, c2y = y + (ey - y) * .7 + (r() - .5) * len * .5;
      const w = (0.5 + r() * 1.7 + (d.count > 100 ? 0.6 : 0)) * Math.max(k, .8);
      paint += `<path d="M${x.toFixed(1)} ${y.toFixed(1)}C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}" stroke="${t}" stroke-width="${w.toFixed(2)}" opacity="${(0.7 + r() * .3).toFixed(2)}"/>`;
      paint += `<ellipse cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" rx="${(w * 1.6 + r() * 2.2 * k).toFixed(1)}" ry="${(w * 1.1 + r() * 1.4 * k).toFixed(1)}" fill="${t}" opacity=".9"/>`;
      const drops = 1 + Math.floor(r() * 4);
      for (let q = 0; q < drops; q++) {
        const u = r(); const px = x + (ex - x) * u + (r() - .5) * 14 * k, py = y + (ey - y) * u + (r() - .5) * 14 * k;
        paint += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${((0.5 + r() * 1.6) * Math.max(k, .8)).toFixed(1)}" fill="${t}" opacity="${(0.6 + r() * .4).toFixed(2)}"/>`;
      }
    }
    if (d.count >= 60) {   // heavy days pool and run
      const x = cx + (r() - .5) * 10 * k, y = TOP + 20 * k + r() * (BOT - TOP - 60 * k), rad = (2.5 + Math.sqrt(d.count) * .5) * k;
      const len = (8 + Math.sqrt(d.count) * 1.8) * k, wob = (r() - .5) * 8 * k;
      paint += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rad.toFixed(1)}" ry="${(rad * .8).toFixed(1)}" fill="${col}" opacity=".95"/><path d="M${x.toFixed(1)} ${y.toFixed(1)}q${wob.toFixed(1)} ${(len * .5).toFixed(1)} ${(wob * .4).toFixed(1)} ${len.toFixed(1)}" stroke="${col}" stroke-width="${Math.max(1, rad * .3).toFixed(1)}" opacity=".9"/><circle cx="${(x + wob * .4).toFixed(1)}" cy="${(y + len).toFixed(1)}" r="${Math.max(1.2, rad * .32).toFixed(1)}" fill="${col}"/>`;
    }
  });
  return paint;
}
const head = (W, H) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<title>${esc(complaint)}</title>
<desc>${esc(reply)} ${esc(replyGrey)} ${key.map(k => `${k[0]}: ${fmt(k[2])}`).join(', ')}. ${esc(totalLine)}, as of ${esc(stamp)}. ${esc(discordLine)}</desc>
<style>
${fontFace(500, 'inter-Medium.woff2')}
${fontFace(700, 'inter-Bold.woff2')}
text{font-family:${FONT_STACK};font-variant-numeric:tabular-nums}
</style>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="20" fill="${CANVAS}" stroke="${PAPER}" stroke-opacity=".08"/>`;
const glyph = (x, y, k = 1) => `<path d="M${x},${y} C${x + 5 * k},${y} ${x + 8 * k},${y - 5 * k} ${x + 12 * k},${y - 10 * k} C${x + 16 * k},${y - 15 * k} ${x + 16 * k},${y - 12 * k} ${x + 20 * k},${y - 12 * k}" fill="none" stroke="${GOLD}" stroke-width="${(2.2 * k).toFixed(1)}" stroke-linecap="round"/>`;
const bubble = (text, X0, y, size, pad, maxW) => {
  let cSize = size, w = textWidth(text, 700, cSize, -0.02 * cSize) + 2 * pad;
  while (w > maxW && cSize > 20) { cSize -= 1; w = textWidth(text, 700, cSize, -0.02 * cSize) + 2 * pad; }
  const h = Math.round(cSize * 1.68), base = y + Math.round(h / 2 + cSize * 0.36);
  return { svg: `<rect x="${X0}" y="${y}" width="${Math.round(w)}" height="${h}" rx="${Math.round(h / 3)}" fill="${PAPER}" fill-opacity=".07"/>
<text x="${X0 + pad}" y="${base}" font-size="${cSize}" font-weight="700" letter-spacing="${(-0.02 * cSize).toFixed(2)}" fill="${PAPER}">${esc(text)}</text>`, bottom: y + h, cSize };
};
const keyRow = (X0, X1, y, size) => {
  let x = X0, line = 0, out = ''; const dot = size * .35;
  for (const [label, col, n] of key) {
    const text = `${label} ${fmt(n)}`, w = dot * 2 + 8 + textWidth(text, 500, size);
    if (x + w > X1 && x > X0) { x = X0; line++; }
    const yy = y + line * size * 1.8;
    out += `<circle cx="${(x + dot).toFixed(1)}" cy="${(yy - size * .33).toFixed(1)}" r="${dot.toFixed(1)}" fill="${col}"/><text x="${(x + dot * 2 + 8).toFixed(1)}" y="${yy}" font-size="${size}" font-weight="500" fill="${GREY}">${esc(label)} <tspan fill="${PAPER}">${fmt(n)}</tspan></text>`;
    x += w + size * 1.9;
  }
  return { svg: out, lines: line + 1 };
};
const reveal = (W, TOP, BOT) => `<clipPath id="reveal"><rect x="0" y="${TOP - 6}" width="${W}" height="${BOT - TOP + 12}"><animate attributeName="width" from="0" to="${W}" begin=".4s" dur="2.6s" calcMode="spline" keySplines="0.4 0 0.2 1" fill="freeze"/></rect></clipPath>`;

function wide() {
  const W = 846, X0 = 40, X1 = 806;
  const b = bubble(complaint, X0, 40, 44, 26, X1 - X0);
  const rY = b.bottom + 36;
  let gSize = 19; while (textWidth(reply + ' ' + replyGrey, 500, gSize) > X1 - (X0 + 30) && gSize > 14) gSize -= .5;
  const TOP = rY + 56, BOT = TOP + 198, H = BOT + 86;
  const k = keyRow(X0, X1, H - 48, 13);
  return `${head(W, H)}
<defs>${reveal(W, TOP, BOT)}</defs>
${b.svg}
${glyph(X0, rY)}
<text x="${X0 + 30}" y="${rY}" font-size="${gSize}" font-weight="500" fill="${PAPER}">${esc(reply)} <tspan fill="${GREY}">${esc(replyGrey)}</tspan></text>
<text x="${X0}" y="${TOP - 12}" font-size="11" font-weight="500" letter-spacing=".4" fill="${GREY}" opacity=".75">a year ago</text>
<text x="${X1}" y="${TOP - 12}" text-anchor="end" font-size="11" font-weight="500" letter-spacing=".4" fill="${GREY}" opacity=".75">${esc(stamp)}</text>
<g clip-path="url(#reveal)" fill="none" stroke-linecap="round">${painting(X0, X1, TOP, BOT, 1)}</g>
${k.svg}
<text x="${X0}" y="${H - 24}" font-size="12" font-weight="500" fill="${GREY}">${esc(totalLine)}${discordLine ? ' · ' + esc(discordLine) : ''}</text>
</svg>
`;
}
function narrow() {
  const W = 400, X0 = 24, X1 = 376;
  const b = bubble(complaint, X0, 24, 30, 18, X1 - X0);
  const rY = b.bottom + 30;
  const TOP = rY + 54, BOT = TOP + 210;
  const k = keyRow(X0, X1, BOT + 40, 12);
  const H = BOT + 40 + (k.lines - 1) * 12 * 1.8 + 46;
  return `${head(W, H)}
<defs>${reveal(W, TOP, BOT)}</defs>
${b.svg}
${glyph(X0, rY, .9)}
<text x="${X0 + 26}" y="${rY}" font-size="17" font-weight="500" fill="${PAPER}">${esc(reply)}</text>
<text x="${X0}" y="${rY + 22}" font-size="13" font-weight="500" fill="${GREY}">${esc(replyGrey)}</text>
<text x="${X0}" y="${TOP - 12}" font-size="11" font-weight="500" letter-spacing=".4" fill="${GREY}" opacity=".75">a year ago</text>
<text x="${X1}" y="${TOP - 12}" text-anchor="end" font-size="11" font-weight="500" letter-spacing=".4" fill="${GREY}" opacity=".75">${esc(stamp)}</text>
<g clip-path="url(#reveal)" fill="none" stroke-linecap="round">${painting(X0, X1, TOP, BOT, .62)}</g>
${k.svg}
<text x="${X0}" y="${H - 22}" font-size="12" font-weight="500" fill="${GREY}">${esc(totalLine)}${discordLine ? ' · ' + esc(discordLine) : ''}</text>
</svg>
`;
}

// ---- social preview 1280x640: the painting, one line, the handle -----------------------
function social() {
  const W = 1280, H = 640, X0 = 80, X1 = 1200, TOP = 320, BOT = 560;
  const line1 = 'i make people aim better, faster,', line2 = 'programmatically. no cheats.';
  for (const s of ['whaamkabaam', line1, line2, 'github.com/whaamkabaam']) { assertNoDashes(s); assertGlyphs(s, 700); }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<style>${fontFace(500, 'inter-Medium.woff2')}${fontFace(700, 'inter-Bold.woff2')}text{font-family:${FONT_STACK}}</style>
<rect width="${W}" height="${H}" fill="${CANVAS}"/>
${glyph(X0, 108, 1.8)}
<text x="${X0 + 52}" y="110" font-size="30" font-weight="700" letter-spacing="1.5" fill="${PAPER}">whaamkabaam</text>
<text x="${X0}" y="196" font-size="54" font-weight="700" letter-spacing="-1.2" fill="${PAPER}">${esc(line1)}</text>
<text x="${X0}" y="258" font-size="54" font-weight="700" letter-spacing="-1.2" fill="${PAPER}">${esc(line2)}</text>
<defs><clipPath id="band"><rect x="0" y="${TOP - 10}" width="${W}" height="${BOT - TOP + 20}"/></clipPath></defs>
<g clip-path="url(#band)" fill="none" stroke-linecap="round">${painting(X0, X1, TOP, BOT, 1.25)}</g>
<text x="${X1}" y="${H - 26}" text-anchor="end" font-size="18" font-weight="500" letter-spacing=".6" fill="${GREY}">github.com/whaamkabaam</text>
</svg>
`;
}

mkdirSync('assets', { recursive: true });
const w = wide(), n = narrow(), s = social();
writeFileSync('assets/coach.svg', w); writeFileSync('assets/coach-narrow.svg', n); writeFileSync('assets/social.svg', s);
console.log(`coach ${(w.length / 1024).toFixed(0)} KB | narrow ${(n.length / 1024).toFixed(0)} KB | social ${(s.length / 1024).toFixed(0)} KB | ${split ? 'split' : 'plain'} | stamp "${stamp}"${stateB ? ' | STATE B' : ''}`);
