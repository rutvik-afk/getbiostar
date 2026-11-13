/* Reads published posts off disk at build time. */
import fs from 'node:fs';
import path from 'node:path';
import { CATEGORIES, categoryOf, hash } from './bio.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const PUB = path.join(ROOT, 'content', 'published');

let _cache = null;
export function allPosts() {
  if (_cache) return _cache;
  if (!fs.existsSync(PUB)) return (_cache = []);
  const posts = fs.readdirSync(PUB)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(PUB, f), 'utf8')))
    .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || '') || (b.seo?.volume || 0) - (a.seo?.volume || 0));
  _cache = posts;
  return posts;
}

export const getPost = (slug) => allPosts().find((p) => p.slug === slug) || null;

export function postsByCategory() {
  const m = {};
  for (const p of allPosts()) (m[p.category] ||= []).push(p);
  return m;
}

export function paginate(items, perPage) {
  const pages = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  return pages.length ? pages : [[]];
}

/* Related links are computed over PUBLISHED posts only, at build time.
   Computing them at generation time would point live pages at slugs that
   are still sitting in the queue — 3000 broken internal links. */
function similarity(a, b) {
  let sc = 0;
  if (a.category === b.category) sc += 3;
  if (a.nationality && a.nationality === b.nationality) sc += 3;
  sc += (a.occupations || []).filter((o) => (b.occupations || []).includes(o)).length * 2;
  sc += (a.teams || []).filter((t) => (b.teams || []).includes(t)).length * 4;
  if (a.birthPlace?.[0] && a.birthPlace[0] === b.birthPlace[0]) sc += 2;
  if (a.birthDate?.year && b.birthDate?.year && Math.abs(a.birthDate.year - b.birthDate.year) <= 4) sc += 1;
  return sc;
}

let _related = null;
function buildRelated() {
  const posts = allPosts();
  const byCat = {};
  for (const p of posts) (byCat[p.category] ||= []).push(p);

  const score = similarity;

  const map = {};
  for (const p of posts) {
    const pool = (byCat[p.category] || []).filter((x) => x.slug !== p.slug);
    const rest = posts.filter((x) => x.slug !== p.slug && x.category !== p.category).slice(0, 200);
    map[p.slug] = [...pool, ...rest]
      .map((x) => ({ x, sc: score(p, x) }))
      .sort((a, b) => b.sc - a.sc || (b.x.seo?.volume || 0) - (a.x.seo?.volume || 0))
      .slice(0, 8)
      .map(({ x }) => ({ slug: x.slug, name: x.name, role: x.role, image: x.image?.url || null }));
  }
  return map;
}
export function relatedFor(slug) {
  if (!_related) _related = buildRelated();
  return _related[slug] || [];
}

/* Pages Google has not shown yet, linked from pages it has.

   Google finds a page by following a link from one it already visits, and
   visits a page more often the more it is worth. A profile with no
   impression ten days after it went live is one nothing links to strongly
   enough: the sidebar's "recent" list holds a page for about a day, and the
   "related" grid ranks by similarity, so a low-scoring page is almost never
   in anyone's top eight. On 13 Nov that was 86 of 453 live pages; Search
   Console called 93 "Discovered - currently not indexed", meaning Google
   knew the URL and had not got round to fetching it.

   data/gsc-pages.json (scripts/11-import-gsc.mjs) says which pages have an
   impression. Targets are live pages older than ten days with none; hosts are
   pages with at least HOST_MIN_IMPRESSIONS, i.e. ones Google demonstrably
   indexes and shows. Each host links to UNSEEN_PER_HOST targets, chosen by
   similarity (an actor page pointing at actors) and then by how few links
   the target has so far, so the links spread instead of piling onto the
   three most similar names. The result is deterministic for a given export.

   Without the file this returns nothing, so a fresh clone still builds. */
const GSC_FILE = path.join(ROOT, 'data', 'gsc-pages.json');
const HOST_MIN_IMPRESSIONS = 50;
const UNSEEN_PER_HOST = 4;
const UNSEEN_GRACE_DAYS = 10;

let _unseen = null;
function buildUnseen() {
  if (!fs.existsSync(GSC_FILE)) return { map: {}, targets: [], hosts: 0 };
  const g = JSON.parse(fs.readFileSync(GSC_FILE, 'utf8'));
  const seen = new Map(g.pages.map((p) => [p.slug, p]));
  const cutoff = new Date(g.windowEnd + 'T00:00:00Z');
  cutoff.setUTCDate(cutoff.getUTCDate() - UNSEEN_GRACE_DAYS);
  const cut = cutoff.toISOString().slice(0, 10);

  const posts = allPosts();
  const targets = posts.filter((p) => (p.publishedAt || '') <= cut && !((seen.get(p.slug)?.impressions || 0) > 0));
  const hosts = posts
    .filter((p) => (seen.get(p.slug)?.impressions || 0) >= HOST_MIN_IMPRESSIONS)
    .sort((a, b) => seen.get(b.slug).impressions - seen.get(a.slug).impressions || a.slug.localeCompare(b.slug));
  if (!targets.length || !hosts.length) return { map: {}, targets, hosts: hosts.length };

  const cap = Math.ceil((hosts.length * UNSEEN_PER_HOST) / targets.length) + 2;
  const inbound = {};
  const map = {};
  for (const h of hosts) {
    const already = new Set(relatedFor(h.slug).map((r) => r.slug));
    const picks = targets
      .filter((t) => t.slug !== h.slug && !already.has(t.slug) && (inbound[t.slug] || 0) < cap)
      .map((t) => ({ t, sc: similarity(h, t), n: inbound[t.slug] || 0 }))
      .sort((a, b) => b.sc - a.sc || a.n - b.n || (b.t.seo?.volume || 0) - (a.t.seo?.volume || 0) || a.t.slug.localeCompare(b.t.slug))
      .slice(0, UNSEEN_PER_HOST);
    for (const { t } of picks) inbound[t.slug] = (inbound[t.slug] || 0) + 1;
    map[h.slug] = picks.map(({ t }) => ({ slug: t.slug, name: t.name, role: t.role, image: t.image?.url || null }));
  }
  return { map, targets, hosts: hosts.length, inbound };
}
export function unseenFor(slug) {
  if (!_unseen) _unseen = buildUnseen();
  return _unseen.map[slug] || [];
}
export function unseenStats() {
  if (!_unseen) _unseen = buildUnseen();
  return { targets: _unseen.targets.length, hosts: _unseen.hosts, inbound: _unseen.inbound || {} };
}

export function letterIndex() {
  const m = {};
  for (const p of allPosts()) {
    const c = (p.name[0] || '#').toUpperCase();
    (m[/[A-Z]/.test(c) ? c : '#'] ||= []).push(p);
  }
  return m;
}
export { CATEGORIES, categoryOf };

/* Sitewide widgets used to show the same five highest-volume profiles on
   every page, which handed Virat Kohli and four others 313 internal
   links each while Sara Arjun (1.78M searches a month), Smriti Mandhana
   (1.71M) and B. R. Ambedkar (1.46M) got 30, 11 and 6.

   With roughly twenty external backlinks, the links this site gives
   itself are most of the authority it has to hand out, and piling it on
   five pages that already rank is the least useful place to put it.
   Picking from a wider pool, deterministically per page, spreads it
   across the profiles that could plausibly win traffic and stops every
   page carrying an identical "Most Searched" list. */
/* The pool was ordered by Semrush's estimated volume. Search Console
   says the opportunity is somewhere else: Manju Warrier draws 11,132
   impressions at position 7.7 and had 5 internal links, while Kajal
   Aggarwal had 130 and Rashmika Mandanna 118 because their estimated
   volume is higher. Position 3-5 earns this site 1.05% against 0.079%
   at 9-11, so a page already sitting at 7-10 with real impressions is
   worth far more link equity than a high-volume page that is not
   ranking at all.

   data/striking-distance.json is an export, not a live feed — refresh
   it from Search Console rather than editing it. When it is missing the
   pool falls back to estimated volume, which is what it did before. */
let _strike = null;
function strikingDistance() {
  if (_strike) return _strike;
  try {
    const f = path.join(ROOT, 'data', 'striking-distance.json');
    const order = JSON.parse(fs.readFileSync(f, 'utf8')).pages
      .map((p, i) => [p.slug, i]);
    _strike = new Map(order);
  } catch { _strike = new Map(); }
  return _strike;
}

let _demand = null;
export function byDemand(poolSize = 85) {
  if (!_demand) {
    const strike = strikingDistance();
    _demand = [...allPosts()].sort((a, b) => {
      const sa = strike.has(a.slug) ? strike.get(a.slug) : Infinity;
      const sb = strike.has(b.slug) ? strike.get(b.slug) : Infinity;
      if (sa !== sb) return sa - sb;                       // measured first, by impressions
      return (b.seo?.volume || 0) - (a.seo?.volume || 0);  // then estimated
    });
  }
  return _demand.slice(0, poolSize);
}

/** Stable per-page slice of the pool — same page always gets the same picks. */
export function demandPicks(seed, count, poolSize = 85) {
  const pool = byDemand(poolSize).filter((p) => p.slug !== seed);
  if (pool.length <= count) return pool;
  const start = hash(seed || 'home') % pool.length;
  return Array.from({ length: count }, (_, i) => pool[(start + i) % pool.length]);
}

/* Actors who have also held elected or appointed office.

   Matched positively, not by excluding honorifics: Wikidata files
   "UNICEF Goodwill Ambassador" in positionsHeld exactly as it files a
   seat in the Rajya Sabha, so a blocklist would have put Shah Rukh Khan,
   Aamir Khan and Priyanka Chopra on a page about politicians.

   Lives here rather than in the component because offices are on the
   facts record, and an Astro component cannot use import.meta.dirname
   to reach it. */
const POLITICAL_OFFICE = new RegExp(
  '\\b(lok sabha|rajya sabha|legislative assembly|legislative council|chief minister'
  + '|minister|governor|president|prime minister|mayor|member of parliament|senator'
  + '|representative|municipal)\\b', 'i');
const FACTS = path.join(ROOT, 'data', 'facts');

let _actorPoliticians = null;
export function actorPoliticians() {
  if (_actorPoliticians) return _actorPoliticians;
  const out = [];
  for (const p of allPosts()) {
    if (p.category !== 'actor') continue;
    let f;
    try { f = JSON.parse(fs.readFileSync(path.join(FACTS, `${p.slug}.json`), 'utf8')); } catch { continue; }
    const offices = (f.positionsHeld || []).filter((x) => POLITICAL_OFFICE.test(x.name));
    if (!offices.length) continue;
    const years = offices.map((o) => o.q?.from?.year).filter(Boolean).sort((a, b) => a - b);
    out.push({
      post: p,
      offices: offices.map((o) => ({ name: o.name, from: o.q?.from?.year || null, to: o.q?.to?.year || null })),
      firstYear: years[0] || null,
    });
  }
  out.sort((a, b) => (b.post.seo?.volume || 0) - (a.post.seo?.volume || 0));
  _actorPoliticians = out;
  return out;
}
