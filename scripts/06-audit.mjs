/* ============================================================
   STEP 6 — content QA. Catches template failures at scale that
   are invisible when you eyeball three profiles.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const dirs = ['content/queue', 'content/published'].map((d) => path.join(ROOT, d));

const CHECKS = [
  ['literal null/undefined in prose', /\b(undefined|null|NaN|\[object)\b/],
  ['doubled word',                    /\b(\w+) \1\b(?! \1)/i],
  ['double space',                    /  /],
  ['space before punctuation',        / [.,;:]/],
  ['empty article "a ."',             /\ba\s*[.,]/],
  ['dangling "and ."',                /\b(and|or|of|as|in|with|the)\s*[.]/i],
  ['duplicated punctuation',          /[.]{2,}(?!\.)|,,/],
  ['unresolved template',             /\$\{|\{\{/],
];

let n = 0, thin = 0, noSections = 0;
const hits = {};
const examples = {};
const wordCounts = [];

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const p = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    n++;
    const prose = [
      ...p.lead,
      ...p.sections.flatMap((s) => [s.heading, ...s.paras]),
      ...p.faq.flatMap((f) => [f.q, f.a]),
      ...p.timeline.map((t) => t.text),
      p.title, p.metaDescription,
    ].join('\n');

    const words = prose.split(/\s+/).filter(Boolean).length
      + p.sections.reduce((s, x) => s + (x.works?.length || 0) * 4 + (x.awards?.length || 0) * 3, 0);
    wordCounts.push(words);
    if (words < 220) { thin++; (examples['thin'] ||= []).push(`${p.slug} (${words}w)`); }
    if (p.sections.length < 4) noSections++;

    for (const [label, re] of CHECKS) {
      const m = prose.match(re);
      if (m) {
        hits[label] = (hits[label] || 0) + 1;
        (examples[label] ||= []).push(`${p.slug}: …${prose.slice(Math.max(0, m.index - 40), m.index + 50).replace(/\n/g, ' ')}…`);
      }
    }
  }
}

wordCounts.sort((a, b) => a - b);
const pct = (q) => wordCounts[Math.floor(wordCounts.length * q)];
console.log(`Audited ${n} posts`);
console.log(`  words per page — p10 ${pct(0.1)} · median ${pct(0.5)} · p90 ${pct(0.9)}`);
console.log(`  thin (<220 words): ${thin} (${(thin / n * 100).toFixed(1)}%)`);
console.log(`  fewer than 4 sections: ${noSections}`);
console.log('\nTemplate defects:');
const found = Object.entries(hits).sort((a, b) => b[1] - a[1]);
if (!found.length) console.log('  none 🎉');
for (const [label, count] of found) {
  console.log(`  ${String(count).padStart(5)} × ${label}`);
  examples[label].slice(0, 2).forEach((e) => console.log(`          ${e}`));
}
if (examples.thin) console.log('\n  thinnest:', examples.thin.slice(0, 6).join(', '));
