/* Small, polite Wikimedia API client (batched + retrying + on-disk cache) */
import fs from 'node:fs';
import path from 'node:path';

/* Wikimedia's UA policy wants a real, reachable contact — this pointed at
   biostar.com, which isn't us, so requests were identifying against a
   domain that doesn't exist. */
export const UA =
  'BioStarBot/1.0 (https://www.getbiostar.com; getbiostar@gmail.com) node-fetch';

const CACHE = path.resolve(import.meta.dirname, '..', '..', 'data', '.cache');
fs.mkdirSync(CACHE, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cacheKey(url) {
  let h = 5381;
  for (let i = 0; i < url.length; i++) h = ((h << 5) + h + url.charCodeAt(i)) | 0;
  return path.join(CACHE, `${(h >>> 0).toString(36)}.json`);
}

/* Set CACHE_DAYS=7 on a weekly run to re-pull records that may have changed;
   leave it unset and the on-disk cache never expires (fast re-runs).        */
const MAX_AGE_MS = process.env.CACHE_DAYS ? Number(process.env.CACHE_DAYS) * 86400000 : Infinity;

export async function getJSON(url, { cache = true, tries = 4 } = {}) {
  const cf = cacheKey(url);
  if (cache && fs.existsSync(cf)) {
    const fresh = MAX_AGE_MS === Infinity || (Date.now() - fs.statSync(cf).mtimeMs) < MAX_AGE_MS;
    if (fresh) { try { return JSON.parse(fs.readFileSync(cf, 'utf8')); } catch {} }
  }
  let lastErr;
  for (let t = 0; t < tries; t++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
      if (res.status === 429 || res.status >= 500) throw new Error('HTTP ' + res.status);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      if (cache) fs.writeFileSync(cf, JSON.stringify(j));
      return j;
    } catch (e) {
      lastErr = e;
      await sleep(400 * Math.pow(2, t) + Math.random() * 300);
    }
  }
  throw lastErr;
}

export const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

/** Batch: page titles -> { title -> {qid, pageid, normalizedTitle} } */
export async function titlesToQids(titles) {
  const map = {};
  for (const grp of chunk(titles, 45)) {
    const u = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=pageprops&ppprop=wikibase_item&titles=${encodeURIComponent(grp.join('|'))}`;
    const j = await getJSON(u);
    const q = j?.query || {};
    const alias = {};
    for (const n of q.normalized || []) alias[n.to] = n.from;
    for (const r of q.redirects || []) alias[r.to] = alias[r.from] ?? r.from;
    for (const p of q.pages || []) {
      const src = alias[p.title] ?? p.title;
      if (p.missing || !p.pageprops?.wikibase_item) continue;
      map[src] = { qid: p.pageprops.wikibase_item, pageid: p.pageid, title: p.title };
    }
    await sleep(150); // stay well under Wikimedia's rate limit across a large weekly batch
  }
  return map;
}

/** Single fallback search when the direct title miss */
export async function searchTitle(name) {
  const u = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&list=search&srlimit=1&srsearch=${encodeURIComponent(name)}`;
  const j = await getJSON(u);
  return j?.query?.search?.[0]?.title || null;
}

/** Batch: QIDs -> full wikidata entities */
export async function getEntities(qids, props = 'claims|labels|descriptions|sitelinks/urls|aliases') {
  const out = {};
  for (const grp of chunk(qids, 40)) {
    const u = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=${encodeURIComponent(props)}&languages=en&ids=${grp.join('|')}`;
    const j = await getJSON(u);
    Object.assign(out, j?.entities || {});
    await sleep(150);
  }
  return out;
}

/** Batch: QIDs -> english label strings only (cheap) */
export async function getLabels(qids) {
  const out = {};
  for (const grp of chunk([...new Set(qids)], 45)) {
    const u = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&languages=en&ids=${grp.join('|')}`;
    const j = await getJSON(u);
    for (const [qid, e] of Object.entries(j?.entities || {})) {
      const l = e?.labels?.en?.value;
      if (l) out[qid] = l;
    }
    await sleep(150);
  }
  return out;
}

/** Batch: Commons filenames -> license metadata (only FREE licences kept)

    GODL-India belongs on this list and its absence was expensive. The
    Press Information Bureau releases its photography under it, and PIB
    is who photographs Indian cricketers, politicians and award
    ceremonies — so for the subjects this site is actually about, GODL
    is the single most common licence on Commons: 27 of 45 results
    across a sample of five names, against 8 for the next one. Eleven
    live profiles were sitting on generated placeholders with
    commonsChecked already set, including Smriti Mandhana and Harleen
    Deol, who each have a plainly named portrait on Commons.

    It qualifies on the same terms as the rest: copy, adapt and use
    commercially, with attribution — which every image on this site
    already carries. Commons would not host it otherwise. */
const FREE = /^(cc0|cc[ -]by([ -]sa)?([ -]\d[\d.]*)?|public domain|pd|no restrictions|fal|godl([ -]india)?|ogl)/i;

/* FREE matches a prefix and nothing anchors its tail, so "CC BY-NC 4.0"
   passed on the strength of its first two words. No NonCommercial image
   ever reached the manifest — Commons does not host them, so the hole
   was never exercised — but it is one unusual licence string away from
   putting a file we may not use on a page that credits it as free. */
const NONFREE = /\b(nc|nd|noncommercial|non[ -]commercial|noderiv\w*)\b/i;
const isFreeLicense = (l) => FREE.test(l) && !NONFREE.test(l);
export async function commonsLicenses(files) {
  const out = {};
  for (const grp of chunk([...new Set(files)], 20)) {
    const titles = grp.map((f) => 'File:' + f).join('|');
    const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1200&titles=${encodeURIComponent(titles)}`;
    let j;
    try { j = await getJSON(u); } catch { continue; }
    for (const p of j?.query?.pages || []) {
      const ii = p.imageinfo?.[0];
      if (!ii) continue;
      const m = ii.extmetadata || {};
      const strip = (s) => (s ? String(s.value).replace(/<[^>]+>/g, '').trim() : '');
      const license = strip(m.LicenseShortName) || strip(m.License);
      if (!isFreeLicense(license)) continue;           // ⛔ non-free → skip entirely
      out[p.title.replace(/^File:/, '')] = {
        url: ii.thumburl || ii.url,
        origin: ii.url,
        width: ii.thumbwidth || ii.width,
        height: ii.thumbheight || ii.height,
        license,
        licenseUrl: strip(m.LicenseUrl),
        author: strip(m.Artist).slice(0, 160),
        credit: strip(m.Credit).slice(0, 160),
        page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
      };
    }
    await sleep(150);
  }
  return out;
}

/** Best free-licensed Commons portrait for a person, or null.

    Wikidata's P18 is empty for a lot of very well-known people — Virat
    Kohli, Dharmendra — even though Commons holds a properly licensed
    photo of them. This is the fallback for that case.

    The filename must carry the person's full name. Scoring alone is not
    enough: "Digangana Suryavanshi..." outscored the threshold for Vaibhav
    Suryavanshi on a shared surname, and "Jitesh Pillai..." for Jitesh
    Sharma. A wrong face on a biography is worse than placeholder art, so
    the name check is a filter, not a weight. */
/* Preferred route: the lead image on the person's own Wikipedia article.

   Matching Commons filenames against a name cannot establish identity.
   "Yudhvir Singh" — two tokens, and Singh is one of India's commonest
   surnames — matched "Shri Yudhvir Singh Malik", a transport ministry
   secretary, and put his face on a cricketer's page. No filename rule
   fixes that class: "Yudhvir Singh Malik" and "Aishwarya Rai Cannes
   2017" are the same shape, one a different person and one correct.

   An article's lead image needs no guessing — it is the image editors
   chose for that person. It also finds portraits the name search
   cannot: Divya Bharti's is filed as "Actress Divya Bharti.jpg", which
   no prefix match would reach. Every one of the 685 profiles still on
   placeholder art has a Wikipedia link, so this applies to all of them. */
export async function wikipediaLeadImage(wikipediaUrl) {
  if (!wikipediaUrl) return null;
  const title = wikipediaUrl.split('/wiki/')[1];
  if (!title) return null;
  let sum;
  try {
    sum = await getJSON(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, { cache: true },
    );
  } catch { return null; }
  const src = sum?.originalimage?.source;
  if (!src) return null;

  /* A lead image served from /wikipedia/en/ rather than
     /wikipedia/commons/ is a local English Wikipedia upload, which in
     practice means non-free fair use — Divya Bharti's is one. Commons
     does not hold it, so it is not ours to republish. */
  if (!src.includes('/wikipedia/commons/')) return null;

  /* MediaWiki normalises underscores to spaces in page titles, and
     commonsLicenses keys its result by the returned title — so a
     filename lifted straight from the URL never matched. */
  const file = decodeURIComponent(src.split('/').pop().split('?')[0]).replace(/_/g, ' ');
  if (!/\.(jpe?g|png)$/i.test(file)) return null;

  const meta = await commonsLicenses([file]);
  return meta[file] || null;
}

export async function commonsPortrait(name) {
  const norm = (s) => s.toLowerCase().replace(/[-_]+/g, ' ').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const want = norm(name);
  if (!want) return null;

  const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srnamespace=6&srlimit=10&srsearch=${encodeURIComponent(name)}`;
  let hits;
  try { hits = await getJSON(u, { cache: true }); } catch { return null; }

  /* A containment check alone is not enough when the name is short.
     "Yudhvir Singh" — two tokens, and Singh is one of the commonest
     surnames in India — matched "Shri Yudhvir Singh Malik", a transport
     ministry secretary, and put his face on a cricketer's page. The
     name was inside the filename; it just belonged to someone else.

     So for a two-token name, reject a match that another capitalised
     word runs straight on from: "Yudhvir Singh Malik" is a different
     person, while "Harleen Deol.jpg", "Deepti Sharma in 2025" and
     "Roopa Ganguly at a Swearing-in Ceremony" all continue with
     punctuation or a lowercase word and are kept. This does turn away
     the occasional real portrait filed under a fuller name than
     Wikidata holds. That trade is already settled here: a wrong face is
     worse than placeholder art. */
  const tokens = want.split(' ');
  const runsOn = (f) => {
    const i = norm(f).indexOf(want);
    const after = norm(f).slice(i + want.length);         // normalised: punctuation already gone
    const next = after.trim().split(' ')[0];
    if (!next) return false;
    const raw = f.slice(f.toLowerCase().indexOf(next.toLowerCase()));
    return /^[A-Z][a-z]+/.test(raw);                      // another capitalised name follows
  };

  const named = (hits?.query?.search || [])
    .map((x) => x.title.replace(/^File:/, ''))
    .filter((f) => /\.(jpe?g|png)$/i.test(f) && norm(f).includes(want))
    .filter((f) => tokens.length > 2 || !runsOn(f));
  if (!named.length) return null;

  const meta = await commonsLicenses(named);
  const ranked = named.map((f) => {
    const m = meta[f];
    if (!m) return null;
    const fl = norm(f);
    const ratio = m.height / m.width;
    let s = 0;
    if (/portrait|headshot|cropped/.test(fl)) s += 2;
    if (ratio >= 1.05) s += 2; else if (ratio >= 0.85) s += 1;
    if (/\band\b|\bwith\b|group|team|wedding|reception|funeral/.test(fl)) s -= 3;
    return { ...m, score: s };
  }).filter(Boolean).sort((a, b) => b.score - a.score);

  return ranked[0] && ranked[0].score >= 0 ? ranked[0] : null;
}
