// Fetches everything the card needs. Works with the default GITHUB_TOKEN of an
// Actions run (it cannot read private repos, and does not need to: private
// counts are public once "include private contributions" is on). Works with
// no token at all too, by scraping the same public fragment github.com renders.
//
// Writes data/profile.json: { generated, source, window, total, private, public,
// trailing14, active_days, best_streak, busiest, days: [{date, count, public}] }
import { writeFileSync, mkdirSync } from 'node:fs';

const LOGIN = process.env.PROFILE_LOGIN || 'whaamkabaam';
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const UA = `${LOGIN}-profile-card`;

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

// --- calendar, primary: GraphQL with NO from/to. The default window is the
// one github.com renders on the profile (verified 2026-09-12: 371 days,
// identical to the logged-out fragment to the digit).
async function fromGraphql() {
  const q = `query($login:String!, $after:String){ user(login:$login){ contributionsCollection{
    startedAt endedAt
    totalCommitContributions totalIssueContributions totalPullRequestContributions
    totalPullRequestReviewContributions totalRepositoryContributions restrictedContributionsCount
    contributionCalendar{ totalContributions weeks{ contributionDays{ date contributionCount } } }
    repositoryContributions(first:100){ nodes{ occurredAt } }
    issueContributions(first:100){ nodes{ occurredAt } }
    pullRequestContributions(first:100){ nodes{ occurredAt } }
    pullRequestReviewContributions(first:100){ nodes{ occurredAt } }
    commitContributionsByRepository(maxRepositories:100){ repository{ nameWithOwner }
      contributions(first:100, after:$after){ pageInfo{ hasNextPage endCursor } nodes{ occurredAt commitCount } } }
  } } }`;
  const d = await gql(q, { login: LOGIN, after: null });
  const c = d.user.contributionsCollection;
  const days = c.contributionCalendar.weeks.flatMap(w => w.contributionDays).map(x => ({ date: x.date, count: x.contributionCount }));
  const pub = new Map();
  const add = (iso, n = 1) => { const k = iso.slice(0, 10); pub.set(k, (pub.get(k) || 0) + n); };
  for (const list of [c.repositoryContributions, c.issueContributions, c.pullRequestContributions, c.pullRequestReviewContributions])
    for (const n of list.nodes) add(n.occurredAt);
  for (const repo of c.commitContributionsByRepository) {
    let page = repo.contributions;
    for (;;) {
      for (const n of page.nodes) add(n.occurredAt, n.commitCount);
      if (!page.pageInfo.hasNextPage) break;
      // rare: a public repo with more than 100 active days in the window
      const more = await gql(q, { login: LOGIN, after: page.pageInfo.endCursor });
      const again = more.user.contributionsCollection.commitContributionsByRepository.find(r => r.repository.nameWithOwner === repo.repository.nameWithOwner);
      if (!again) break;
      page = again.contributions;
    }
  }
  const typed = c.totalCommitContributions + c.totalIssueContributions + c.totalPullRequestContributions + c.totalPullRequestReviewContributions + c.totalRepositoryContributions;
  return { source: 'graphql', days, total: c.contributionCalendar.totalContributions, restricted: c.restrictedContributionsCount, typedPublic: typed, pub, window: { startedAt: c.startedAt, endedAt: c.endedAt } };
}

// --- calendar, fallback: the logged-out fragment github.com itself renders.
async function fromHtml() {
  const r = await fetch(`https://github.com/users/${LOGIN}/contributions`, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`fragment ${r.status}`);
  const html = await r.text();
  const cells = [...html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"[^>]*id="([^"]+)"/g)].map(m => ({ date: m[1], id: m[2] }));
  const tips = new Map([...html.matchAll(/<tool-tip[^>]*for="([^"]+)"[^>]*>\s*(No|[\d,]+) contributions?/g)].map(m => [m[1], m[2] === 'No' ? 0 : Number(m[2].replace(/,/g, ''))]));
  const days = cells.map(c => ({ date: c.date, count: tips.get(c.id) ?? 0 })).sort((a, b) => a.date.localeCompare(b.date));
  if (days.length < 300) throw new Error(`fragment parsed only ${days.length} days`);
  // public series without a token: commit dates in public repos + repo creation dates
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
  return { source: 'html', days, total: days.reduce((s, d) => s + d.count, 0), restricted: null, typedPublic: null, pub, window: null };
}

async function previousPublished() {
  try {
    const r = await fetch(`https://raw.githubusercontent.com/${LOGIN}/${LOGIN}/output/profile.json`, { headers: { 'user-agent': UA } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function main() {
  let cal;
  try { cal = await fromGraphql(); }
  catch (e) { warn('graphql failed, using the public fragment:', e.message); cal = await fromHtml(); }

  const days = cal.days.map(d => ({ ...d, public: cal.pub.get(d.date) || 0 }));
  const total = cal.total;
  const daySum = days.reduce((s, d) => s + d.count, 0);
  if (daySum !== total) fail(`per-day counts sum to ${daySum} but the calendar total is ${total}`);
  const publicTotal = days.reduce((s, d) => s + d.public, 0);
  if (cal.typedPublic != null && cal.typedPublic !== publicTotal) warn(`typed public total ${cal.typedPublic} != per-day public sum ${publicTotal} (pagination or window edge)`);
  if (cal.restricted != null && cal.restricted + publicTotal !== total) warn(`restricted ${cal.restricted} + public ${publicTotal} != total ${total}; the reply uses restricted, the endpoints use the series`);
  const priv = cal.restricted ?? Math.max(0, total - publicTotal);

  // sanity floors: the only failure that matters is the private counts vanishing
  if (priv === 0 && total > 0) fail('restricted count is 0: private contributions are no longer visible to this token, refusing to publish a card that would lie');
  const prev = await previousPublished();
  if (prev && typeof prev.total === 'number' && total < prev.total * 0.5) fail(`total ${total} is less than half of the last published ${prev.total}; refusing to publish`);

  let streak = 0, best = 0, active = 0, busiest = { date: null, count: 0 };
  for (const d of days) {
    if (d.count > 0) { streak++; active++; best = Math.max(best, streak); } else streak = 0;
    if (d.count > busiest.count) busiest = { date: d.date, count: d.count };
  }
  const trailing14 = days.slice(-14).reduce((s, d) => s + d.count, 0);
  const out = {
    generated: new Date().toISOString(), login: LOGIN, source: cal.source, window: cal.window,
    total, private: priv, public: publicTotal, trailing14, active_days: active, days_in_window: days.length, best_streak: best, busiest,
    days,
  };
  mkdirSync('data', { recursive: true });
  writeFileSync('data/profile.json', JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify({ source: out.source, total, private: priv, public: publicTotal, days: days.length, last: days.at(-1).date, trailing14, active, best, busiest }));
}
main().catch(e => { console.error(e); process.exit(1); });
