/* ============================================================
   STEP 2 — targets.json -> data/facts/<slug>.json
   Pulls STRUCTURED FACTS from Wikidata (facts are not
   copyrightable) + free-licensed portraits from Commons.
   No article prose is copied anywhere.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { titlesToQids, searchTitle, getEntities, getLabels, commonsLicenses, chunk } from './lib/wiki.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const targets = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/targets.json'), 'utf8'));
const OUTDIR = path.join(ROOT, 'data/facts');
fs.mkdirSync(OUTDIR, { recursive: true });

const START = Number(process.env.START || 0);
const COUNT = Number(process.env.COUNT || targets.length);
const slice = targets.slice(START, START + COUNT);

/* ---------- property map ---------- */
const P = {
  P31: 'instanceOf', P21: 'gender', P569: 'birthDate', P570: 'deathDate',
  P19: 'birthPlace', P20: 'deathPlace', P27: 'citizenship', P106: 'occupations',
  P26: 'spouses', P22: 'father', P25: 'mother', P40: 'children', P3373: 'siblings',
  P69: 'education', P166: 'awards', P2048: 'heightCm', P1477: 'birthName',
  P1303: 'instruments', P413: 'playingPosition', P54: 'teams', P800: 'notableWorks',
  P856: 'website', P2002: 'twitter', P2003: 'instagram', P2013: 'facebook',
  P2397: 'youtube', P18: 'imageFile', P1412: 'languages', P551: 'residence',
  P39: 'positionsHeld', P102: 'party', P641: 'sports', P937: 'workLocation',
  P1344: 'participatedIn', P108: 'employer', P463: 'memberOf', P734: 'familyName',
  P735: 'givenName', P6886: 'writingLanguage', P264: 'label', P2067: 'massKg',
};
const QUALS = { P580: 'from', P582: 'to', P585: 'date', P805: 'of', P1686: 'for', P642: 'of' };

function timeVal(dv) {
  if (!dv?.time) return null;
  const m = dv.time.match(/^([+-])(\d{4,})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, sign, y, mo, d] = m;
  const prec = dv.precision ?? 11;
  const year = (sign === '-' ? -1 : 1) * Number(y);
  return {
    year,
    month: prec >= 10 && mo !== '00' ? Number(mo) : null,
    day: prec >= 11 && d !== '00' ? Number(d) : null,
    precision: prec,
    bce: sign === '-',
  };
}

function readClaim(c) {
  const sn = c.mainsnak;
  if (!sn || sn.snaktype !== 'value') return null;
  const dv = sn.datavalue;
  let value = null, ref = null;
  switch (dv.type) {
    case 'wikibase-entityid': ref = dv.value.id; value = { qid: ref }; break;
    case 'time': value = timeVal(dv.value); break;
    case 'quantity': value = { amount: Number(dv.value.amount), unit: (dv.value.unit || '').replace(/^.*\//, '') }; break;
    case 'string': value = dv.value; break;
    case 'monolingualtext': value = dv.value.text; break;
    case 'globecoordinate': value = { lat: dv.value.latitude, lon: dv.value.longitude }; break;
    default: return null;
  }
  if (value == null) return null;
  const q = {};
  for (const [pid, name] of Object.entries(QUALS)) {
    const arr = c.qualifiers?.[pid];
    if (!arr?.length) continue;
    const s = arr[0];
    if (s.snaktype !== 'value') continue;
    if (s.datavalue.type === 'time') q[name] = timeVal(s.datavalue.value);
    else if (s.datavalue.type === 'wikibase-entityid') q[name] = { qid: s.datavalue.value.id };
    else q[name] = s.datavalue.value;
  }
  return { value, q: Object.keys(q).length ? q : undefined, rank: c.rank, _ref: ref, _refq: Object.values(q).filter((v) => v?.qid).map((v) => v.qid) };
}

/* ---------- name-match guard ----------
   Wikipedia's search endpoint happily returns a *related* person when
   the one we asked for has no article ("Sara Tendulkar" -> Arjun
   Tendulkar). Publishing that bio under the wrong URL is worse than
   publishing nothing, so every match has to survive this check.      */
const TITLES = new Set(['major','captain','colonel','lt','general','dr','doctor','sir','shri','smt','mr','mrs','ms','prof','professor','ips','ias','justice','sant','swami','pandit','ustad','md','er','adv','late','the','of']);

function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 3;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

const tokens = (str) => String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .split(/[^a-z0-9]+/).filter((t) => t && !TITLES.has(t));

/** Does `candidate` (a Wikidata label/alias) plausibly name the person the slug asks for? */
function nameMatches(slug, candidate, aliases = []) {
  const want = tokens(slug);
  if (!want.length) return false;
  const pools = [candidate, ...aliases].map(tokens).filter((t) => t.length);
  return pools.some((have) => {
    // every meaningful slug token must appear in the candidate name
    return want.every((w) => have.some((h) => {
      if (h === w) return true;
      if (w.length >= 4 && h.length >= 4 && editDistance(w, h) <= 1) return true;  // Pandey/Panday
      if (w.length <= 2 && h.startsWith(w)) return true;                            // initials: "b r ambedkar"
      if (w.length >= 5 && (h.startsWith(w) || w.startsWith(h))) return true;        // Krishnan/Krishna
      return false;
    }));
  });
}

/* ---------- 1. resolve names -> QIDs ---------- */
console.log(`Resolving ${slice.length} names to Wikidata entities…`);
const titleGuess = slice.map((t) => t.name);
let map = await titlesToQids(titleGuess);
const missing = slice.filter((t) => !map[t.name]);
console.log(`  direct hits: ${Object.keys(map).length} / ${slice.length}; searching ${missing.length} fallbacks…`);

let done = 0;
for (const grp of chunk(missing, 8)) {
  await Promise.all(grp.map(async (t) => {
    try {
      const found = await searchTitle(t.name);
      if (found) t._searchTitle = found;
    } catch {}
  }));
  done += grp.length;
  if (done % 200 === 0) process.stdout.write(`  …${done}/${missing.length}\r`);
}
const extra = missing.filter((t) => t._searchTitle).map((t) => t._searchTitle);
const map2 = await titlesToQids(extra);
for (const t of missing) if (t._searchTitle && map2[t._searchTitle]) map[t.name] = map2[t._searchTitle];

const resolved = slice.filter((t) => map[t.name]);
console.log(`\n  resolved: ${resolved.length}/${slice.length}`);

/* ---------- 2. pull entities ---------- */
console.log('Fetching Wikidata entities…');
const ents = await getEntities(resolved.map((t) => map[t.name].qid));

/* ---------- 3. extract + collect referenced QIDs ---------- */
const refQids = new Set();
const rawByslug = {};
for (const t of resolved) {
  const qid = map[t.name].qid;
  const e = ents[qid];
  if (!e) continue;
  const isHuman = (e.claims?.P31 || []).some((c) => c.mainsnak?.datavalue?.value?.id === 'Q5');
  const out = { qid, isHuman, wikipedia: e.sitelinks?.enwiki?.url || null, label: e.labels?.en?.value || t.name, description: e.descriptions?.en?.value || '', aliases: (e.aliases?.en || []).map((a) => a.value).slice(0, 6), props: {} };
  for (const [pid, key] of Object.entries(P)) {
    const claims = e.claims?.[pid];
    if (!claims?.length) continue;
    const vals = claims.map(readClaim).filter(Boolean).filter((v) => v.rank !== 'deprecated');
    if (!vals.length) continue;
    const pref = vals.filter((v) => v.rank === 'preferred');
    const use = (pref.length ? pref : vals).slice(0, 12);
    for (const v of use) { if (v._ref) refQids.add(v._ref); (v._refq || []).forEach((q) => refQids.add(q)); delete v._ref; delete v._refq; }
    out.props[key] = use;
  }
  rawByslug[t.slug] = out;
}
console.log(`  entities parsed: ${Object.keys(rawByslug).length}, referenced QIDs: ${refQids.size}`);

/* ---------- 4. resolve referenced QIDs -> labels ---------- */
console.log('Resolving referenced entity labels…');
const labels = await getLabels([...refQids]);
console.log(`  labels: ${Object.keys(labels).length}`);

/* ---------- 5. Commons portraits (free licences only) ---------- */
const imgFiles = Object.values(rawByslug).map((r) => r.props.imageFile?.[0]?.value).filter((v) => typeof v === 'string');
console.log(`Fetching Commons licence metadata for ${imgFiles.length} portraits…`);
const licenses = await commonsLicenses(imgFiles);
console.log(`  free-licensed & usable: ${Object.keys(licenses).length}`);

/* ---------- 6. write facts files ---------- */
let written = 0, skipped = 0;
const rejected = [];
for (const t of slice) {
  const r = rawByslug[t.slug];
  if (!r || !r.isHuman) { skipped++; continue; }
  if (!nameMatches(t.slug, r.label, r.aliases)) {
    rejected.push({ slug: t.slug, got: r.label, desc: r.description });
    continue;
  }
  const L = (v) => (v?.qid ? labels[v.qid] || null : v);
  const listOf = (key, max = 8) => (r.props[key] || []).map((c) => ({ name: L(c.value), ...(c.q ? { q: Object.fromEntries(Object.entries(c.q).map(([k, v]) => [k, v?.qid ? labels[v.qid] || null : v])) } : {}) })).filter((x) => x.name).slice(0, max);
  const one = (key) => listOf(key, 1)[0]?.name || null;
  const qty = (key) => { const v = r.props[key]?.[0]?.value; return v && typeof v === 'object' && 'amount' in v ? v : null; };
  // Wikidata stores height/mass in whatever unit the editor used — normalise it.
  const CM = { Q174728: 1, Q11573: 100, Q11574: 0.01, Q218593: 2.54, Q3710: 30.48, Q174789: 0.1 };
  const KG = { Q11570: 1, Q100995: 0.45359237, Q41803: 0.001, Q828224: 1000 };
  const toCm = () => { const q = qty('heightCm'); if (!q) return null; const f = CM[q.unit]; if (!f) return null; const cm = q.amount * f; return cm > 40 && cm < 260 ? Math.round(cm) : null; };
  const toKg = () => { const q = qty('massKg'); if (!q) return null; const f = KG[q.unit]; if (!f) return null; const kg = q.amount * f; return kg > 20 && kg < 400 ? Math.round(kg) : null; };
  const str = (key) => (typeof r.props[key]?.[0]?.value === 'string' ? r.props[key][0].value : null);
  const date = (key) => { const v = r.props[key]?.[0]?.value; return v && typeof v === 'object' && 'year' in v ? v : null; };

  const imgKey = r.props.imageFile?.[0]?.value;
  const image = typeof imgKey === 'string' ? licenses[imgKey] || null : null;

  const facts = {
    slug: t.slug, name: r.label, qid: r.qid,
    seo: { volume: t.volume, kd: t.kd, score: t.score, keywords: t.keywords },
    shortDescription: r.description, aliases: r.aliases,
    birthName: str('birthName'),
    gender: one('gender'), birthDate: date('birthDate'), deathDate: date('deathDate'),
    birthPlace: listOf('birthPlace', 3).map((x) => x.name), deathPlace: one('deathPlace'),
    citizenship: listOf('citizenship', 3).map((x) => x.name),
    occupations: listOf('occupations', 6).map((x) => x.name),
    heightCm: toCm(), massKg: toKg(),
    education: listOf('education', 4).map((x) => x.name),
    languages: listOf('languages', 4).map((x) => x.name),
    residence: listOf('residence', 2).map((x) => x.name),
    father: one('father'), mother: one('mother'),
    spouses: listOf('spouses', 4), children: listOf('children', 6).map((x) => x.name),
    siblings: listOf('siblings', 6).map((x) => x.name),
    awards: listOf('awards', 10), notableWorks: listOf('notableWorks', 10).map((x) => x.name),
    nominations: listOf('nominations', 8), nicknames: [...new Set((r.props.nicknames || []).map((c) => typeof c.value === 'string' ? c.value : null).filter(Boolean))].slice(0, 4),
    pseudonym: str('pseudonym'), genres: listOf('genres', 5).map((x) => x.name),
    degree: listOf('degree', 3).map((x) => x.name), militaryRank: one('militaryRank'),
    recordLabel: listOf('recordLabel', 3).map((x) => x.name),
    teams: listOf('teams', 8), sports: listOf('sports', 3).map((x) => x.name),
    playingPosition: one('playingPosition'),
    positionsHeld: listOf('positionsHeld', 6), party: one('party'),
    employer: listOf('employer', 3).map((x) => x.name),
    instruments: listOf('instruments', 4).map((x) => x.name),
    participatedIn: listOf('participatedIn', 6).map((x) => x.name),
    links: {
      website: str('website'), twitter: str('twitter'), instagram: str('instagram'),
      facebook: str('facebook'), youtube: str('youtube'), wikipedia: r.wikipedia,
      wikidata: `https://www.wikidata.org/wiki/${r.qid}`,
    },
    image,
    fetchedAt: new Date().toISOString().slice(0, 10),
  };
  fs.writeFileSync(path.join(OUTDIR, `${t.slug}.json`), JSON.stringify(facts));
  written++;
}
console.log(`\n✅ facts written: ${written}   (no Wikidata match: ${skipped})`);
if (rejected.length) {
  fs.writeFileSync(path.join(ROOT, 'data/rejected.json'), JSON.stringify(rejected, null, 1));
  console.log(`⚠️  rejected as wrong-person: ${rejected.length} → data/rejected.json`);
  rejected.slice(0, 8).forEach((r) => console.log(`     ${r.slug} → "${r.got}" (${r.desc})`));
}
