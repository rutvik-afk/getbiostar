import { familyStats } from '../../lib/study.mjs';

const esc = (v: unknown) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  const s = familyStats();
  const rows: (string | number)[][] = [['table', 'group', 'measure', 'value', 'records']];

  rows.push(['couples', 'same field', 'couples', s.sameField, s.couples]);
  rows.push(['couples', 'different fields', 'couples', s.couples - s.sameField, s.couples]);
  for (const m of s.mixes) rows.push(['cross_field_pairings', m.pair, 'couples', m.n, s.couples - s.sameField]);
  for (const m of s.marriageRate) rows.push(['marriage_on_record', m.field, 'with_spouse', m.married, m.n]);
  rows.push(['parentage', 'profiles with a parent in the dataset', 'people', s.withFamousParent, s.total]);
  rows.push(['parentage', 'parents with a child in the dataset', 'people', s.familiesTotal, s.total]);
  for (const f of s.families) rows.push(['largest_families', f.parent, 'children_in_dataset', f.children.length, s.total]);

  const header = [
    '# Who Do Famous People Marry? — aggregate tables',
    '# https://www.getbiostar.com/research/who-famous-people-marry/',
    '# Underlying facts from Wikidata (CC0). This aggregation CC BY 4.0 — please link back.',
    '# A couple counts only when BOTH spouses hold their own record, which is itself a fame filter.',
    '# Each marriage is counted once, though it appears on both records.',
  ].join('\n');

  return new Response(`${header}\n${rows.map((r) => r.map(esc).join(',')).join('\n')}\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'inline; filename="biostar-who-famous-people-marry.csv"',
    },
  });
}
