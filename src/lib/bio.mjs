/* ============================================================
   Shared helpers: dates, ages, units, formatting.
   Used by BOTH the generator scripts and the Astro pages.
   ============================================================ */
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function fmtDate(d) {
  if (!d || !d.year) return null;
  const y = d.bce ? `${Math.abs(d.year)} BCE` : d.year;
  if (d.month && d.day) return `${d.day} ${MONTHS[d.month - 1]} ${y}`;
  if (d.month) return `${MONTHS[d.month - 1]} ${y}`;
  return String(y);
}
export function fmtYear(d) { return d?.year ? (d.bce ? `${Math.abs(d.year)} BCE` : String(d.year)) : null; }

/** Age today (or age at death). Returns null when the date is too coarse. */
export function computeAge(birth, death, now = new Date()) {
  if (!birth?.year || birth.bce) return null;
  const end = death?.year ? new Date(Date.UTC(death.year, (death.month || 6) - 1, death.day || 15)) : now;
  const b = new Date(Date.UTC(birth.year, (birth.month || 6) - 1, birth.day || 15));
  let age = end.getUTCFullYear() - b.getUTCFullYear();
  const m = end.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && end.getUTCDate() < b.getUTCDate())) age--;
  if (age < 0 || age > 125) return null;
  return { age, approx: !birth.month || !birth.day };
}

export function cmToFeet(cm) {
  if (!cm) return null;
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return inch === 12 ? `${ft + 1}′ 0″` : `${ft}′ ${inch}″`;
}
export const kgToLb = (kg) => (kg ? Math.round(kg * 2.20462) : null);

export function zodiac(d) {
  if (!d?.month || !d?.day) return null;
  const s = [[1,20,'Capricorn','Aquarius'],[2,19,'Aquarius','Pisces'],[3,21,'Pisces','Aries'],[4,20,'Aries','Taurus'],[5,21,'Taurus','Gemini'],[6,21,'Gemini','Cancer'],[7,23,'Cancer','Leo'],[8,23,'Leo','Virgo'],[9,23,'Virgo','Libra'],[10,23,'Libra','Scorpio'],[11,22,'Scorpio','Sagittarius'],[12,22,'Sagittarius','Capricorn']];
  const r = s[d.month - 1];
  return d.day < r[1] ? r[2] : r[3];
}

export function list(arr, conj = 'and') {
  const a = (arr || []).filter(Boolean);
  if (!a.length) return null;
  if (a.length === 1) return a[0];
  if (a.length === 2) return `${a[0]} ${conj} ${a[1]}`;
  return `${a.slice(0, -1).join(', ')} ${conj} ${a[a.length - 1]}`;
}

/** "a" vs "an" — checked against the spoken sound, not just the letter. */
export function article(word) {
  if (!word) return 'a';
  const w = String(word).trim().toLowerCase();
  if (/^(uni|use|user|eu|one|once|ukrain)/.test(w)) return 'a';   // "a university", "a one-time"
  if (/^(hour|honest|honou?r|heir)/.test(w)) return 'an';          // silent h
  return /^[aeiou]/.test(w) ? 'an' : 'a';
}
export const withArticle = (w) => (w ? `${article(w)} ${w}` : null);
/** "a film actor and model" — article agrees with the FIRST item. */
export function asRole(items) {
  const a = (items || []).filter(Boolean);
  if (!a.length) return null;
  return `${article(a[0])} ${list(a)}`;
}

/** Wikidata lists overlapping job titles ("actor" + "film actor" + "actress").
    Keep the most specific, drop what it already implies. */
export function dedupeOccupations(occs) {
  const a = [...new Set((occs || []).filter(Boolean).map((o) => String(o).trim()))];
  const out = [];
  for (const o of a) {
    const lo = o.toLowerCase();
    const subsumed = a.some((b) => {
      const lb = b.toLowerCase();
      return lb !== lo && lb.endsWith(' ' + lo);   // "film actor" subsumes "actor"
    });
    if (subsumed) continue;
    if (lo === 'actress' && a.some((b) => /actor/i.test(b))) continue;
    out.push(o);
  }
  return out.length ? out : a;
}

/** "holds Indian nationality" reads better than "holds India nationality". */
export function nationalityPhrase(countries) {
  const cs = (countries || []).filter(Boolean);
  if (!cs.length) return null;
  const dems = cs.map((c) => demonym(c)).filter(Boolean);
  if (dems.length === cs.length) return `${list(dems)} nationality`;
  return `citizenship of ${list(cs)}`;
}

export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const pronoun = (g, kind) => {
  const f = g === 'female' || g === 'trans woman';
  const m = g === 'male' || g === 'trans man';
  if (kind === 'subj') return f ? 'she' : m ? 'he' : 'they';
  if (kind === 'obj') return f ? 'her' : m ? 'him' : 'them';
  if (kind === 'poss') return f ? 'her' : m ? 'his' : 'their';
  if (kind === 'be') return f || m ? 'is' : 'are';
  if (kind === 'wasbe') return f || m ? 'was' : 'were';
  return 'they';
};

/** Deterministic hash → stable-but-varied template picking per person. */
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}
export const pick = (arr, seed, salt = 0) => arr[(seed + salt * 2654435761) % arr.length];

/** Main occupation phrase, e.g. "Indian cricketer" */
export function rolePhrase(f) {
  const nat = demonym(f.citizenship?.[0]);
  const occ = (f.occupations || [])[0];
  if (nat && occ) return `${nat} ${occ}`;
  return occ || (nat ? `${nat} public figure` : 'public figure');
}

const DEMONYMS = {
  India:'Indian', 'United States of America':'American', 'United States':'American',
  'United Kingdom':'British', Pakistan:'Pakistani', Bangladesh:'Bangladeshi',
  Australia:'Australian', Canada:'Canadian', Nepal:'Nepali', 'Sri Lanka':'Sri Lankan',
  France:'French', Germany:'German', Italy:'Italian', Spain:'Spanish', Japan:'Japanese',
  China:'Chinese', 'South Korea':'South Korean', Brazil:'Brazilian', Russia:'Russian',
  'South Africa':'South African', 'New Zealand':'New Zealander', Ireland:'Irish',
  Nigeria:'Nigerian', Mexico:'Mexican', Turkey:'Turkish', Sweden:'Swedish',
  Netherlands:'Dutch', Norway:'Norwegian', Denmark:'Danish', Poland:'Polish',
  Argentina:'Argentine', Portugal:'Portuguese', Philippines:'Filipino',
  Indonesia:'Indonesian', Thailand:'Thai', Egypt:'Egyptian', Israel:'Israeli',
  'United Arab Emirates':'Emirati', Singapore:'Singaporean', Malaysia:'Malaysian',
  Afghanistan:'Afghan', Iran:'Iranian', Ukraine:'Ukrainian', Switzerland:'Swiss',
  Belgium:'Belgian', Austria:'Austrian', Greece:'Greek', Colombia:'Colombian',
};
export const demonym = (country) => (country ? DEMONYMS[country] || null : null);

/** Category bucket used for /category/… hubs */
const CAT_RULES = [
  ['actor', /(actor|actress|film|television|voice artist|theatre|comedian|screenwriter|film director|filmmaker|producer)/i],
  ['musician', /(singer|musician|composer|rapper|songwriter|music|guitarist|drummer|dj|lyricist|playback)/i],
  ['athlete', /(cricket|footballer|athlete|player|sport|boxer|wrestler|tennis|badminton|hockey|olympic|racing|chess)/i],
  ['politics', /(politician|minister|president|governor|activist|diplomat|lawyer|judge|revolutionary|military|officer|army|police)/i],
  ['creator', /(youtuber|influencer|blogger|model|streamer|internet|social media|content creator|presenter|television presenter|journalist|anchor)/i],
  ['business', /(businessperson|entrepreneur|executive|investor|founder|ceo|banker|industrialist)/i],
];
export function categoryOf(f) {
  const hay = [...(f.occupations || []), ...(f.sports || []), f.shortDescription || ''].join(' ');
  for (const [cat, re] of CAT_RULES) if (re.test(hay)) return cat;
  return 'notable';
}
export const CATEGORIES = {
  actor: { label: 'Actors', blurb: 'Film and television performers — ages, heights, family backgrounds and filmography facts.' },
  musician: { label: 'Musicians', blurb: 'Singers, composers and instrumentalists — verified biography and discography facts.' },
  athlete: { label: 'Athletes', blurb: 'Cricketers, footballers and sportspeople — physical stats, teams and career records.' },
  politics: { label: 'Politics', blurb: 'Politicians, officers and public figures — offices held, parties and timelines.' },
  creator: { label: 'Creators', blurb: 'Digital creators, presenters and models — profiles built from public records.' },
  business: { label: 'Business', blurb: 'Founders, executives and investors — verified career and company facts.' },
  notable: { label: 'Notable People', blurb: 'Public figures whose biographies are documented in open reference sources.' },
};
