/* ============================================================
   STEP 9 — auto-pin today's newly published posts to Pinterest.

   Uses Pinterest API v5 (https://developers.pinterest.com/docs/api/v5/)
   with an access token read ONLY from the environment — never
   hardcoded, never logged, never seen by anyone editing this file.
   The image is attached by URL (our own live site), so this needs
   no file upload and no browser at all.

   Requires env var: PINTEREST_ACCESS_TOKEN
   Optional env var: PINTEREST_BOARD_ID  (falls back to auto-detect
                      "Bollywood & Celebrity Biography", or creates it)

     node scripts/09-pin-to-pinterest.mjs            # pin today's new posts
     node scripts/09-pin-to-pinterest.mjs --dry       # preview only
     node scripts/09-pin-to-pinterest.mjs --slug X    # pin one specific post
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { SITE } from '../site.config.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUB = path.join(ROOT, 'content/published');
const LOG = path.join(ROOT, 'content/pinterest-log.json');

/* Copy-pasting a token from a curl/JSON response commonly drags along
   whitespace — including newlines embedded mid-string, not just at the
   ends (e.g. a GitHub Secret pasted with line wraps). A real Pinterest
   token never contains whitespace, so strip ALL of it, then any leftover
   surrounding quotes — otherwise this becomes an invalid HTTP header
   value and fails with a cryptic Headers.append error. */
const TOKEN = (process.env.PINTEREST_ACCESS_TOKEN || '').replace(/\s/g, '').replace(/^["']|["']$/g, '');
const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const onlySlug = (() => { const i = argv.indexOf('--slug'); return i === -1 ? null : argv[i + 1]; })();
const BOARD_NAME = 'Bollywood & Celebrity Biography';

if (!TOKEN && !dry) {
  /* Exit quietly (code 0) rather than failing the workflow — GitHub Actions
     can't reference `secrets.*` directly in a step's `if:`, so this step
     always runs and the secret being unset is a normal, expected state
     (e.g. before it's been configured yet), not an error. */
  console.log('⏭  PINTEREST_ACCESS_TOKEN is not set — skipping Pinterest step.');
  console.log('   Add it in Settings → Secrets and variables → Actions to enable auto-pinning.');
  process.exit(0);
}

const API = 'https://api.pinterest.com/v5';
async function pinterest(pathname, opts = {}) {
  const res = await fetch(API + pathname, {
    ...opts,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Pinterest API ${pathname} → ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

async function getOrCreateBoardId() {
  if (process.env.PINTEREST_BOARD_ID) return process.env.PINTEREST_BOARD_ID;
  const list = await pinterest('/boards?page_size=100');
  const existing = (list.items || []).find((b) => b.name === BOARD_NAME);
  if (existing) return existing.id;
  const created = await pinterest('/boards', {
    method: 'POST',
    body: JSON.stringify({ name: BOARD_NAME, description: SITE.description, privacy: 'PUBLIC' }),
  });
  return created.id;
}

const log = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : { pinned: {} };

const posts = fs.readdirSync(PUB).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(PUB, f), 'utf8')));

const today = new Date().toISOString().slice(0, 10);
const targets = onlySlug
  ? posts.filter((p) => p.slug === onlySlug)
  : posts.filter((p) => p.publishedAt === today && !log.pinned[p.slug]);

if (!targets.length) {
  console.log(onlySlug ? `No published post found for slug "${onlySlug}".` : 'Nothing new to pin today.');
  process.exit(0);
}

console.log(`${dry ? '[dry run] ' : ''}Pinning ${targets.length} post(s) to Pinterest…`);

let boardId = null;
if (!dry) boardId = await getOrCreateBoardId();

let ok = 0, failed = 0;
for (const p of targets) {
  const imageUrl = p.image?.url ? `${SITE.domain}${p.image.url}` : null;
  if (!imageUrl) { console.log(`  ⏭  ${p.name} — no image, skipped`); continue; }

  const title = `${p.name} Age, Height & Full Biography`.slice(0, 100);
  const description = (p.metaDescription || p.lead?.[0] || '').slice(0, 500);
  const link = `${SITE.domain}/${p.slug}/`;

  console.log(`  → ${p.name}`);
  if (dry) { ok++; continue; }

  try {
    await pinterest('/pins', {
      method: 'POST',
      body: JSON.stringify({
        board_id: boardId,
        title,
        description,
        link,
        media_source: { source_type: 'image_url', url: imageUrl },
      }),
    });
    log.pinned[p.slug] = today;
    ok++;
  } catch (e) {
    console.error(`     ✗ ${e.message}`);
    failed++;
  }
}

if (!dry) fs.writeFileSync(LOG, JSON.stringify(log, null, 1));
console.log(`\n✅ ${ok} pinned${failed ? `, ${failed} failed` : ''}.`);
