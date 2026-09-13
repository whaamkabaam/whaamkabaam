// Mirrors the card's numbers into a public gist as plain text, so a pinned gist
// carries them in GitHub's own styling with nothing to break. Runs only when
// PROFILE_TOKEN (fine-grained, gists: write) is present; otherwise exits 0.
import { readFileSync } from 'node:fs';
const TOKEN = process.env.PROFILE_TOKEN;
if (!TOKEN) { console.log('gist: no PROFILE_TOKEN, skipping'); process.exit(0); }
const d = JSON.parse(readFileSync('data/profile.json', 'utf8'));
const FILE = 'whaamkabaam-in-numbers.md';
const fmt = n => new Intl.NumberFormat('en-US').format(n);
const when = d.generated.slice(0, 16).replace('T', ' ') + ' utc';
const rows = [
  ['contributions, last 365 days', fmt(d.total)],
  ['of them in private repos', fmt(d.private)],
  ...(d.projects ? d.projects.filter(p => p.label !== 'other').slice(0, 4).map(p => [`  ${p.label}`, fmt(p.total)]) : []),
  ...(d.discord ? [['discord members', fmt(d.discord.members)], ['online when checked', fmt(d.discord.online)]] : []),
  ['busiest day', `${fmt(d.busiest.count)} on ${d.busiest.date}`],
  ['longest streak', `${d.best_streak} days`],
];
const w = Math.max(...rows.map(r => r[0].length)) + 2;
const body = '```\n' + rows.map(([k, v]) => k.padEnd(w) + v).join('\n') + `\n\nrefreshed ${when} by github.com/whaamkabaam/whaamkabaam\n` + '```\n';
const h = { authorization: `bearer ${TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'whaamkabaam-profile-card', 'content-type': 'application/json' };
const list = await (await fetch('https://api.github.com/gists?per_page=100', { headers: h })).json();
const existing = Array.isArray(list) ? list.find(g => g.files && g.files[FILE]) : null;
const payload = JSON.stringify({ description: 'whaamkabaam, in numbers. refreshed hourly.', public: true, files: { [FILE]: { content: body } } });
const r = await fetch(existing ? `https://api.github.com/gists/${existing.id}` : 'https://api.github.com/gists', { method: existing ? 'PATCH' : 'POST', headers: h, body: payload });
if (!r.ok) { console.error('gist:', r.status, (await r.text()).slice(0, 200)); process.exit(1); }
const g = await r.json();
console.log(`gist ${existing ? 'updated' : 'created'}: ${g.html_url}`);
