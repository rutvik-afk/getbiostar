/* ============================================================
   STEP 2b — filmography / discography / credited works.
   Reverse lookup via the Wikidata Query Service: every work that
   credits this person as cast member, performer, director,
   author or composer. This is what turns a thin stub into a
   page worth ranking.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { UA, chunk } from './lib/wiki.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const FACTS = path.join(ROOT, 'data/facts');
const OUT = path.join(ROOT, 'data/works.json');
const BATCH = Number(process.env.BATCH || 22);

const files = fs.readdirSync(FACTS).filter((f) => f.endsWith('.json'));
const people = files.map((f) => { const j = JSON.parse(fs.readFileSync(path.join(FACTS, f), 'utf8')); return { slug: j.slug, qid: j.qid }; }).filter((p) => p.qid);
console.log(`Enriching credited works for ${people.length} people (batch=${BATCH})…`);

const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const todo = people.filter((p) => !existing[p.slug]);
console.log(`  already cached: ${people.length - todo.length}; to fetch: ${todo.length}`);

const ROLE = {
  P161: 'cast member', P175: 'performer', P57: 'director', P50: 'author',
  P86: 'composer', P676: 'lyricist', P162: 'producer', P58: 'screenwriter',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildQuery(qids) {
  return `SELECT ?p ?prop ?workLabel ?date ?typeLabel WHERE {
  VALUES ?p { ${qids.map((q) => 'wd:' + q).join(' ')} }
  VALUES ?prop { ${Object.keys(ROLE).map((p) => 'wdt:' + p).join(' ')} }
  ?work ?prop ?p .
  OPTIONAL { ?work wdt:P577 ?date }
  OPTIONAL { ?work wdt:P31 ?type }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 4000`;
}

async function runQuery(qids, tries = 3) {
  const body = new URLSearchParams({ query: buildQuery(qids) });
  for (let t = 0; t < tries; t++) {
    try {
      const res = await fetch('https://query.wikidata.org/sparql', {
        method: 'POST', body,
        headers: { 'User-Agent': UA, 'Accept': 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return (await res.json())?.results?.bindings || [];
    } catch (e) {
      if (t === tries - 1) { console.warn(`   ! batch failed (${e.message}) — skipping`); return []; }
      await sleep(2500 * (t + 1));
    }
  }
  return [];
}

const byQid = Object.fromEntries(people.map((p) => [p.qid, p.slug]));
const groups = chunk(todo.map((p) => p.qid), BATCH);
let n = 0;

for (const g of groups) {
  const rows = await runQuery(g);
  const acc = {};
  for (const r of rows) {
    const qid = r.p.value.split('/').pop();
    const slug = byQid[qid];
    if (!slug) continue;
    const title = r.workLabel?.value || '';
    if (!title || /^Q\d+$/.test(title)) continue;             // no English label → skip
    const year = r.date?.value ? Number(r.date.value.slice(0, 4)) : null;
    const type = (r.typeLabel?.value || '').toLowerCase();
    const pid = r.prop.value.split('/').pop();
    (acc[slug] ||= []).push({ title, year, type, role: ROLE[pid] || 'credited' });
  }
  for (const qid of g) {
    const slug = byQid[qid];
    if (!slug) continue;
    const seen = new Set();
    existing[slug] = (acc[slug] || [])
      .filter((w) => { const k = w.title + '|' + w.year; return seen.has(k) ? false : seen.add(k); })
      .sort((a, b) => (b.year || 0) - (a.year || 0))
      .slice(0, 60);
  }
  n += g.length;
  fs.writeFileSync(OUT, JSON.stringify(existing));
  process.stdout.write(`  ${n}/${todo.length} people, ${Object.values(existing).reduce((s, a) => s + a.length, 0)} credits\r`);
  await sleep(700);
}

const withWorks = Object.values(existing).filter((a) => a.length).length;
console.log(`\n✅ works cached for ${Object.keys(existing).length} people; ${withWorks} have credits → data/works.json`);
