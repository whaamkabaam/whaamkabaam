// Fetches everything the cards need and writes data/profile.json.
//
// Tokens, in order of what they unlock:
//   PROFILE_TOKEN  a fine-grained token of the owner that can see private repos:
//                  unlocks the per-project split of the year (commits by repo).
//   GITHUB_TOKEN   the Actions token: calendar totals incl. private counts
//                  (because "include private contributions" is on), public repos.
//   none           the public HTML fragment github.com renders, same numbers.
// The Discord count needs no token at all.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

const LOGIN = process.env.PROFILE_LOGIN || 'whaamkabaam';
const TOKEN = process.env.PROFILE_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const CAN_SEE_PRIVATE = Boolean(process.env.PROFILE_TOKEN || process.env.ASSUME_OWNER_TOKEN);
const UA = `${LOGIN}-profile-card`;
const PROJECTS = JSON.parse(readFileSync(new URL('../projects.json', import.meta.url), 'utf8'));

const warn = (...a) => console.error('warn:', ...a);
const fail = (msg) => { console.error('fatal:', msg); process.exit(1); };

async function gql(query, variables) {
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': UA, authorization: `bearer ${TOKEN}` },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (!r.ok || j.errors) throw new Error(`graphql ${r.status}: ${JSON.stringify(j.errors || j).slice(0, 300)}`);
  return j.data;
}
async function rest(path, params = {}) {
  const u = new URL(`https://api.github.com${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const h = { 'user-agent': UA, accept: 'application/vnd.github+json' };
  if (TOKEN) h.authorization = `bearer ${TOKEN}`;
  const r = await fetch(u, { headers: h });
  if (!r.ok) throw new Error(`rest ${r.status} ${path}`);
  return { json: await r.json(), link: r.headers.get('link') || '' };
}

// Explicit 365-day window ending today (UTC). The default window drifted on
// 2026-09-13 (a total spanning 373 days over 365 cells); explicit bounds keep
// the total and the cells consistent.
function windowBounds() {
  const to = new Date(); to.setUTCHours(23, 59, 59, 0);
  const from = new Date(to); from.setUTCDate(from.getUTCDate() - 364); from.setUTCHours(0, 0, 0, 0);
  const iso = d => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  return { from: iso(from), to: iso(to) };
}

async function fromGraphql() {
  const { from, to } = windowBounds();
  const q = `query($login:String!, $after:String, $from:DateTime!, $to:DateTime!){ user(login:$login){ contributionsCollection(from:$from, to:$to){
    startedAt endedAt
    totalCommitContributions totalIssueContributions totalPullRequestContributions
    totalPullRequestReviewContributions totalRepositoryContributions restrictedContributionsCount
    contributionCalendar{ totalContributions weeks{ contributionDays{ date contributionCount } } }
    repositoryContributions(first:100){ nodes{ occurredAt repository{ name isPrivate } } }
    issueContributions(first:100){ nodes{ occurredAt issue{ repository{ isPrivate } } } }
    pullRequestContributions(first:100){ nodes{ occurredAt pullRequest{ repository{ isPrivate } } } }
    pullRequestReviewContributions(first:100){ nodes{ occurredAt pullRequestReview{ repository{ isPrivate } } } }
    commitContributionsByRepository(maxRepositories:100){ repository{ name isPrivate }
      contributions(first:100, after:$after){ pageInfo{ hasNextPage endCursor } nodes{ occurredAt commitCount } } }
  } } }`;
  const d = await gql(q, { login: LOGIN, after: null, from, to });
  const c = d.user.contributionsCollection;
  let restSplit = false;
  const days = c.contributionCalendar.weeks.flatMap(w => w.contributionDays).map(x => ({ date: x.date, count: x.contributionCount }));
  const pub = new Map();                         // date -> public typed contributions
  const byRepo = new Map();                      // repo -> Map(date -> commits)
  const addPub = (iso, n = 1) => { const k = iso.slice(0, 10); pub.set(k, (pub.get(k) || 0) + n); };
  for (const n of c.repositoryContributions.nodes) if (!n.repository.isPrivate) addPub(n.occurredAt);
  const privOf = n => (n.repository || n.issue?.repository || n.pullRequest?.repository || n.pullRequestReview?.repository || {}).isPrivate;
  for (const list of [c.issueContributions, c.pullRequestContributions, c.pullRequestReviewContributions])
    for (const n of list.nodes) if (!privOf(n)) addPub(n.occurredAt);
  for (const repo of c.commitContributionsByRepository) {
    const name = repo.repository.name;
    const m = byRepo.get(name) || new Map(); byRepo.set(name, m);
    let page = repo.contributions;
    for (;;) {
      for (const n of page.nodes) {
        const k = n.occurredAt.slice(0, 10);
        m.set(k, (m.get(k) || 0) + n.commitCount);
        if (!repo.repository.isPrivate) addPub(n.occurredAt, n.commitCount);
      }
      if (!page.pageInfo.hasNextPage) break;
      const more = await gql(q, { login: LOGIN, after: page.pageInfo.endCursor, from, to });
      const again = more.user.contributionsCollection.commitContributionsByRepository.find(r => r.repository.name === name);
      if (!again) break;
      page = again.contributions;
    }
  }
  // GraphQL only listed public repos for this token? Then fetch the private
  // side through REST (fine-grained tokens can), so the split stays honest.
  const sawPrivate = c.commitContributionsByRepository.some(r => r.repository.isPrivate);
  if (CAN_SEE_PRIVATE && !sawPrivate) {
    const priv = await privateCommitsViaRest(from, to);
    let n = 0; for (const [name, m] of priv) { byRepo.set(name, m); n += [...m.values()].reduce((a, b) => a + b, 0); }
    warn(`graphql hid private repos from this token; counted ${n} private commits across ${priv.size} repos through rest`);
    restSplit = true;
  }
  return { source: 'graphql', days, total: c.contributionCalendar.totalContributions, restricted: c.restrictedContributionsCount, pub, byRepo, restSplit, window: { startedAt: c.startedAt, endedAt: c.endedAt } };
}

// A fine-grained token can read private repos through REST even when GraphQL's
// contributionsCollection hides them. Counts commits authored by the owner per
// private repo per day inside the window.
async function privateCommitsViaRest(from, to) {
  const out = new Map();
  let page = 1, repos = [];
  for (;;) {
    const { json, link } = await rest('/user/repos', { per_page: 100, page, affiliation: 'owner', visibility: 'private' });
    repos = repos.concat(json);
    if (!/rel="next"/.test(link) || ++page > 10) break;
  }
  for (const repo of repos) {
    const m = new Map(); let p = 1;
    for (;;) {
      let res;
      try { res = await rest(`/repos/${LOGIN}/${repo.name}/commits`, { per_page: 100, page: p, since: from, until: to, author: LOGIN }); }
      catch (e) { warn(`rest commits ${repo.name}: ${e.message}`); break; }
      for (const c of res.json) { const k = (c.commit?.author?.date || '').slice(0, 10); if (k) m.set(k, (m.get(k) || 0) + 1); }
      if (!/rel="next"/.test(res.link) || ++p > 60) break;
    }
    if (m.size) out.set(repo.name, m);
  }
  return out;
}

async function fromHtml() {
  const r = await fetch(`https://github.com/users/${LOGIN}/contributions`, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`fragment ${r.status}`);
  const html = await r.text();
  const cells = [...html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"[^>]*id="([^"]+)"/g)].map(m => ({ date: m[1], id: m[2] }));
  const tips = new Map([...html.matchAll(/<tool-tip[^>]*for="([^"]+)"[^>]*>\s*(No|[\d,]+) contributions?/g)].map(m => [m[1], m[2] === 'No' ? 0 : Number(m[2].replace(/,/g, ''))]));
  const days = cells.map(c => ({ date: c.date, count: tips.get(c.id) ?? 0 })).sort((a, b) => a.date.localeCompare(b.date));
  if (days.length < 300) throw new Error(`fragment parsed only ${days.length} days`);
  const { json: repos } = await rest(`/users/${LOGIN}/repos`, { per_page: 100, type: 'owner' });
  const pub = new Map();
  const add = (iso, n = 1) => { const k = iso.slice(0, 10); pub.set(k, (pub.get(k) || 0) + n); };
  const since = days[0].date + 'T00:00:00Z';
  for (const repo of repos.filter(x => !x.fork)) {
    if (repo.created_at >= since) add(repo.created_at);
    let page = 1;
    for (;;) {
      const { json, link } = await rest(`/repos/${LOGIN}/${repo.name}/commits`, { per_page: 100, page, since, author: LOGIN });
      for (const c of json) add(c.commit?.author?.date || '');
      if (!/rel="next"/.test(link) || ++page > 20) break;
    }
  }
  return { source: 'html', days, total: days.reduce((s, d) => s + d.count, 0), restricted: null, pub, byRepo: new Map(), restSplit: false, window: null };
}

async function discord() {
  try {
    const r = await fetch('https://discord.com/api/v10/invites/whaam?with_counts=true', { headers: { 'user-agent': UA } });
    if (!r.ok) throw new Error(`discord ${r.status}`);
    const j = await r.json();
    if (!j.approximate_member_count) throw new Error('discord: no member count');
    return { members: j.approximate_member_count, online: j.approximate_presence_count, checked: new Date().toISOString() };
  } catch (e) { warn(e.message); return null; }
}

async function previousPublished() {
  try {
    const r = await fetch(`https://raw.githubusercontent.com/${LOGIN}/${LOGIN}/output/profile.json`, { headers: { 'user-agent': UA } });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

async function main() {
  let cal;
  try { cal = await fromGraphql(); }
  catch (e) { warn('graphql failed, using the public fragment:', e.message); cal = await fromHtml(); }

  const days = cal.days.map(d => ({ ...d, public: cal.pub.get(d.date) || 0 }));
  const daySum = days.reduce((s, d) => s + d.count, 0);
  if (daySum !== cal.total) warn(`GitHub's calendar total ${cal.total} != the sum of its day cells ${daySum}; the card draws the cells`);
  const total = daySum;
  const publicTotal = days.reduce((s, d) => s + d.public, 0);
  // restrictedContributionsCount is what THIS token cannot see. For the Actions
  // token that is the private total; for a token that sees private repos it is 0
  // and the private total is everything that is not public.
  const priv = (cal.restricted && cal.restricted > 0) ? cal.restricted : Math.max(0, total - publicTotal);
  if (!CAN_SEE_PRIVATE && cal.source === 'graphql' && (cal.restricted || 0) === 0 && total > publicTotal) fail('restricted count is 0 on a token that should not see private repos; refusing to publish');
  if (priv === 0 && total > 0) fail('no private contributions found at all; refusing to publish a card that would lie');
  const prev = await previousPublished();
  if (prev && typeof prev.total === 'number' && total < prev.total * 0.5) fail(`total ${total} is less than half of the last published ${prev.total}; refusing to publish`);

  // per-project split: only when the token can see private repos (the split
  // would otherwise be "plox 100%", contradicting the totals on the same card)
  let projects = null;
  if (CAN_SEE_PRIVATE && cal.byRepo.size) {
    const perLabel = new Map();
    for (const [repo, m] of cal.byRepo) {
      const label = PROJECTS[repo] || 'other';
      const series = perLabel.get(label) || new Map(); perLabel.set(label, series);
      for (const [date, n] of m) series.set(date, (series.get(date) || 0) + n);
    }
    // everything in the calendar that is not a commit to a listed repo is "other"
    const named = [...perLabel.entries()].filter(([l]) => l !== 'other');
    const other = new Map(perLabel.get('other') || []);
    // The part of the calendar no named repo accounts for is "other" only when
    // the per-repo numbers came from GitHub's own contribution counts. The REST
    // path under-counts (author-filtered commits), so its gap is mostly missed
    // coach commits and must not be painted as "everything else".
    if (!cal.restSplit) for (const d of days) {
      const namedSum = named.reduce((s, [, m]) => s + (m.get(d.date) || 0), 0);
      const restDay = d.count - namedSum - (other.get(d.date) || 0);
      if (restDay > 0) other.set(d.date, (other.get(d.date) || 0) + restDay);
    }
    const rows = named.map(([label, m]) => ({ label, total: [...m.values()].reduce((a, b) => a + b, 0), days: Object.fromEntries(m) }))
      .filter(r => r.total > 0).sort((a, b) => b.total - a.total);
    const otherTotal = [...other.values()].reduce((a, b) => a + b, 0);
    if (otherTotal > 0) rows.push({ label: 'other', total: otherTotal, days: Object.fromEntries(other) });
    const coach = rows.find(r => r.label === 'whaamkabaam.com');
    if (!coach || coach.total === 0) { warn('split has no coach commits; publishing without a split'); projects = null; }
    else projects = rows;
    const split = rows.reduce((s, r) => s + r.total, 0);
    if (split !== total) warn(`project split sums to ${split}, calendar total is ${total}`);
  }

  let streak = 0, best = 0, active = 0, busiest = { date: null, count: 0 };
  for (const d of days) {
    if (d.count > 0) { streak++; active++; best = Math.max(best, streak); } else streak = 0;
    if (d.count > busiest.count) busiest = { date: d.date, count: d.count };
  }
  const out = {
    generated: new Date().toISOString(), login: LOGIN, source: cal.source, window: cal.window,
    total, private: priv, public: publicTotal, trailing14: days.slice(-14).reduce((s, d) => s + d.count, 0),
    active_days: active, days_in_window: days.length, best_streak: best, busiest,
    projects, discord: await discord(), days,
  };
  mkdirSync('data', { recursive: true });
  writeFileSync('data/profile.json', JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify({ source: out.source, total, private: priv, public: publicTotal, days: days.length, last: days.at(-1).date, projects: projects ? projects.map(p => `${p.label} ${p.total}`) : null, discord: out.discord && out.discord.members }));
}
main().catch(e => { console.error(e); process.exit(1); });
