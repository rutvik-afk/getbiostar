/* Small, polite Wikimedia API client (batched + retrying + on-disk cache) */
import fs from 'node:fs';
import path from 'node:path';

export const UA =
  'BioStarBot/1.0 (https://biostar.com; contact@biostar.com) node-fetch';

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

/** Batch: Commons filenames -> license metadata (only FREE licences kept) */
const FREE = /^(cc0|cc[ -]by([ -]sa)?([ -]\d[\d.]*)?|public domain|pd|no restrictions|fal)/i;
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
      if (!FREE.test(license)) continue;               // ⛔ non-free → skip entirely
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
