import { filmSchoolStats } from '../../lib/study.mjs';

/* Same source as the page, so the two cannot disagree — see the sibling
   endpoint for who-becomes-famous-in-india. */
const esc = (v: unknown) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  const s = filmSchoolStats();
  const rows: (string | number)[][] = [['table', 'group', 'measure', 'value', 'records']];

  rows.push(['attendance', 'film or drama school', 'actors', s.trained, s.actorsWithEducation]);
  rows.push(['attendance', 'no film or drama school', 'actors', s.untrained, s.actorsWithEducation]);
  for (const x of s.schools) rows.push(['film_schools', x.name, 'actors', x.n, s.trained]);
  for (const x of s.elsewhere) rows.push(['other_institutions', x.name, 'actors', x.n, s.actorsWithEducation]);
  rows.push(['outcome', 'film school', 'median_screen_credits', s.trainedMedianCredits, s.trained]);
  rows.push(['outcome', 'no film school', 'median_screen_credits', s.untrainedMedianCredits, s.untrained]);
  rows.push(['outcome', 'film school', 'median_monthly_searches', s.trainedMedianVolume, s.trained]);
  rows.push(['outcome', 'no film school', 'median_monthly_searches', s.untrainedMedianVolume, s.untrained]);
  rows.push(['caveat', 'film school', 'actors_at_the_60_credit_cap', s.trainedAtCap, s.trained]);
  rows.push(['caveat', 'no film school', 'actors_at_the_60_credit_cap', s.untrainedAtCap, s.untrained]);
  for (const c of s.coverage) rows.push(['education_coverage', c.field, 'with_education', c.withEd, c.n]);

  const header = [
    '# Do Actors Go to Film School? — aggregate tables',
    '# https://www.getbiostar.com/research/do-actors-go-to-film-school/',
    '# Underlying facts from Wikidata (CC0). This aggregation CC BY 4.0 — please link back.',
    '# Base is actors with ANY education on record, never the full dataset.',
    '# Screen credits are capped at 60 by our collection; see the caveat rows.',
  ].join('\n');

  return new Response(`${header}\n${rows.map((r) => r.map(esc).join(',')).join('\n')}\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'inline; filename="biostar-film-school.csv"',
    },
  });
}
