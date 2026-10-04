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
