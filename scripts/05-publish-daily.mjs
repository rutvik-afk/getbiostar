/* ============================================================
   STEP 5 — the drip publisher.
   Moves N posts/day from content/queue -> content/published.
   Highest-opportunity posts (volume vs difficulty) go first.

     node scripts/05-publish-daily.mjs            # publish this run's share
     node scripts/05-publish-daily.mjs --count 1   # publish exactly 1 (used by the 4x/day cron)
     node scripts/05-publish-daily.mjs --seed 60   # launch batch
     node scripts/05-publish-daily.mjs --dry

   Runs multiple times a day (see .github/workflows/daily.yml, 4 fixed
   IST times). Each run publishes --count posts, but the total across
   all of today's runs never exceeds SITE.postsPerDay.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { SITE } from '../site.config.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const QUEUE = path.join(ROOT, 'content/queue');
const PUB = path.join(ROOT, 'content/published');
const LOG = path.join(ROOT, 'content/publish-log.json');
fs.mkdirSync(PUB, { recursive: true });

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i === -1 ? d : Number(argv[i + 1] ?? d); };
const dry = argv.includes('--dry');
const seed = flag('seed', 0);
const count = seed || flag('count', SITE.postsPerDay);

const today = new Date().toISOString().slice(0, 10);
const log = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : { runs: [], published: {} };

/* Guard: today's runs together never exceed SITE.postsPerDay, however many
   times this script fires (the 4x/day cron each publishing a slice). */
const publishedToday = log.runs
  .filter((r) => r.date === today && r.kind === 'daily')
  .reduce((sum, r) => sum + r.n, 0);
if (!seed) {
  const remaining = Math.max(0, SITE.postsPerDay - publishedToday);
  if (remaining <= 0 && !argv.includes('--force')) {
    console.log(`⏭  Today's quota already met (${publishedToday}/${SITE.postsPerDay} published). Use --force to override.`);
    process.exit(0);
  }
  if (count > remaining && !argv.includes('--force')) {
    console.log(`  (capping this run to ${remaining} — ${publishedToday}/${SITE.postsPerDay} already published today)`);
  }
}

const queued = fs.readdirSync(QUEUE).filter((f) => f.endsWith('.json'));
if (!queued.length) { console.log('Queue is empty — run `npm run pipeline` first.'); process.exit(0); }

/* Priority: search demand weighted against keyword difficulty, with page
   richness as a tiebreaker.

   Richness used to be added raw, which quietly made it the dominant term:
   seo.score spans ~4-9 because demand enters as log10(volume), so 1.1M
   searches sits barely half a point above 240K, while richness swings a
   full 0-7.5. Kavya Maran — 1.1M/mo — was ranked 1,256th, ~10 months out,
   purely for having a thinner Wikidata record. Scaling richness to 0.3
   keeps it deciding ties without outvoting demand, and a floor drops the
   truly bare records (a portrait and nothing else) instead of letting a
   high score drag them onto the site. */
const richnessOf = (p) =>
  (p.image ? 2 : 0) + (p.timeline?.length ? 1.5 : 0) + (p.faq?.length >= 6 ? 1 : 0) +
  (p.quickFacts?.length >= 10 ? 1 : 0) + (p.sections?.some((s) => s.works) ? 2 : 0);

const all = queued.map((f) => {
  const p = JSON.parse(fs.readFileSync(path.join(QUEUE, f), 'utf8'));
  const richness = richnessOf(p);
  return { file: f, post: p, richness, prio: (p.seo?.score || 0) + richness * 0.3 };
});
const publishable = all.filter((x) => x.richness > 2);
const scored = (publishable.length ? publishable : all).sort((a, b) => b.prio - a.prio);

const effectiveCount = seed || argv.includes('--force')
  ? count
  : Math.min(count, Math.max(0, SITE.postsPerDay - publishedToday));
const batch = scored.slice(0, effectiveCount);
console.log(`${dry ? '[dry run] ' : ''}Publishing ${batch.length} of ${scored.length} queued posts…`);

let n = 0;
for (const { file, post } of batch) {
  post.publishedAt = today;
  post.updatedAt = today;
  if (!dry) {
    fs.writeFileSync(path.join(PUB, file), JSON.stringify(post));
    fs.unlinkSync(path.join(QUEUE, file));
    log.published[post.slug] = today;
  }
  n++;
  console.log(`  ${String(n).padStart(3)}. ${post.name.padEnd(30)} vol=${String(post.seo?.volume ?? 0).padStart(8)}  kd=${post.seo?.kd ?? '?'}`);
}

if (!dry) {
  log.runs.push({ date: today, kind: seed ? 'seed' : 'daily', n });
  fs.writeFileSync(LOG, JSON.stringify(log, null, 1));
}

const left = scored.length - n;
console.log(`\n✅ Published ${n}. Live total: ${fs.readdirSync(PUB).length}. Queue remaining: ${left}`);
console.log(`   At ${SITE.postsPerDay}/day that queue lasts ~${Math.ceil(left / SITE.postsPerDay)} days.`);
