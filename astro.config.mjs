import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { SITE } from './site.config.mjs';

/* Per-profile lastmod, read from the post the page is built from.

   This used to be `lastmod: new Date()`, which stamped every URL with the
   build time — so all 275 pages claimed to change on all 8 builds a day.
   Google treats lastmod as a recrawl hint and stops trusting one that is
   always "just now", which is the likely reason a title change took over
   two weeks to reach half the index. 03-generate-posts only moves a
   post's updatedAt when its content actually differs, so that date is the
   honest answer. */
const PUB = path.resolve(import.meta.dirname, 'content/published');
const lastmodBySlug = new Map();
if (fs.existsSync(PUB)) {
  for (const f of fs.readdirSync(PUB)) {
    if (!f.endsWith('.json')) continue;
    try {
      const p = JSON.parse(fs.readFileSync(path.join(PUB, f), 'utf8'));
      const d = p.updatedAt || p.publishedAt;
      if (d) lastmodBySlug.set(p.slug, new Date(`${d}T00:00:00Z`));
    } catch {}
  }
}
/* Listing pages have no post of their own; the newest profile is the last
   time their contents actually changed. */
const newest = [...lastmodBySlug.values()].sort((a, b) => b - a)[0] || new Date();

export default defineConfig({
  site: SITE.domain,
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  compressHTML: true,
  integrations: [
    sitemap({
      changefreq: 'weekly',
      entryLimit: 5000,
      filter: (page) => !/\/(search|404)\//.test(page),
      serialize(item) {
        if (item.url === SITE.domain + '/') item.priority = 1.0;
        else if (/\/(celebrities|category)\//.test(item.url)) item.priority = 0.6;
        else if (/\/(privacy|terms|dmca|disclaimer|contact|about)/.test(item.url)) item.priority = 0.2;
        else item.priority = 0.8;

        const slug = item.url.replace(SITE.domain, '').replace(/^\/|\/$/g, '');
        item.lastmod = lastmodBySlug.get(slug) || newest;
        return item;
      },
    }),
  ],
});
