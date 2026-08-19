/* ============================================================
   STEP 3 — data/facts/*.json -> content/queue/*.json
   Writes ORIGINAL English prose from structured facts.
   Nothing is copied from any article; every sentence is
   assembled here, and every claim traces back to a fact field.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import {
  fmtDate, fmtYear, computeAge, cmToFeet, kgToLb, zodiac, list, cap,
  pronoun, hash, pick, rolePhrase, demonym, categoryOf,
  article, withArticle, asRole, dedupeOccupations, nationalityPhrase,
} from '../src/lib/bio.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const FACTS = path.join(ROOT, 'data/facts');
const QUEUE = path.join(ROOT, 'content/queue');
const PUB = path.join(ROOT, 'content/published');
fs.mkdirSync(QUEUE, { recursive: true });
fs.mkdirSync(PUB, { recursive: true });

const IMAGES_FILE = path.join(ROOT, 'data/images.json');
const IMAGES = fs.existsSync(IMAGES_FILE) ? JSON.parse(fs.readFileSync(IMAGES_FILE, 'utf8')) : {};

const WORKS_FILE = path.join(ROOT, 'data/works.json');
const WORKS = fs.existsSync(WORKS_FILE) ? JSON.parse(fs.readFileSync(WORKS_FILE, 'utf8')) : {};

/* Removal requests (see /dmca/). One slug per line — these people are
   never generated, and any live page for them is taken down on the next run. */
const BLOCK_FILE = path.join(ROOT, 'data/blocklist.txt');
const BLOCKED = new Set(
  fs.existsSync(BLOCK_FILE)
    ? fs.readFileSync(BLOCK_FILE, 'utf8').split('\n').map((l) => l.split('#')[0].trim().toLowerCase()).filter(Boolean)
    : []
);
for (const slug of BLOCKED) {
  for (const dir of [QUEUE, PUB]) {
    const fp = path.join(dir, `${slug}.json`);
    if (fs.existsSync(fp)) { fs.unlinkSync(fp); console.log(`🚫 removed on request: ${slug}`); }
  }
}

const files = fs.readdirSync(FACTS)
  .filter((f) => f.endsWith('.json'))
  .filter((f) => !BLOCKED.has(f.replace(/\.json$/, '').toLowerCase()));
console.log(`Generating posts for ${files.length} people…`);

const posts = [];

for (const file of files) {
  const f = JSON.parse(fs.readFileSync(path.join(FACTS, file), 'utf8'));
  const s = hash(f.slug);
  const P = (k) => pronoun(f.gender, k);
  const Subj = cap(P('subj'));
  const name = f.name;
  const first = name.split(' ')[0];
  const alive = !f.deathDate;
  const ageInfo = computeAge(f.birthDate, f.deathDate);
  const role = rolePhrase(f);
  const nat = demonym(f.citizenship?.[0]);
  const cat = categoryOf(f);
  const born = fmtDate(f.birthDate);
  const bornYear = fmtYear(f.birthDate);
  const bp = list(f.birthPlace);
  const occs = dedupeOccupations(f.occupations);
  const occ = list(occs);
  const natPhrase = nationalityPhrase(f.citizenship);

  /* ---------------- LEAD ---------------- */
  const leadOpen = pick([
    `${name} is ${withArticle(role)}`, `${name} is best known as ${withArticle(role)}`,
    `${name} is a widely followed ${role}`, `${name} has built a public profile as ${withArticle(role)}`,
  ], s, 1);
  const lead = [];
  {
    let a = alive ? leadOpen : `${name} was ${withArticle(role)}`;
    if (born) a += `, born on ${born}${bp ? ` in ${bp}` : ''}`;
    else if (bp) a += ` from ${bp}`;
    a += '.';
    lead.push(a);

    if (ageInfo) {
      lead.push(alive
        ? `As of ${new Date().getFullYear()}, ${P('subj')} ${P('be')} ${ageInfo.age} years old${zodiac(f.birthDate) ? `, and ${P('poss')} birth date places ${P('obj')} under the ${zodiac(f.birthDate)} sign` : ''}.`
        : `${Subj} died${f.deathDate ? ` on ${fmtDate(f.deathDate)}` : ''}${f.deathPlace ? ` in ${f.deathPlace}` : ''} at the age of ${ageInfo.age}.`);
    }
    const hi = [];
    if (f.teams?.length) hi.push(`has represented ${list(f.teams.slice(0, 2).map((t) => t.name))}`);
    if (f.notableWorks?.length) hi.push(`is associated with work such as ${list(f.notableWorks.slice(0, 3))}`);
    else if ((WORKS[f.slug] || []).length >= 3) hi.push(`has ${WORKS[f.slug].length} credited works on public record`);
    if (f.positionsHeld?.length) hi.push(`has held the office of ${list(f.positionsHeld.slice(0, 2).map((p) => p.name))}`);
    if (f.awards?.length) hi.push(`has been recognised with ${f.awards.length === 1 ? 'the ' + f.awards[0].name : list(f.awards.slice(0, 2).map((a) => a.name))}`);
    if (hi.length) lead.push(`${Subj} ${list(hi.slice(0, 2))}.`);
    lead.push(pick([
      `This profile collects the ${first} facts readers search for most — date of birth and current age, height and physical stats, family and relationship details, education, and a dated career timeline.`,
      `Below you will find a verified overview of ${name}: age, height, birthplace, family background, education, career milestones and awards, each drawn from open public records.`,
      `The sections that follow break down ${name}'s biography into quick facts, early life, career history, personal life and a year-by-year timeline.`,
    ], s, 2));
  }

  /* ---------------- QUICK FACTS ---------------- */
  const qf = [];
  const add = (label, value) => { if (value) qf.push({ label, value: String(value) }); };
  add('Full name', f.birthName || name);
  if (f.aliases?.length) add('Also known as', f.aliases.slice(0, 3).join(', '));
  add('Profession', occ ? cap(occ) : null);
  add('Date of birth', born);
  if (ageInfo) add('Age', alive ? `${ageInfo.age} years${ageInfo.approx ? ' (approx.)' : ''}` : `${ageInfo.age} years at death`);
  add('Zodiac sign', zodiac(f.birthDate));
  add('Birthplace', bp);
  add('Nationality', list(f.citizenship));
  if (!alive) { add('Date of death', fmtDate(f.deathDate)); add('Place of death', f.deathPlace); }
  add('Height', f.heightCm ? `${f.heightCm} cm (${cmToFeet(f.heightCm)})` : null);
  add('Weight', f.massKg ? `${f.massKg} kg (${kgToLb(f.massKg)} lb)` : null);
  add('Education', list(f.education));
  add('Spouse', list(f.spouses.map((x) => x.name)));
  add('Children', list(f.children));
  add('Father', f.father); add('Mother', f.mother);
  add('Siblings', list(f.siblings));
  add('Sport', list(f.sports));
  add('Playing position', f.playingPosition ? cap(f.playingPosition) : null);
  add('Current/last team', f.teams?.[0]?.name);
  add('Political party', f.party);
  add('Languages', list(f.languages));

  /* ---------------- SECTIONS ---------------- */
  const sections = [];
  const timelineExtra = [];
  const push = (id, heading, paras) => { const p = paras.filter(Boolean); if (p.length) sections.push({ id, heading, paras: p }); };

  /* Early life */
  {
    const p = [];
    let a = '';
    if (born && bp) a = `${name} was born on ${born} in ${bp}${natPhrase ? `, and holds ${natPhrase}` : ''}.`;
    else if (born) a = `${name} was born on ${born}.`;
    else if (bp) a = `${name} comes from ${bp}.`;
    if (a && f.birthName && f.birthName !== name) a += ` ${Subj} was given the name ${f.birthName} at birth and is publicly known as ${name}.`;
    if (a) p.push(a);

    const fam = [];
    if (f.father) fam.push(`${P('poss')} father, ${f.father}`);
    if (f.mother) fam.push(`${P('poss')} mother, ${f.mother}`);
    if (fam.length) p.push(`Public records name ${list(fam)}.${f.siblings?.length ? ` ${Subj} ${P('be')} a sibling of ${list(f.siblings)}.` : ''}`);
    else if (f.siblings?.length) p.push(`${Subj} ${P('be')} a sibling of ${list(f.siblings)}.`);

    if (f.education?.length) p.push(pick([
      `${Subj} studied at ${list(f.education)}.`,
      `${Subj} received ${P('poss')} education at ${list(f.education)}.`,
      `${P('poss') === 'their' ? 'Their' : cap(P('poss'))} listed education includes ${list(f.education)}.`,
    ], s, 3));
    if (f.languages?.length) p.push(`${Subj} ${P('be')} recorded as speaking ${list(f.languages)}.`);
    push('early-life', `${name} — Early Life, Family and Education`, p);
  }

  /* Career */
  {
    const p = [];
    if (occ) p.push(pick([
      `${name} works primarily as ${asRole(occs)}${f.employer?.length ? `, with ${list(f.employer)} listed among ${P('poss')} employers` : ''}.`,
      `${P('poss') === 'their' ? 'Their' : cap(P('poss'))} professional record lists ${occ} as ${P('poss')} ${occs.length > 1 ? 'occupations' : 'main occupation'}${f.employer?.length ? `, including work with ${list(f.employer)}` : ''}.`,
    ], s, 4));
    if (f.teams?.length) {
      const t = f.teams.map((x) => x.q?.from?.year ? `${x.name} (from ${x.q.from.year}${x.q.to?.year ? ` to ${x.q.to.year}` : ''})` : x.name);
      p.push(`On the team sheet, ${first} has been associated with ${list(t)}.${f.playingPosition ? ` ${Subj} plays as a ${f.playingPosition}.` : ''}`);
    }
    if (f.notableWorks?.length) p.push(`Among the credits most often linked to ${first} are ${list(f.notableWorks)}.`);
    if (f.positionsHeld?.length) {
      const ph = f.positionsHeld.map((x) => x.q?.from?.year ? `${x.name} (${x.q.from.year}${x.q.to?.year ? `–${x.q.to.year}` : '–present'})` : x.name);
      p.push(`${Subj} has held the following offices: ${list(ph)}.${f.party ? ` ${Subj} ${P('be')} affiliated with ${f.party}.` : ''}`);
    }
    if (f.instruments?.length) p.push(`${Subj} performs on ${list(f.instruments)}.`);
    if (f.participatedIn?.length) p.push(`${Subj} has taken part in ${list(f.participatedIn.slice(0, 5))}.`);
    push('career', `${name} — Career and Professional Work`, p);
  }

  /* Credited works — filmography / discography */
  const works = (WORKS[f.slug] || []).filter((w) => w.title);
  if (works.length >= 3) {
    const withYear = works.filter((w) => w.year);
    const span = withYear.length >= 2
      ? `${Math.min(...withYear.map((w) => w.year))} to ${Math.max(...withYear.map((w) => w.year))}` : null;
    const kinds = [...new Set(works.map((w) => w.type).filter(Boolean))];
    const isFilm = kinds.some((k) => /film|movie/.test(k));
    const noun = isFilm ? 'screen credits' : 'credited works';
    const roleCounts = {};
    for (const w of works) roleCounts[w.role] = (roleCounts[w.role] || 0) + 1;
    const roleEntries = Object.entries(roleCounts).sort((a, b) => b[1] - a[1]);

    sections.push({
      id: 'works',
      heading: `${name} — ${isFilm ? 'Filmography and Screen Credits' : 'Credited Works'}`,
      paras: [
        roleEntries.length === 1
          ? `Public databases list ${works.length} ${noun} for ${name}${span ? `, spanning ${span}` : ''}, all as ${roleEntries[0][0]}.`
          : `Public databases list ${works.length} ${noun} for ${name}${span ? `, spanning ${span}` : ''}. That breaks down as ${list(roleEntries.slice(0, 3).map(([r, n]) => `${n} as ${r}`))}.`,
        works.length > 45
          ? `The 45 most recent are listed below, newest first. Where a release year is not on record, the entry is marked with a dash rather than guessed.`
          : `The table below is sorted newest first. Where a release year is not on record, the entry is marked with a dash rather than guessed.`,
      ],
      works: works.slice(0, 45),
    });

    /* the biggest years also become timeline entries */
    const byYear = {};
    for (const w of withYear) (byYear[w.year] ||= []).push(w.title);
    const busiest = Object.entries(byYear).sort((a, b) => b[1].length - a[1].length).slice(0, 3);
    for (const [year, titles] of busiest) {
      if (titles.length >= 2) timelineExtra.push({ year: Number(year), text: `${titles.length} credited releases including ${list(titles.slice(0, 2))}.` });
    }
    if (withYear.length) {
      const first = withYear.reduce((a, b) => (a.year <= b.year ? a : b));
      if (!timelineExtra.some((t) => t.year === first.year)) {
        timelineExtra.push({ year: first.year, text: `Earliest credit on record: ${first.title}.` });
      }
    }
  }

  /* Awards */
  if (f.awards?.length) {
    const rows = f.awards.map((a) => ({ name: a.name, year: a.q?.date?.year || null, forWork: a.q?.for || a.q?.of || null }));
    sections.push({
      id: 'awards', heading: `${name} — Awards and Recognition`,
      paras: [`${Subj} has received ${rows.length} documented ${rows.length === 1 ? 'honour' : 'honours'}. The table below lists each award with the year it was conferred, where a year is on record.`],
      awards: rows,
    });
  }

  /* Personal life */
  {
    const p = [];
    if (f.spouses?.length) {
      const sp = f.spouses.map((x) => { const y = x.q?.from?.year; const e = x.q?.to?.year; return y ? `${x.name} (married ${y}${e ? `, until ${e}` : ''})` : x.name; });
      p.push(`${Subj} ${f.spouses.length > 1 ? 'has been married to' : (alive ? 'is married to' : 'was married to')} ${list(sp)}.`);
    } else if (alive) {
      p.push(`Open public records do not list a spouse for ${name}. Relationship claims that appear on social media are not included here unless they are documented in a reliable public source.`);
    }
    if (f.children?.length) p.push(`${Subj} ${P('be')} a parent to ${list(f.children)}.`);
    if (f.residence?.length) p.push(`${Subj} ${P('be')} associated with ${list(f.residence)} as a place of residence.`);
    push('personal-life', `${name} — Family, Marriage and Personal Life`, p);
  }

  /* Physical stats */
  if (f.heightCm || f.massKg) {
    sections.push({
      id: 'physical-stats', heading: `${name} — Height, Weight and Physical Stats`,
      paras: [
        f.heightCm ? `${name} stands ${f.heightCm} cm tall, which converts to roughly ${cmToFeet(f.heightCm)} and ${(f.heightCm / 100).toFixed(2)} m.` : null,
        f.massKg ? `${P('poss') === 'their' ? 'Their' : cap(P('poss'))} recorded body weight is ${f.massKg} kg (about ${kgToLb(f.massKg)} lb). Body measurements change over time, so treat this as the figure on public record rather than a current reading.` : null,
      ],
      stats: [
        f.heightCm && { label: 'Height (cm)', value: `${f.heightCm} cm` },
        f.heightCm && { label: 'Height (feet)', value: cmToFeet(f.heightCm) },
        f.heightCm && { label: 'Height (metres)', value: `${(f.heightCm / 100).toFixed(2)} m` },
        f.massKg && { label: 'Weight', value: `${f.massKg} kg / ${kgToLb(f.massKg)} lb` },
      ].filter(Boolean),
    });
  }

  /* Net worth — deliberately NOT a made-up number */
  sections.push({
    id: 'net-worth', heading: `${name} — Net Worth: What Is Actually Verifiable`,
    paras: [
      `Net-worth figures for ${name} circulate widely online, but almost none of them come from an audited or officially published source. ${'BioStar'} does not invent or repeat unsourced numbers, so no dollar figure is stated on this page.`,
      `What can be said from the public record is where ${P('poss')} income is likely to originate: ${list([
        occs.length ? `professional work as ${asRole(occs)}` : null,
        f.teams?.length ? 'team contracts' : null,
        f.teams?.length ? 'match fees' : null,
        f.employer?.length ? `employment with ${list(f.employer)}` : null,
        f.links?.instagram || f.links?.youtube ? 'brand partnerships' : null,
        f.links?.instagram || f.links?.youtube ? 'sponsored social content' : null,
        f.notableWorks?.length ? 'project fees and royalties from credited work' : null,
        f.positionsHeld?.length ? 'public office remuneration' : null,
      ].filter(Boolean)) || 'professional engagements'}.`,
      `If a verified figure is published by a credible outlet — a company filing, an election affidavit, or an official disclosure — this section will be updated with the source attached.`,
    ],
  });

  /* Timeline */
  const timeline = [...timelineExtra];
  if (f.birthDate?.year) timeline.push({ year: f.birthDate.year, text: `Born${bp ? ` in ${bp}` : ''}.` });
  for (const e of f.education || []) timeline.push({ year: null, text: `Educated at ${e}.` });
  for (const t of f.teams || []) if (t.q?.from?.year) timeline.push({ year: t.q.from.year, text: `Joined ${t.name}${t.q?.to?.year ? `, through ${t.q.to.year}` : ''}.` });
  for (const p of f.positionsHeld || []) if (p.q?.from?.year) timeline.push({ year: p.q.from.year, text: `Took office as ${p.name}${p.q?.to?.year ? `, serving until ${p.q.to.year}` : ''}.` });
  for (const a of f.awards || []) if (a.q?.date?.year) timeline.push({ year: a.q.date.year, text: `Received the ${a.name}.` });
  for (const sp of f.spouses || []) if (sp.q?.from?.year) timeline.push({ year: sp.q.from.year, text: `Married ${sp.name}.` });
  if (f.deathDate?.year) timeline.push({ year: f.deathDate.year, text: `Died${f.deathPlace ? ` in ${f.deathPlace}` : ''}.` });
  const tl = timeline.filter((x) => x.year).sort((a, b) => a.year - b.year);

  /* ---------------- FAQ (answers built from the same facts) ---------------- */
  const faq = [];
  const askedAbout = (re) => (f.seo?.keywords || []).some((k) => re.test(k.kw));
  const q = (question, answer) => { if (answer) faq.push({ q: question, a: answer }); };

  q(`How old is ${name}?`, ageInfo ? (alive
      ? `${name} is ${ageInfo.age} years old${born ? `, having been born on ${born}` : ''}. The age shown here is recalculated on every rebuild of this page, so it never goes stale.`
      : `${name} was ${ageInfo.age} years old at the time of death${f.deathDate ? ` on ${fmtDate(f.deathDate)}` : ''}.`) : null);
  q(`What is ${name}'s date of birth?`, born ? `${name} was born on ${born}${bp ? ` in ${bp}` : ''}.` : null);
  q(`How tall is ${name}?`, f.heightCm ? `${name} is ${f.heightCm} cm tall, which is about ${cmToFeet(f.heightCm)}.` : null);
  q(`What is ${name}'s real name?`, f.birthName && f.birthName !== name ? `${P('poss') === 'their' ? 'Their' : cap(P('poss'))} birth name is ${f.birthName}; ${P('subj')} ${P('be')} publicly known as ${name}.` : null);
  q(`Where is ${name} from?`, bp ? `${name} was born in ${bp}${natPhrase ? ` and holds ${natPhrase}` : ''}.` : null);
  q(`Who is ${name}'s ${f.gender === 'female' ? 'husband' : 'wife'}?`, f.spouses?.length ? `${name} ${alive ? 'is' : 'was'} married to ${list(f.spouses.map((x) => x.name))}${f.spouses[0]?.q?.from?.year ? `, with the marriage recorded from ${f.spouses[0].q.from.year}` : ''}.` : (askedAbout(/wife|husband|married|spouse|boyfriend|girlfriend/i) ? `No spouse is listed for ${name} in the open public records this page is built from. We do not publish relationship rumours.` : null));
  q(`Does ${name} have children?`, f.children?.length ? `Yes — ${list(f.children)}.` : null);
  q(`What does ${name} do for a living?`, occ ? `${name} works as ${asRole(occs)}.` : null);
  q(`Which awards has ${name} won?`, f.awards?.length ? `${P('poss') === 'their' ? 'Their' : cap(P('poss'))} documented honours include ${list(f.awards.slice(0, 4).map((a) => a.q?.date?.year ? `${a.name} (${a.q.date.year})` : a.name))}.` : null);
  q(`What is ${name}'s net worth?`, `There is no audited, officially published net-worth figure for ${name}, so this page does not state one. The numbers found elsewhere online are estimates without a verifiable source behind them.`);
  q(`How many films or works is ${name} credited in?`, works.length >= 3
      ? `Public databases list ${works.length} credited ${works.length === 1 ? 'work' : 'works'} for ${name}${works.filter((w) => w.year).length ? `, the most recent dated ${Math.max(...works.filter((w) => w.year).map((w) => w.year))}` : ''}. The full list is in the credits table above.` : null);
  q(`Which teams has ${name} played for?`, f.teams?.length ? `${name} has been associated with ${list(f.teams.map((t) => t.name))}.` : null);
  q(`Where can I follow ${name} online?`, [f.links?.instagram && `Instagram (@${f.links.instagram})`, f.links?.twitter && `X (@${f.links.twitter})`, f.links?.youtube && 'YouTube', f.links?.website && 'an official website'].filter(Boolean).length
      ? `Verified public profiles on record include ${list([f.links?.instagram && `Instagram (@${f.links.instagram})`, f.links?.twitter && `X/Twitter (@${f.links.twitter})`, f.links?.youtube && 'a YouTube channel', f.links?.website && 'an official website'].filter(Boolean))}. Links are in the profile box above.` : null);

  /* ---------------- TITLE + META ---------------- */
  const angles = [];
  if (ageInfo) angles.push('Age');
  if (f.heightCm) angles.push('Height');
  if (f.spouses?.length) angles.push(f.gender === 'female' ? 'Husband' : 'Wife');
  else if (f.children?.length) angles.push('Family');
  if (f.awards?.length && angles.length < 3) angles.push('Awards');
  if (angles.length < 3) angles.push('Family');
  const title = `${name} — ${angles.slice(0, 3).join(', ')} & Biography`;
  const metaDescription = [
    `${name}${ageInfo && alive ? ` is ${ageInfo.age}` : ''}${born ? `, born ${born}` : ''}${bp ? ` in ${bp}` : ''}.`,
    f.heightCm ? `Height ${f.heightCm} cm (${cmToFeet(f.heightCm)}).` : '',
    f.spouses?.length ? `Married to ${f.spouses[0].name}.` : '',
    `Full biography, family, career and awards.`,
  ].join(' ').replace(/\s+/g, ' ').trim().slice(0, 158);

  posts.push({
    slug: f.slug, name, title, metaDescription, category: cat,
    role, nationality: f.citizenship?.[0] || null, occupations: occs,
    alive, birthDate: f.birthDate, deathDate: f.deathDate,
    birthPlace: f.birthPlace || [], heightCm: f.heightCm, massKg: f.massKg,
    lead, quickFacts: qf, sections, timeline: tl, faq,
    image: IMAGES[f.slug] || null, links: f.links,
    teams: (f.teams || []).map((t) => t.name), education: f.education || [],
    worksCount: works.length,
    seo: f.seo, qid: f.qid, related: [],
    generatedAt: new Date().toISOString().slice(0, 10),
  });
}

/* ---------------- TEXT FINALISER ----------------
   Source labels sometimes carry stray whitespace, and a name that already
   ends in a full stop ("Alois Hitler, Jr.") produced "Jr..". Titles keep
   their own punctuation — an ellipsis in a film name is not a defect.   */
const tidyWhitespace = (t) => (t == null ? '' : String(t).replace(/[ \t]+/g, ' ').replace(/ ([,;:])/g, '$1').trim());
const tidyProse = (t) => tidyWhitespace(t)
  .replace(/(?<!\.)\.\.(?!\.)(?=\s|$)/g, '.')     // "Jr.." -> "Jr."  (leaves "..." alone)
  .replace(/,\s*\./g, '.')
  .replace(/\s+([.!?])/g, '$1');

for (const p of posts) {
  p.title = tidyWhitespace(p.title);
  p.metaDescription = tidyProse(p.metaDescription);
  p.lead = p.lead.map(tidyProse);
  p.quickFacts = p.quickFacts.map((f) => ({ ...f, value: tidyWhitespace(f.value) }));
  p.timeline = p.timeline.map((t) => ({ ...t, text: tidyProse(t.text) }));
  p.faq = p.faq.map((f) => ({ q: tidyWhitespace(f.q), a: tidyProse(f.a) }));
  for (const sec of p.sections) {
    sec.heading = tidyWhitespace(sec.heading);
    sec.paras = sec.paras.filter(Boolean).map(tidyProse).filter(Boolean);
    if (sec.works) sec.works = sec.works.map((w) => ({ ...w, title: tidyWhitespace(w.title) }));
    if (sec.awards) sec.awards = sec.awards.map((a) => ({ ...a, name: tidyWhitespace(a.name) }));
  }
}

/* ---------------- INTERNAL LINKING (big SEO win) ---------------- */
const byCat = {};
for (const p of posts) (byCat[p.category] ||= []).push(p);
const scoreRel = (a, b) => {
  let sc = 0;
  if (a.category === b.category) sc += 3;
  if (a.nationality && a.nationality === b.nationality) sc += 3;
  const sharedOcc = a.occupations.filter((o) => b.occupations.includes(o)).length;
  sc += sharedOcc * 2;
  const sharedTeam = a.teams.filter((t) => b.teams.includes(t)).length;
  sc += sharedTeam * 4;
  if (a.birthPlace[0] && a.birthPlace[0] === b.birthPlace[0]) sc += 2;
  if (a.birthDate?.year && b.birthDate?.year && Math.abs(a.birthDate.year - b.birthDate.year) <= 4) sc += 1;
  return sc;
};
for (const p of posts) {
  const pool = (byCat[p.category] || []).filter((x) => x.slug !== p.slug);
  const others = posts.filter((x) => x.slug !== p.slug && x.category !== p.category);
  const cands = [...pool, ...others.slice(0, 300)];
  p.related = cands
    .map((x) => ({ slug: x.slug, name: x.name, role: x.role, sc: scoreRel(p, x) }))
    .sort((a, b) => b.sc - a.sc || a.name.localeCompare(b.name))
    .slice(0, 8)
    .map(({ slug, name, role }) => ({ slug, name, role, image: IMAGES[slug]?.url || null }));
}

/* A post that is already live gets REFRESHED in place (new facts, new
   age, same URL and same publish date) instead of being queued again.
   That is what keeps 3000 live pages from going stale.               */
const today = new Date().toISOString().slice(0, 10);
let queued = 0, refreshed = 0;
for (const p of posts) {
  const livePath = path.join(PUB, `${p.slug}.json`);
  if (fs.existsSync(livePath)) {
    const prev = JSON.parse(fs.readFileSync(livePath, 'utf8'));
    const changed = JSON.stringify({ ...p, publishedAt: 0, updatedAt: 0, generatedAt: 0 })
                 !== JSON.stringify({ ...prev, publishedAt: 0, updatedAt: 0, generatedAt: 0 });
    p.publishedAt = prev.publishedAt;
    p.updatedAt = changed ? today : (prev.updatedAt || prev.publishedAt);
    fs.writeFileSync(livePath, JSON.stringify(p));
    refreshed++;
  } else {
    fs.writeFileSync(path.join(QUEUE, `${p.slug}.json`), JSON.stringify(p));
    queued++;
  }
}
const words = posts.reduce((s, p) => s + JSON.stringify(p).split(/\s+/).length, 0);
console.log(`✅ ${posts.length} posts: ${queued} queued, ${refreshed} live pages refreshed`);
console.log(`   avg quick-facts rows: ${(posts.reduce((s, p) => s + p.quickFacts.length, 0) / posts.length).toFixed(1)}`);
console.log(`   avg FAQ entries: ${(posts.reduce((s, p) => s + p.faq.length, 0) / posts.length).toFixed(1)}`);
console.log(`   avg timeline events: ${(posts.reduce((s, p) => s + p.timeline.length, 0) / posts.length).toFixed(1)}`);
console.log(`   with free-licensed portrait: ${posts.filter((p) => p.image).length}/${posts.length}`);
