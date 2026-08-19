/* ============================================================
   STEP 5 — the drip publisher.
   Moves N posts/day from content/queue -> content/published.
   Highest-opportunity posts (volume vs difficulty) go first.

     node scripts/05-publish-daily.mjs            # publish today's 5
     node scripts/05-publish-daily.mjs --seed 60  # launch batch
     node scripts/05-publish-daily.mjs --count 12 # custom
     node scripts/05-publish-daily.mjs --dry
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

/* Guard: only one drip per calendar day unless forced. */
const already = log.runs.filter((r) => r.date === today && r.kind === 'daily');
if (!seed && already.length && !argv.includes('--force')) {
  console.log(`⏭  Already published ${already[0].n} posts today (${today}). Use --force to override.`);
  process.exit(0);
}

const queued = fs.readdirSync(QUEUE).filter((f) => f.endsWith('.json'));
if (!queued.length) { console.log('Queue is empty — run `npm run pipeline` first.'); process.exit(0); }

/* Priority: search demand weighted against keyword difficulty,
   with a bonus for pages that already have a portrait + rich data. */
const scored = queued.map((f) => {
  const p = JSON.parse(fs.readFileSync(path.join(QUEUE, f), 'utf8'));
  const richness =
    (p.image ? 2 : 0) + (p.timeline?.length ? 1.5 : 0) + (p.faq?.length >= 6 ? 1 : 0) +
    (p.quickFacts?.length >= 10 ? 1 : 0) + (p.sections?.some((s) => s.works) ? 2 : 0);
  return { file: f, post: p, prio: (p.seo?.score || 0) + richness };
}).sort((a, b) => b.prio - a.prio);

const batch = scored.slice(0, count);
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
