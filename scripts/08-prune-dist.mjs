/* ============================================================
   STEP 8 — post-build prune.
   public/img holds artwork for every profile ever generated
   (3400+), but a build only publishes what is live. Astro copies
   public/ wholesale, so without this a 60-page site ships 280 MB.
   Keeps: images for published slugs + brand assets.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST_IMG = path.join(ROOT, 'dist/img');
const PUB = path.join(ROOT, 'content/published');
if (!fs.existsSync(DIST_IMG)) { console.log('no dist/img — nothing to prune'); process.exit(0); }

const live = new Set(fs.readdirSync(PUB).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)));

let kept = 0, removed = 0, freed = 0;
for (const file of fs.readdirSync(DIST_IMG)) {
  const slug = file.replace(/(-og)?\.(webp|jpg|png)$/, '');
  const fp = path.join(DIST_IMG, file);
  if (live.has(slug)) { kept++; continue; }
  freed += fs.statSync(fp).size;
  fs.unlinkSync(fp);
  removed++;
}

const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
console.log(`Pruned dist/img: kept ${kept} files for ${live.size} live profiles, removed ${removed} (${mb(freed)} freed)`);
