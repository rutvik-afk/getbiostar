/* Aggregates behind /research/who-becomes-famous-in-india/.

   Shared by the page and the CSV endpoint so the published figures and
   the downloadable file can never disagree — a study whose table and
   download say different things is worse than no download at all.
   Everything is computed from data/facts at build time, so the numbers
   move with the dataset instead of being typed in once. */
import fs from 'node:fs';
import path from 'node:path';
import { categoryOf } from './bio.mjs';

const FACTS = path.resolve(import.meta.dirname, '..', '..', 'data', 'facts');

export const FIELD = {
  actor: 'Acting', creator: 'Digital media', musician: 'Music',
  notable: 'Other public life', politics: 'Politics', athlete: 'Sport',
  business: 'Business',
};
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const placeOf = (p) => (Array.isArray(p.birthPlace) ? p.birthPlace[0] : p.birthPlace);

let _cache = null;
export function studyStats() {
  if (_cache) return _cache;

  const people = fs.readdirSync(FACTS)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(FACTS, f), 'utf8')));
  for (const p of people) p._c = categoryOf(p);

  const total = people.length;
  const withPlace = people.filter(placeOf).length;
  const withYear = people.filter((p) => p.birthDate?.year).length;
  const withEducation = people.filter((p) => p.education?.length).length;

  const gender = Object.keys(FIELD).map((c) => {
    const g = people.filter((p) => p._c === c);
    return {
      field: FIELD[c], n: g.length,
      pct: (g.filter((p) => p.gender === 'female').length / g.length) * 100,
    };
  }).sort((a, b) => b.pct - a.pct);

  const cityCounts = {};
  for (const p of people) { const c = placeOf(p); if (c) cityCounts[c] = (cityCounts[c] || 0) + 1; }
  const cities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([city, n]) => ({ city, n, pct: (n / withPlace) * 100 }));

  const median = Object.keys(FIELD).map((c) => {
    const y = people.filter((p) => p._c === c && p.birthDate?.year)
      .map((p) => p.birthDate.year).sort((a, b) => a - b);
    return { field: FIELD[c], n: y.length, year: y[Math.floor(y.length / 2)] };
  }).sort((a, b) => a.year - b.year);

  const eduCounts = {};
  for (const p of people) for (const e of p.education || []) eduCounts[e] = (eduCounts[e] || 0) + 1;
  const education = Object.entries(eduCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, n]) => ({ name, n }));

  const dated = people.filter((p) => p.birthDate?.month && p.birthDate?.day);
  const monthCounts = {};
  for (const p of dated) monthCounts[p.birthDate.month] = (monthCounts[p.birthDate.month] || 0) + 1;
  const perDayAvg = dated.length / 365;
  const months = MONTHS.map((m, i) => ({
    m, n: monthCounts[i + 1] || 0,
    idx: (((monthCounts[i + 1] || 0) / DAYS[i]) / perDayAvg - 1) * 100,
  }));

  const years = people.map((p) => p.birthDate?.year).filter(Boolean).sort((a, b) => a - b);

  _cache = {
    total, withPlace, withYear, withEducation,
    gender, cities, median, education, months,
    distinctPlaces: Object.keys(cityCounts).length,
    top10pct: (cities.reduce((s, c) => s + c.n, 0) / withPlace) * 100,
    datedCount: dated.length,
    jan1: dated.filter((p) => p.birthDate.month === 1 && p.birthDate.day === 1).length,
    jan1Expected: Math.round(dated.length / 365),
    firstOfMonthPct: (dated.filter((p) => p.birthDate.day === 1).length / dated.length) * 100,
    earliestBirthYear: years[0],
    latestBirthYear: years[years.length - 1],
  };
  return _cache;
}

/* Second study: film school. Separate export rather than part of
   studyStats so each page pays only for what it shows. */
const FILM_SCHOOL = /\b(film|drama|theatre|theater|cinema|acting)\b/i;

let _film = null;
export function filmSchoolStats() {
  if (_film) return _film;

  const people = fs.readdirSync(FACTS)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(FACTS, f), 'utf8')));
  for (const p of people) p._c = categoryOf(p);

  /* Credits and search volume live on the post, not the facts record, so
     both the queue and the published set are read — the question is about
     the dataset, not about what happens to be live today. */
  const posts = {};
  for (const dir of ['content/published', 'content/queue']) {
    const d = path.resolve(FACTS, '..', '..', dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (!f.endsWith('.json')) continue;
      const p = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'));
      posts[p.slug] = p;
    }
  }

  const actors = people.filter((p) => p._c === 'actor' && p.education?.length);
  const trained = actors.filter((p) => p.education.some((e) => FILM_SCHOOL.test(e)));
  const untrained = actors.filter((p) => !p.education.some((e) => FILM_SCHOOL.test(e)));

  const median = (xs) => {
    const s = xs.filter(Boolean).sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : null;
  };
  const credits = (g) => g.map((p) => posts[p.slug]?.worksCount || 0);
  const volume = (g) => g.map((p) => posts[p.slug]?.seo?.volume || 0);

  const tally = (g, re) => {
    const c = {};
    for (const p of g) for (const e of p.education) if (!re || re.test(e)) c[e] = (c[e] || 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n }));
  };

  const FIELD = {
    actor: 'Acting', musician: 'Music', athlete: 'Sport', politics: 'Politics',
    business: 'Business', creator: 'Digital media', notable: 'Other public life',
  };
  const coverage = Object.keys(FIELD).map((k) => {
    const g = people.filter((p) => p._c === k);
    return { field: FIELD[k], n: g.length, withEd: g.filter((p) => p.education?.length).length };
  }).filter((x) => x.n >= 40).sort((a, b) => (b.withEd / b.n) - (a.withEd / a.n));

  _film = {
    total: people.length,
    actorsWithEducation: actors.length,
    trained: trained.length,
    untrained: untrained.length,
    trainedPct: (trained.length / actors.length) * 100,
    untrainedPct: (untrained.length / actors.length) * 100,
    trainedMedianCredits: median(credits(trained)),
    untrainedMedianCredits: median(credits(untrained)),
    trainedAtCap: credits(trained).filter((x) => x === 60).length,
    untrainedAtCap: credits(untrained).filter((x) => x === 60).length,
    trainedMedianVolume: median(volume(trained)),
    untrainedMedianVolume: median(volume(untrained)),
    schools: tally(trained, FILM_SCHOOL).slice(0, 8),
    elsewhere: tally(actors, null).filter((x) => !FILM_SCHOOL.test(x.name)).slice(0, 10),
    distinctInstitutions: new Set(people.flatMap((p) => p.education || [])).size,
    coverage,
  };
  return _film;
}

/* Third study: who famous people marry, and who their parents are. */
let _family = null;
export function familyStats() {
  if (_family) return _family;

  const people = fs.readdirSync(FACTS)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(FACTS, f), 'utf8')));
  for (const p of people) p._c = categoryOf(p);

  const FIELD = {
    actor: 'Acting', musician: 'Music', athlete: 'Sport', politics: 'Politics',
    business: 'Business', creator: 'Digital media', notable: 'Other public life',
  };
  const byName = new Map(people.map((p) => [p.name.toLowerCase(), p]));

  /* Couples where both halves are in the dataset, deduplicated — a
     marriage is recorded on both records, so counting rows double-counts. */
  const couples = [];
  const seen = new Set();
  for (const p of people) {
    for (const s of p.spouses || []) {
      const m = byName.get((s.name || '').toLowerCase());
      if (!m || m.name === p.name) continue;
      const key = [p.name, m.name].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      couples.push({
        a: p.name, b: m.name,
        fieldA: FIELD[p._c], fieldB: FIELD[m._c],
        same: p._c === m._c,
      });
    }
  }

  const withSpouse = people.filter((p) => p.spouses?.length);
  const sameField = couples.filter((c) => c.same).length;

  const mixes = {};
  for (const c of couples) {
    if (c.same) continue;
    const k = [c.fieldA, c.fieldB].sort().join(' + ');
    mixes[k] = (mixes[k] || 0) + 1;
  }

  const marriageRate = Object.keys(FIELD).map((k) => {
    const g = people.filter((p) => p._c === k);
    return { field: FIELD[k], n: g.length, married: g.filter((p) => p.spouses?.length).length };
  }).filter((x) => x.n >= 40).sort((a, b) => (b.married / b.n) - (a.married / a.n));

  /* Parents who are themselves in the dataset. Wikidata occasionally
     records a parent under the child's own name — one record has Vladimir
     Putin as his own father — so self-matches are dropped. */
  const children = {};
  for (const p of people) {
    for (const parent of [p.father, p.mother].filter(Boolean)) {
      const m = byName.get(String(parent).toLowerCase());
      if (!m || m.name === p.name) continue;
      (children[m.name] ||= new Set()).add(p.name);
    }
  }
  const families = Object.entries(children)
    .map(([parent, kids]) => ({ parent, children: [...kids] }))
    .sort((a, b) => b.children.length - a.children.length);
  const withFamousParent = new Set(families.flatMap((f) => f.children)).size;

  _family = {
    total: people.length,
    withSpouse: withSpouse.length,
    couples: couples.length,
    sameField,
    sameFieldPct: (sameField / couples.length) * 100,
    mixes: Object.entries(mixes).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([pair, n]) => ({ pair, n })),
    marriageRate,
    withFamousParent,
    families: families.filter((f) => f.children.length >= 2).slice(0, 10),
    familiesTotal: families.length,
  };
  return _family;
}
