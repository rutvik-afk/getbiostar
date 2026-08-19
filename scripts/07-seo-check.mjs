/* ============================================================
   STEP 7 — SEO check on the BUILT output (dist/).
   Run after `npm run build`; fails loudly on regressions.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
if (!fs.existsSync(DIST)) { console.error('No dist/ — run `npm run build` first.'); process.exit(1); }

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : e.name === 'index.html' ? [p] : [];
});
const pages = walk(DIST);
const rel = (f) => f.slice(DIST.length).replace(/index\.html$/, '') || '/';

const issues = [];
const warnings = [];
const titles = new Map(), descs = new Map();
let noindex = 0;

for (const f of pages) {
  const h = fs.readFileSync(f, 'utf8');
  const u = rel(f);
  if (/<meta name="robots" content="noindex/.test(h)) { noindex++; continue; }

  const title = h.match(/<title>(.*?)<\/title>/s)?.[1];
  const desc = h.match(/<meta name="description" content="(.*?)"/s)?.[1];
  const canon = h.match(/<link rel="canonical" href="(.*?)"/)?.[1];
  const h1s = h.match(/<h1[\s>]/g)?.length || 0;
  const ld = h.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)?.[1];
  const imgs = h.match(/<img\b[^>]*>/g) || [];

  if (!title) issues.push([u, 'missing <title>']);
  else { titles.set(title, [...(titles.get(title) || []), u]); if (title.length > 70) issues.push([u, `title ${title.length} chars (>70)`]); }

  if (!desc) issues.push([u, 'missing meta description']);
  else { descs.set(desc, [...(descs.get(desc) || []), u]); if (desc.length > 165) issues.push([u, `description ${desc.length} chars (>165)`]); }

  if (!canon) issues.push([u, 'missing canonical']);
  if (h1s !== 1) issues.push([u, `${h1s} <h1> tags (need exactly 1)`]);
  if (!ld) issues.push([u, 'no JSON-LD']);
  else { try { JSON.parse(ld); } catch { issues.push([u, 'invalid JSON-LD']); } }

  const noAlt = imgs.filter((t) => !/\balt=/.test(t)).length;
  if (noAlt) issues.push([u, `${noAlt} image(s) without alt`]);
  /* Mixed content only matters for RESOURCES the page loads. An outbound
     link to an http-only site is untidy, not a ranking or security fault —
     and rewriting it to https would break sites that never migrated. */
  if (/(?:src|srcset)="http:\/\//.test(h)) issues.push([u, 'insecure http:// RESOURCE (mixed content)']);
  const httpLinks = (h.match(/href="http:\/\/[^"]+"/g) || []).length;
  if (httpLinks) warnings.push([u, `${httpLinks} outbound http:// link(s) — from source records`]);
}

for (const [t, us] of titles) if (us.length > 1) issues.push([us.join(', '), `duplicate title: "${t.slice(0, 50)}…"`]);
for (const [, us] of descs) if (us.length > 1) issues.push([us.join(', '), 'duplicate meta description']);

for (const f of ['robots.txt', 'sitemap-index.xml', 'rss.xml']) {
  if (!fs.existsSync(path.join(DIST, f))) issues.push(['/', `missing ${f}`]);
}
const smFiles = fs.readdirSync(DIST).filter((f) => /^sitemap-\d+\.xml$/.test(f));
const urls = smFiles.reduce((n, f) => n + (fs.readFileSync(path.join(DIST, f), 'utf8').match(/<loc>/g) || []).length, 0);
const js = fs.existsSync(path.join(DIST, '_astro'))
  ? fs.readdirSync(path.join(DIST, '_astro')).filter((f) => f.endsWith('.js')).length : 0;

console.log(`Indexable pages : ${pages.length - noindex}  (+${noindex} deliberately noindexed)`);
console.log(`Sitemap URLs    : ${urls}`);
console.log(`JS bundles      : ${js} ${js === 0 ? '(zero — ideal for Core Web Vitals)' : ''}`);
console.log(`Issues          : ${issues.length}`);
for (const [where, what] of issues.slice(0, 25)) console.log(`   ✗ ${where}  →  ${what}`);
if (warnings.length) {
  console.log(`Warnings        : ${warnings.length} (cosmetic, safe to ignore)`);
  for (const [where, what] of warnings.slice(0, 4)) console.log(`   · ${where}  →  ${what}`);
  if (warnings.length > 4) console.log(`   · …and ${warnings.length - 4} more`);
}
if (!issues.length) console.log('\n✅ No SEO problems found.');
process.exit(issues.length ? 1 : 0);
