/* ============================================================
   STEP 4 — images.
   1. Brand assets (drawn from scratch).
   2. Free-licensed Commons portraits are DOWNLOADED and re-encoded
      to local WebP — never hotlinked. Attribution is preserved and
      rendered under every image.
   3. People with no free portrait get an original generated cover.
   4. Every profile gets a 1200x630 social card built by us.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { SITE } from '../site.config.mjs';
import { hash, rolePhrase, cap } from '../src/lib/bio.mjs';
import { UA } from './lib/wiki.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const BRAND = path.join(ROOT, 'public/brand');
const IMG = path.join(ROOT, 'public/img');
for (const d of [BRAND, IMG]) fs.mkdirSync(d, { recursive: true });

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const CONC = Number(process.env.CONC || 3);
const PACE = Number(process.env.PACE || 350);   // ms between batches

/* warm, brand-adjacent range so generated covers sit next to amber tiles */
/* editorial palette — deep, print-like duotones that sit under white pages */
const PALETTES = [
  ['#7f1d1d', '#c8102e'], ['#1e1b4b', '#4338ca'], ['#134e4a', '#0f766e'],
  ['#3f2d18', '#a16207'], ['#500724', '#9d174d'], ['#0c1c2e', '#1e3a5f'],
  ['#14532d', '#3f6212'], ['#431407', '#9a3412'], ['#2e1065', '#6d28d9'],
  ['#0c4a6e', '#075985'], ['#4c0519', '#881337'], ['#1c1917', '#44403c'],
];
const initials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const fit = (s, max) => (s.length > max ? s.slice(0, max - 1) + '…' : s);

/* ---------- generated portrait cover (no photo available) ---------- */
function coverSVG(name, subtitle, w = 900, h = 1200) {
  const [c1, c2] = PALETTES[hash(name) % PALETTES.length];
  const seed = hash(name + 'x');
  const blobs = Array.from({ length: 5 }, (_, i) => {
    const cx = (((seed >> (i * 3)) % 100) / 100) * w;
    const cy = (((seed >> (i * 5 + 2)) % 100) / 100) * h;
    const r = 100 + ((seed >> (i * 7)) % 180);
    return `<circle cx="${cx | 0}" cy="${cy | 0}" r="${r}" fill="#fff" opacity="0.055"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>${blobs}
<circle cx="${w / 2}" cy="${h * 0.38}" r="${w * 0.2}" fill="#fff" opacity="0.14"/>
<text x="${w / 2}" y="${h * 0.38}" font-family="Helvetica,Arial,sans-serif" font-size="${w * 0.19}" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">${esc(initials(name))}</text>
<text x="${w / 2}" y="${h * 0.68}" font-family="Helvetica,Arial,sans-serif" font-size="${w * 0.068}" font-weight="700" fill="#fff" text-anchor="middle">${esc(fit(name, 22))}</text>
<text x="${w / 2}" y="${h * 0.735}" font-family="Helvetica,Arial,sans-serif" font-size="${w * 0.034}" fill="#fff" text-anchor="middle" opacity="0.82">${esc(fit(subtitle || '', 36))}</text>
<text x="${w / 2}" y="${h - 46}" font-family="Helvetica,Arial,sans-serif" font-size="${w * 0.03}" fill="#fff" text-anchor="middle" opacity="0.6" letter-spacing="3">${esc(SITE.name.toUpperCase())}</text>
</svg>`;
}

/* ---------- 1200x630 social card: our layout, their photo ---------- */
function ogTextSVG(name, subtitle, hasPhoto) {
  const x = hasPhoto ? 470 : 80;
  const [c1, c2] = PALETTES[hash(name) % PALETTES.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0%" stop-color="#08090c" stop-opacity="0.94"/><stop offset="100%" stop-color="#08090c" stop-opacity="0.70"/></linearGradient></defs>
<rect width="1200" height="630" fill="url(#s)"/>
<rect x="${x}" y="240" width="74" height="5" fill="#c8102e"/>
<text x="${x}" y="215" font-family="Helvetica,Arial,sans-serif" font-size="${name.length > 22 ? 52 : 64}" font-weight="900" fill="#fff" letter-spacing="-1">${esc(fit(name, 26)).toUpperCase()}</text>
<text x="${x}" y="296" font-family="Helvetica,Arial,sans-serif" font-size="30" fill="#9aa7b5">${esc(fit(subtitle || 'Biography &amp; facts', 34))}</text>
<text x="${x}" y="352" font-family="Helvetica,Arial,sans-serif" font-size="24" fill="#ff5468" letter-spacing="2">AGE · HEIGHT · FAMILY · CAREER · AWARDS</text>
<rect x="${x}" y="514" width="46" height="46" fill="#c8102e"/>
<text x="${x + 23}" y="539" font-family="Helvetica,Arial,sans-serif" font-size="24" fill="#ffffff" text-anchor="middle" dominant-baseline="central">★</text>
<text x="${x + 62}" y="548" font-family="Helvetica,Arial,sans-serif" font-size="26" font-weight="900" fill="#ffffff" letter-spacing="1">${esc(SITE.name).toUpperCase()}</text>
</svg>`;
}

async function buildOgCard(photoBuf, name, subtitle, out) {
  const layers = [];
  let base;
  if (photoBuf) {
    base = await sharp(photoBuf).resize(1200, 630, { fit: 'cover', position: 'top' }).blur(28).modulate({ brightness: 0.5 }).toBuffer();
    const card = await sharp(photoBuf)
      .resize(300, 400, { fit: 'cover', position: sharp.strategy.entropy })
      .modulate({ brightness: 1.12, saturation: 1.06 })
      .toBuffer();
    /* thin light frame so the portrait separates from the dark backdrop */
    const framed = await sharp({ create: { width: 308, height: 408, channels: 4, background: '#ffffff2e' } })
      .composite([{ input: card, left: 4, top: 4 }]).png().toBuffer();
    layers.push({ input: framed, left: 92, top: 111 });
  } else {
    base = await sharp(Buffer.from(coverSVG(name, subtitle, 1200, 630))).toBuffer();
  }
  layers.push({ input: Buffer.from(ogTextSVG(name, subtitle, !!photoBuf)), top: 0, left: 0 });
  await sharp(base).composite(layers).jpeg({ quality: 84, progressive: true }).toFile(out);
}

/* ---------- brand assets ---------- */
const logoSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<rect width="512" height="512" fill="#c8102e"/>
<path fill="#ffffff" d="M256 96l45.4 93.5 102.6 14.9-74.3 72.9 17.6 102.7L256 331.5 164.7 380l17.6-102.7-74.3-72.9 102.6-14.9z"/></svg>`;
fs.writeFileSync(path.join(ROOT, 'public/favicon.svg'), logoSVG);
await sharp(Buffer.from(logoSVG)).resize(512).png().toFile(path.join(BRAND, 'logo.png'));
await sharp(Buffer.from(logoSVG)).resize(180).png().toFile(path.join(BRAND, 'apple-touch-icon.png'));
await buildOgCard(null, SITE.name, SITE.tagline, path.join(BRAND, 'og-default.png'));
console.log('✅ brand assets');

/* ---------- per-person images ---------- */
const FACTS_DIR = path.join(ROOT, 'data/facts');
const MANIFEST = path.join(ROOT, 'data/images.json');
/* The manifest is the hand-off between this script and the generator, so the
   two can run in any order without a rebuild ever losing a downloaded photo. */
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};

const jobs = fs.readdirSync(FACTS_DIR).filter((f) => f.endsWith('.json')).map((f) => path.join(FACTS_DIR, f));

/* A social card is only ever fetched for a page that is live, so build it
   for published slugs only. Portraits are built for everyone, because the
   drip publisher needs them ready without re-hitting Wikimedia. */
const PUB_DIR = path.join(ROOT, 'content/published');
const PUBLISHED = new Set(
  fs.existsSync(PUB_DIR)
    ? fs.readdirSync(PUB_DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))
    : []
);
if (process.env.LIMIT) jobs.length = Math.min(jobs.length, Number(process.env.LIMIT));
console.log(`Processing images for ${jobs.length} profiles (concurrency ${CONC})…`);

let downloaded = 0, generated = 0, reused = 0, failed = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Wikimedia rate-limits bulk anonymous downloads hard (429). Keep the
   request rate low, honour Retry-After, and back off exponentially — a
   throttled run is fine, a run that silently drops photos is not. */
let throttleUntil = 0;
async function fetchBuf(url, tries = 5) {
  for (let t = 0; t < tries; t++) {
    const wait = throttleUntil - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(45000) });
      if (r.status === 429 || r.status === 503) {
        const ra = Number(r.headers.get('retry-after')) || 0;
        const pause = Math.max(ra * 1000, 4000 * Math.pow(2, t));
        throttleUntil = Date.now() + pause;      // pause every worker, not just this one
        throw new Error('HTTP ' + r.status);
      }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return Buffer.from(await r.arrayBuffer());
    } catch {
      if (t === tries - 1) return null;
      await sleep(600 * (t + 1) + Math.random() * 400);
    }
  }
  return null;
}

async function processOne(fp) {
  const f = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const slug = f.slug;
  const name = f.name;
  /* rolePhrase applies the demonym — "Indian film actor", not "India film actor" */
  const role = cap(rolePhrase(f) || f.shortDescription || '');
  const webp = path.join(IMG, `${slug}.webp`);
  const ogj = path.join(IMG, `${slug}-og.jpg`);
  const remote = f.image || null;

  const wantPhoto = !!remote?.url;
  const wantOg = PUBLISHED.has(slug);
  const entry = manifest[slug];
  const havePhoto = entry && !entry.generated;
  const pending = entry?.pendingPhoto;
  const ogOk = !wantOg || fs.existsSync(ogj);
  if (entry && !pending && fs.existsSync(webp) && ogOk && wantPhoto === havePhoto) { reused++; return; }

  let buf = null;
  if (wantPhoto) {
    buf = havePhoto && fs.existsSync(webp)
      ? fs.readFileSync(webp)            // rebuild derivatives from our own copy
      : await fetchBuf(remote.url);      // first time: pull it down once
    if (!buf) failed++;
  }

  const p = { name, role };
  try {
    if (buf) {
      if (!fs.existsSync(webp)) {
        await sharp(buf).resize(600, 800, { fit: 'cover', position: sharp.strategy.entropy })
          .webp({ quality: 82, effort: 4 }).toFile(webp);
      }
      if (wantOg) await buildOgCard(buf, p.name, p.role || '', ogj);
      manifest[slug] = {
        url: `/img/${slug}.webp`, ogUrl: `/img/${slug}-og.jpg`,
        width: 600, height: 800,
        license: remote.license, licenseUrl: remote.licenseUrl,
        author: remote.author || remote.credit, page: remote.page,
      };
      downloaded++;
    } else {
      const svg = coverSVG(p.name, p.role || '');
      if (!fs.existsSync(webp)) await sharp(Buffer.from(svg)).resize(600).webp({ quality: 84 }).toFile(webp);
      if (wantOg) await buildOgCard(null, p.name, p.role || '', ogj);
      manifest[slug] = {
        url: `/img/${slug}.webp`, ogUrl: `/img/${slug}-og.jpg`,
        width: 600, height: 800, generated: true,
        license: 'Original artwork', author: SITE.name,
        /* a photo exists but we could not pull it — retry on the next run
           instead of freezing this profile on placeholder art */
        ...(wantPhoto ? { pendingPhoto: true } : {}),
        ...(wantOg ? {} : { ogPending: true }),
      };
      generated++;
    }
  } catch (e) {
    failed++;
  }
}

for (let i = 0; i < jobs.length; i += CONC) {
  await Promise.all(jobs.slice(i, i + CONC).map(processOne));
  if (PACE) await sleep(PACE);
  if ((i / CONC) % 10 === 0) {
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest));
    process.stdout.write(`  ${Math.min(i + CONC, jobs.length)}/${jobs.length}  photo=${downloaded} generated=${generated} cached=${reused} failed=${failed}\r`);
  }
}
fs.writeFileSync(MANIFEST, JSON.stringify(manifest));

/* stamp the manifest onto any post that already exists */
let stamped = 0;
for (const dir of [path.join(ROOT, 'content/queue'), path.join(ROOT, 'content/published')]) {
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const fp = path.join(dir, file);
    const post = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const m = manifest[post.slug];
    if (!m) continue;
    post.image = m;
    for (const r of post.related || []) r.image = manifest[r.slug]?.url || null;
    fs.writeFileSync(fp, JSON.stringify(post));
    stamped++;
  }
}
console.log(`\n   manifest applied to ${stamped} existing posts`);
console.log(`\n✅ images: ${downloaded} photos self-hosted, ${generated} original covers, ${reused} cached, ${failed} failed`);
