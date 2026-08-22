# BioStar

A static celebrity-biography site built from **structured public records**, not
from rewritten articles. Every profile is assembled from Wikidata fields, every
image is free-licensed or drawn by us, and every page links its own sources.

**Deployment, domain and automation instructions: [DEPLOY.md](./DEPLOY.md)**

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:4321
```

## The pipeline

```
Semrush CSVs
     │  01-build-targets.mjs      rank + filter keywords → who is worth a page
     ▼
data/targets.json
     │  02-fetch-facts.mjs        Wikidata + Commons → verified fields
     │  02b-enrich-works.mjs      SPARQL → filmography / credited works
     ▼
data/facts/*.json
     │  03-generate-posts.mjs     facts → original English prose + FAQ + timeline
     ▼
content/queue/*.json
     │  04-make-covers.mjs        self-host portraits, build social cards
     │  05-publish-daily.mjs      drip 4/day (4 runs) → content/published/
     ▼
Astro build → dist/
```

| Command | What it does |
|---|---|
| `npm run targets` | Rebuild the ranked target list from the CSVs |
| `npm run fetch` | Pull facts from Wikidata + Commons (cached on disk) |
| `npm run generate` | Turn facts into posts; refreshes live pages in place |
| `npm run covers` | Download/encode images, build OG cards |
| `npm run publish` | Publish today's 5 |
| `npm run pipeline` | fetch → generate → covers |
| `npm run daily` | publish + build (what cron runs) |
| `npm run build` | Static build into `dist/` |

Useful flags:

```bash
TARGET_LIMIT=10000 npm run targets     # widen the pool
CACHE_DAYS=7 npm run fetch             # re-pull records older than a week
node scripts/05-publish-daily.mjs --seed 60   # bigger launch batch
node scripts/05-publish-daily.mjs --dry       # preview, change nothing
```

## Rebranding

Everything visible comes from **`site.config.mjs`** — name, domain, tagline,
nav, posts-per-day, analytics and AdSense IDs. Change the name there and
re-run `npm run covers` to redraw the brand assets.

## What the SEO layer does

- Static HTML, no client framework, one small stylesheet → strong Core Web Vitals
- Per-page `Person`, `ProfilePage`, `FAQPage`, `BreadcrumbList`, `ItemList` JSON-LD
- Canonicals, OG/Twitter cards with a generated 1200×630 image per profile
- Auto sitemap index (`@astrojs/sitemap`, 5k URLs per file), RSS, robots.txt
- Category hubs + A–Z index + 8 scored related links per profile for internal linking
- Ages recomputed at build time, so a daily rebuild keeps every page current

## Editorial guardrails (these are code, not just policy)

| Guardrail | Where |
|---|---|
| Adult / sexualised / body-measurement keywords dropped | `01-build-targets.mjs` |
| Wrong-person matches rejected (name-similarity check) | `02-fetch-facts.mjs` |
| Non-free images never downloaded | `lib/wiki.mjs` (`FREE` regex) |
| No invented net-worth figures | `03-generate-posts.mjs` |
| Caste / religion / health never published | not in the property map |
| Removal requests honoured | `data/blocklist.txt` |

## Data licensing

Facts come from **Wikidata** (CC0 — public domain). Portraits are used only
under public-domain, CC0, CC BY or CC BY-SA licences, re-encoded and
self-hosted, with photographer, licence and source credited under each image.
Profile prose is written by this repository's generator and is © BioStar.
