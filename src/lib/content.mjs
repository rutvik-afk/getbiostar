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
let _related = null;
function buildRelated() {
  const posts = allPosts();
  const byCat = {};
  for (const p of posts) (byCat[p.category] ||= []).push(p);

  const score = (a, b) => {
    let sc = 0;
    if (a.category === b.category) sc += 3;
    if (a.nationality && a.nationality === b.nationality) sc += 3;
    sc += (a.occupations || []).filter((o) => (b.occupations || []).includes(o)).length * 2;
    sc += (a.teams || []).filter((t) => (b.teams || []).includes(t)).length * 4;
    if (a.birthPlace?.[0] && a.birthPlace[0] === b.birthPlace[0]) sc += 2;
    if (a.birthDate?.year && b.birthDate?.year && Math.abs(a.birthDate.year - b.birthDate.year) <= 4) sc += 1;
    return sc;
  };

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
let _demand = null;
export function byDemand(poolSize = 40) {
  _demand ||= [...allPosts()].sort((a, b) => (b.seo?.volume || 0) - (a.seo?.volume || 0));
  return _demand.slice(0, poolSize);
}

/** Stable per-page slice of the pool — same page always gets the same picks. */
export function demandPicks(seed, count, poolSize = 40) {
  const pool = byDemand(poolSize).filter((p) => p.slug !== seed);
  if (pool.length <= count) return pool;
  const start = hash(seed || 'home') % pool.length;
  return Array.from({ length: count }, (_, i) => pool[(start + i) % pool.length]);
}
