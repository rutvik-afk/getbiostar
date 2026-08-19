/* ============================================================
   STEP 1 — Semrush CSV  ->  ranked target list (targets.json)
   Filters out adult / sexualised / body-measurement keywords,
   scores every celebrity by "easy-to-rank" potential.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const ROOT = path.resolve(import.meta.dirname, '..');
const CSV_DIR = path.resolve(ROOT, '..');
const OUT = path.join(ROOT, 'data', 'targets.json');
const LIMIT = Number(process.env.TARGET_LIMIT || 3000);

/* --- Safety filters: aa keywords / people site par nahi aavse --- */
const BAD_KW = /(porn|pornstar|xxx|nude|naked|sex\b|sexy|bra size|boob|breast|bikini|cleavage|thigh|mms|leaked|bathing|figure size|measurement|hot photo|bp video|kiss scene|erotic|onlyfans|escort|hot pics)/i;
const BAD_SLUG = /(porn|xxx|onlyfans|escort)/i;
/* Known adult-industry entities — AdSense safety */
const BLOCK_SLUGS = new Set([
  'lana-rhoades','johnny-sins','mia-khalifa','sunny-leone','riley-reid','abella-danger',
  'angela-white','eva-elfie','dani-daniels','sasha-grey','jordi-el-nino-polla','kendra-lust',
  'brandi-love','lisa-ann','mia-malkova','elly-clutch','jia-lissa','danny-d','rocco-siffredi',
]);

function parseCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const entities = new Map();

async function ingest(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  let header = null, n = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    if (!header) { header = cols.map((c) => c.replace(/^﻿/, '').trim()); continue; }
    const r = Object.fromEntries(header.map((h, i) => [h, cols[i] ?? '']));
    const url = r['URL'] || '';
    const kw = (r['Keyword'] || '').trim();
    const m = url.match(/^https?:\/\/[^/]+\/([^/?#]+)\/?$/);
    if (!m || !kw) continue;
    const slug = m[1].toLowerCase();
    if (['category', 'tag', 'author', 'page', 'about', 'contact'].includes(slug)) continue;
    if (BAD_SLUG.test(slug) || BLOCK_SLUGS.has(slug)) continue;
    if (BAD_KW.test(kw)) continue;

    const vol = Number(r['Search Volume'] || 0) || 0;
    const kd = Number(r['Keyword Difficulty'] || 0) || 0;
    const pos = Number(r['Position'] || 100) || 100;

    let e = entities.get(slug);
    if (!e) { e = { slug, volume: 0, kws: [], kdSum: 0, kdN: 0, bestPos: 999 }; entities.set(slug, e); }
    e.volume += vol;
    e.kdSum += kd; e.kdN++;
    e.bestPos = Math.min(e.bestPos, pos);
    e.kws.push({ kw, vol, kd });
    n++;
  }
  console.log(`  ${path.basename(file)} → ${n} usable rows`);
}

/* “Easy to rank” score:
   demand (log volume) rewarded, difficulty punished, existing SERP
   proof (someone already ranks page-1 for it) rewarded.            */
function score(e) {
  const kd = e.kdN ? e.kdSum / e.kdN : 50;
  const demand = Math.log10(e.volume + 10);
  const ease = Math.max(0, (100 - kd) / 100);
  const proof = e.bestPos <= 3 ? 1.25 : e.bestPos <= 10 ? 1.1 : 1;
  return demand * (0.35 + 1.15 * ease) * proof;
}

/* Name from slug: "virat-kohli" -> "Virat Kohli" (respects known particles) */
const LOWER = new Set(['de', 'van', 'der', 'da', 'di', 'del', 'la', 'bin', 'al']);
function titleFromSlug(slug) {
  return slug.split('-').filter(Boolean).map((w, i) => {
    if (i > 0 && LOWER.has(w)) return w;
    if (w.length <= 2 && /^[a-z]+$/.test(w)) return w.toUpperCase();
    return w[0].toUpperCase() + w.slice(1);
  }).join(' ');
}

const files = fs.readdirSync(CSV_DIR)
  .filter((f) => f.toLowerCase().endsWith('.csv') && /starsunfolded/i.test(f))
  .map((f) => path.join(CSV_DIR, f));

if (!files.length) { console.error('No starsunfolded CSV found in', CSV_DIR); process.exit(1); }
console.log('Reading CSVs:');
for (const f of files) await ingest(f);

const all = [...entities.values()]
  .filter((e) => e.volume >= 100 && /^[a-z0-9-]+$/.test(e.slug) && e.slug.split('-').length <= 5)
  .map((e) => {
    e.kws.sort((a, b) => b.vol - a.vol);
    const seen = new Set();
    e.kws = e.kws.filter((k) => (seen.has(k.kw) ? false : seen.add(k.kw)));
    return {
      slug: e.slug,
      name: titleFromSlug(e.slug),
      volume: e.volume,
      kd: Math.round((e.kdN ? e.kdSum / e.kdN : 50) * 10) / 10,
      bestPos: e.bestPos,
      score: Math.round(score(e) * 1000) / 1000,
      keywords: e.kws.slice(0, 25),
    };
  })
  .sort((a, b) => b.score - a.score)
  .slice(0, LIMIT);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(all, null, 1));
console.log(`\n✅ ${all.length} targets → data/targets.json`);
console.log(`   total monthly volume: ${all.reduce((s, x) => s + x.volume, 0).toLocaleString()}`);
console.log(`   avg KD: ${(all.reduce((s, x) => s + x.kd, 0) / all.length).toFixed(1)}`);
console.log('\n   Top 10:');
all.slice(0, 10).forEach((t, i) => console.log(`   ${String(i + 1).padStart(2)}. ${t.name.padEnd(26)} vol=${String(t.volume).padStart(8)} kd=${t.kd}`));
