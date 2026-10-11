/* ============================================================
   STEP 6b — identity and fact QA.

   Step 6 reads the prose and catches template defects. It would
   have passed /shantanu-naidu/ without a murmur: the sentences
   were well formed, the dates agreed with each other, every
   section was present. They were simply Ratan Tata's.

   This checks the claims instead of the grammar — is this the
   person we say it is, and is what we say about them internally
   consistent. Exit code 1 if anything is wrong on a LIVE page,
   so the daily run fails loudly rather than publishing it.

   Every check here is tuned for PRECISION over recall. An audit
   that cries wolf 142 times gets ignored, and then the one real
   wrong-identity page goes out with the noise. Where a mismatch
   cannot be told apart from a transliteration or a stage name,
   this stays quiet rather than guess.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const FACTS = path.join(ROOT, 'data/facts');
const TODAY = new Date();

const TITLES = new Set(['dr', 'mr', 'mrs', 'ms', 'sir', 'shri', 'smt', 'prof', 'major',
  'capt', 'col', 'lt', 'gen', 'the', 'of', 'and', 'jr', 'sr']);
const tok = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .split(/[^a-z0-9]+/).filter((t) => t && !TITLES.has(t));
const norm = (s) => tok(s).join(' ');

/* "Sr." is the whole point of a name like Barack Obama Sr., so the family
   checks need a normaliser that keeps it — stripping it reported five
   people as their own father. */
const normKin = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .split(/[^a-z0-9]+/).filter(Boolean).join(' ');

function ed(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 3;
  let p = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const c = [i];
    for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    p = c;
  }
  return p[n];
}

/* Transliteration (Regina/Regena), concatenation (Jungkook/Jung Kook) and
   compounding (Neem/Neemkaroli) are all one person spelled differently. */
const sameName = (want, have) => {
  if (!want.length || !have.length) return true;
  const wj = want.join(''), hj = have.join('');
  if (wj === hj || hj.includes(wj) || wj.includes(hj)) return true;
  return want.some((a) => have.some((b) => a === b
    || (a.length >= 4 && b.length >= 4 && ed(a, b) <= 1)
    || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)))));
};

const read = (dir) => {
  const d = path.join(ROOT, dir);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => f.endsWith('.json'))
    .map((f) => ({ ...JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')), _live: dir.endsWith('published') }));
};
const posts = [...read('content/published'), ...read('content/queue')];
const facts = {};
for (const f of fs.readdirSync(FACTS).filter((x) => x.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(FACTS, f), 'utf8'));
  facts[j.slug] = j;
}
const liveOf = new Map(posts.map((p) => [p.slug, p._live]));

/* Kinds that cannot tell a real fault from a stage name, and so must never
   fail the daily run -- Paul Wight really is Big Show, and Kunika really is
   Kunickaa Sadanand. They are printed for a human to glance at. */
const ADVISORY = new Set(["name unrelated to its article", "portrait may be a blank crop"]);

const problems = [];
const flag = (slug, live, kind, detail) => problems.push({ slug, live: !!live, kind, detail });

const articleTitle = (f) => {
  const w = f?.links?.wikipedia;
  if (!w) return null;
  return decodeURIComponent(w.split('/wiki/')[1] || '').replace(/_/g, ' ');
};
const ageOn = (b, end) => {
  if (!b?.year) return null;
  let a = end.getFullYear() - b.year;
  const m = (b.month || 1) - 1, d = b.day || 1;
  if (end.getMonth() < m || (end.getMonth() === m && end.getDate() < d)) a--;
  return a;
};

/* ---- A. one Wikidata entity claimed by two profiles ---- */
const byQid = {};
for (const f of Object.values(facts)) if (f.qid) (byQid[f.qid] ||= []).push(f);
for (const [qid, v] of Object.entries(byQid)) {
  if (v.length < 2) continue;
  for (const f of v) {
    flag(f.slug, liveOf.get(f.slug), 'entity shared with another profile',
      `${qid} also used by ${v.filter((x) => x !== f).map((x) => x.slug).join(', ')}`);
  }
}

/* ---- B. the article we cite is another profile's person ----
   Two real people can share a name (there are two actresses called
   Malavika Nair, each with their own item), so a different QID means
   this is a coincidence, not a theft. */
const byName = new Map(Object.values(facts).map((f) => [norm(f.name), f]));
for (const f of Object.values(facts)) {
  const t = articleTitle(f);
  if (!t) continue;
  const owner = byName.get(norm(t.replace(/ \(.*\)$/, '')));
  if (owner && owner.slug !== f.slug && owner.qid === f.qid) {
    flag(f.slug, liveOf.get(f.slug), "cites another profile's article", `"${t}" is ${owner.slug}`);
  }
}

/* ---- C. the name has nothing in common with its own article ---- */
for (const f of Object.values(facts)) {
  const t = articleTitle(f);
  if (!t) continue;
  const want = tok(f.name).filter((x) => x.length > 2);
  const have = tok(t.replace(/ \(.*\)$/, ''));
  if (!sameName(want, have)) {
    flag(f.slug, liveOf.get(f.slug), 'name unrelated to its article', `${f.name} -> "${t}"`);
  }
}

/* ---- D. a portrait that compresses to almost nothing ----
   A crop that lands on a blank wall encodes tiny. Anurag Kashyap's was
   6 KB against a median of 37 KB, and the page showed a blurred backdrop
   with an ear at the edge. Advisory, because a correctly framed portrait
   against a plain studio background is also small — Kendall Jenner's is
   11 KB and perfectly good. This says "look at this one", not "this is
   broken". */
const IMGDIR = path.join(ROOT, 'public/img');
for (const p of posts) {
  if (!p._live || p.image?.license === 'Original artwork') continue;
  const file = path.join(IMGDIR, `${p.slug}.webp`);
  if (!fs.existsSync(file)) { flag(p.slug, true, 'live page with no portrait file', `${p.slug}.webp`); continue; }
  const kb = fs.statSync(file).size / 1024;
  if (kb < 12) flag(p.slug, p._live, 'portrait may be a blank crop', `${Math.round(kb)} KB`);
}

/* A photo check was tried here and removed. Comparing the Commons filename
   against the name cannot work: most filenames are descriptive ("2023-11-16
   Gala de los Latin Grammy") and prove nothing, group shots name the wrong
   guest ("Celebrities at Manish Malhotra ... show"), concatenations collide
   ("GauriGKishan" contains "kishan"), and the one real wrong-face case this
   was written for -- yudhvir-singh-charak carrying a photo of Yudhvir Singh
   Malik -- shares a first name and so passes anyway. It produced eight false
   positives and zero true ones. A face has to be looked at, not parsed. */

/* ---- D..K. per-post consistency ---- */
for (const p of posts) {
  const f = facts[p.slug];
  if (!f) { flag(p.slug, p._live, 'post with no facts record', ''); continue; }
  const prose = [...(p.lead || []), ...(p.sections || []).flatMap((s) => s.paras || [])].join(' ');

  if (norm(p.name) !== norm(f.name)) {
    flag(p.slug, p._live, 'post name differs from facts name', `"${p.name}" vs "${f.name}"`);
  }

  /* alive / dead contradictions — the Shantanu Naidu failure mode */
  if (p.alive === true && p.deathDate) flag(p.slug, p._live, 'marked alive but has a death date', JSON.stringify(p.deathDate));
  if (p.alive === false && !p.deathDate) flag(p.slug, p._live, 'marked dead with no death date', '');
  if (p.deathDate?.year && p.birthDate?.year && p.deathDate.year < p.birthDate.year) {
    flag(p.slug, p._live, 'died before being born', `${p.birthDate.year} -> ${p.deathDate.year}`);
  }

  /* implausible ages */
  const end = p.deathDate?.year
    ? new Date(p.deathDate.year, (p.deathDate.month || 1) - 1, p.deathDate.day || 1)
    : TODAY;
  const age = ageOn(p.birthDate, end);
  if (p.birthDate?.year > TODAY.getFullYear()) flag(p.slug, p._live, 'born in the future', String(p.birthDate.year));
  if (age !== null && p.alive && age > 105) flag(p.slug, p._live, 'alive and over 105', String(age));
  if (age !== null && age < 5) flag(p.slug, p._live, 'under five years old', String(age));

  /* a stated age that does not follow from the stated birth date */
  const qAge = (p.quickFacts || []).find((q) => q.label === 'Age')?.value;
  const stated = qAge && /(\d+)/.exec(qAge)?.[1];
  if (stated && age !== null && Math.abs(Number(stated) - age) > 1) {
    flag(p.slug, p._live, 'stated age does not match birth date', `says ${stated}, date gives ${age}`);
  }

  /* a full birthday printed from a date Wikidata only knows to the year */
  const prec = f.birthDate?.precision;
  const qDob = (p.quickFacts || []).find((q) => q.label === 'Date of birth')?.value || '';
  if (prec !== undefined && prec < 11 && /\d{1,2}\s+\w+\s+\d{4}/.test(qDob)) {
    flag(p.slug, p._live, 'exact birthday from a year-only record', `precision ${prec} -> "${qDob}"`);
  }

  /* pronouns against the recorded gender */
  const he = (prose.match(/\b(he|his|him)\b/gi) || []).length;
  const she = (prose.match(/\b(she|her|hers)\b/gi) || []).length;
  if (f.gender === 'female' && he > she && he > 2) flag(p.slug, p._live, 'female record written with he/his', `he ${he} vs she ${she}`);
  if (f.gender === 'male' && she > he && she > 2) flag(p.slug, p._live, 'male record written with she/her', `she ${she} vs he ${he}`);

  /* family that contains the person themselves */
  const self = normKin(f.name);
  for (const [k, v] of [['father', f.father], ['mother', f.mother]]) {
    if (v && normKin(v) === self) flag(p.slug, p._live, `listed as their own ${k}`, String(v));
  }
  for (const s of f.spouses || []) {
    if (s.name && normKin(s.name) === self) flag(p.slug, p._live, 'married to themselves', s.name);
  }
}

/* ---- report ---- */
const liveBad = problems.filter((p) => p.live && !ADVISORY.has(p.kind));
const byKind = {};
for (const p of problems) (byKind[p.kind] ||= []).push(p);

console.log(`Checked ${posts.length} posts against ${Object.keys(facts).length} facts records`);
console.log(`  problems: ${problems.length}   on live pages: ${liveBad.length}\n`);
if (!problems.length) console.log('  nothing wrong');
for (const [kind, v] of Object.entries(byKind).sort((a, b) => b[1].length - a[1].length)) {
  const live = v.filter((x) => x.live).length;
  const tag = ADVISORY.has(kind) ? "  [advisory]" : "";
  console.log(`  ${String(v.length).padStart(4)} × ${kind}${live ? `   (${live} LIVE)` : ''}${tag}`);
  v.filter((x) => x.live).slice(0, 5).forEach((x) => console.log(`          LIVE  ${x.slug}: ${x.detail}`));
  v.filter((x) => !x.live).slice(0, 3).forEach((x) => console.log(`                ${x.slug}: ${x.detail}`));
}
if (liveBad.length) {
  console.log(`\n❌ ${liveBad.length} problem(s) on live pages`);
  process.exit(1);
}
console.log('\n✅ no live page has an identity or consistency problem');
if (problems.length) console.log(`   (${problems.length} advisory or queue-only item(s) above)`);
