import { studyStats } from '../../lib/study.mjs';

/* The dataset behind the study page, as one tidy long-format CSV.

   Declaring schema.org/Dataset without something to download is a claim
   with nothing behind it — and a figure a journalist cannot pull into a
   spreadsheet is a figure they will not cite. Same source as the page,
   so the two cannot drift apart. */
const esc = (v: unknown) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  const s = studyStats();
  const rows: (string | number)[][] = [
    ['table', 'group', 'measure', 'value', 'records'],
  ];

  for (const g of s.gender) rows.push(['gender_by_field', g.field, 'percent_women', g.pct.toFixed(1), g.n]);
  for (const c of s.cities) rows.push(['top_birthplaces', c.city, 'people', c.n, s.withPlace]);
  for (const m of s.median) rows.push(['median_birth_year_by_field', m.field, 'year', m.year, m.n]);
  for (const e of s.education) rows.push(['top_institutions', e.name, 'people', e.n, s.withEducation]);
  for (const m of s.months) {
    rows.push(['births_by_month', m.m, 'percent_vs_daily_average', m.idx.toFixed(1), m.n]);
  }
  rows.push(['coverage', 'all records', 'count', s.total, s.total]);
  rows.push(['coverage', 'with birthplace', 'count', s.withPlace, s.total]);
  rows.push(['coverage', 'with birth year', 'count', s.withYear, s.total]);
  rows.push(['coverage', 'with education', 'count', s.withEducation, s.total]);
  rows.push(['coverage', 'with full birth date', 'count', s.datedCount, s.total]);

  const header = [
    '# Who Becomes Famous in India? — aggregate tables',
    '# https://www.getbiostar.com/research/who-becomes-famous-in-india/',
    '# Underlying facts from Wikidata (CC0). This aggregation CC BY 4.0 — please link back.',
    '# Percentages are taken against the records carrying the field in question, not the total.',
    '# Caveat: this measures who has a Wikidata record, not who is famous. See the page.',
  ].join('\n');

  const csv = `${header}\n${rows.map((r) => r.map(esc).join(',')).join('\n')}\n`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'inline; filename="biostar-who-becomes-famous-in-india.csv"',
    },
  });
}
