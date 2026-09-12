import { readFileSync } from 'node:fs';

export const GOLD = '#FFD740', GOLD_DEEP = '#B8862F', GOLD_HOT = '#FFEDB0';
export const INK = '#16181d', INK_2 = '#1a1a1e', BUBBLE = '#292c34', GREY = '#97958C', PAPER = '#F8F8F6';

const cache = new Map();
export function fontFace(weight, file) {
  if (!cache.has(file)) cache.set(file, readFileSync(new URL(`../fonts/${file}`, import.meta.url)).toString('base64'));
  return `@font-face{font-family:'Inter';font-weight:${weight};font-style:normal;src:url(data:font/woff2;base64,${cache.get(file)}) format('woff2')}`;
}
export const FONT_STACK = `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;
export const fmt = n => new Intl.NumberFormat('en-US').format(n);
export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Fritsch-Carlson monotone cubic interpolation -> SVG path. Keeps a monotonic
// series monotonic (no overshoot), which is what makes a cumulative line read
// as an acceleration curve instead of a wobbly spline.
export function monotonePath(pts) {
  const n = pts.length; if (n < 2) return '';
  const dx = [], dy = [], m = [];
  for (let i = 0; i < n - 1; i++) { dx.push(pts[i + 1][0] - pts[i][0]); dy.push(pts[i + 1][1] - pts[i][1]); m.push(dy[i] / (dx[i] || 1e-9)); }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const tau = 3 / Math.sqrt(s); t[i] = tau * a * m[i]; t[i + 1] = tau * b * m[i]; }
  }
  let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${(pts[i][0] + h).toFixed(2)} ${(pts[i][1] + t[i] * h).toFixed(2)}, ${(pts[i + 1][0] - h).toFixed(2)} ${(pts[i + 1][1] - t[i + 1] * h).toFixed(2)}, ${pts[i + 1][0].toFixed(2)} ${pts[i + 1][1].toFixed(2)}`;
  }
  return d;
}
// rough cubic path length for stroke-dasharray draw-ins
export function pathLength(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }

export function weeklyCumulative(days, key) {
  const out = []; let cum = 0;
  days.forEach((d, i) => { cum += d[key]; if (i % 7 === 6 || i === days.length - 1) out.push({ date: d.date, cum }); });
  return out;
}

// Text measurement from the canvas-measured glyph table (fonts/metrics.json),
// so the runtime can size bubbles and align labels without a font library.
const METRICS = JSON.parse(readFileSync(new URL('../fonts/metrics.json', import.meta.url), 'utf8'));
export function textWidth(str, weight = 400, size = 16, letterSpacing = 0) {
  const table = METRICS[String(weight)] || METRICS['400'];
  let em = 0;
  for (const ch of String(str)) em += table[ch] ?? table['n'] ?? 0.55;
  return em * size + letterSpacing * Math.max(0, String(str).length - 1);
}

export function assertGlyphs(str) {
  const table = METRICS['700'];
  for (const ch of String(str)) if (!(ch in table)) throw new Error(`glyph not in the embedded subset: U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')} in "${str}"`);
}
export function assertNoDashes(str) {
  if (/[–—―−]/.test(str)) throw new Error(`dash character in card copy: "${str}"`);
}
