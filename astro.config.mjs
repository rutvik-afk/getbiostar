import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
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

/* Static pages are not listings — /terms/ and /privacy-policy/ do not
   change because a cricketer was published. Falling back to `newest`
   had all seven of them claiming to change on every build, which is the
   same "always just now" signal the per-slug dates above exist to undo,
   on exactly the pages Google reads to judge whether a site is a real
   publisher. Their source file's last commit is the honest answer. */
const STATIC_PAGES = /^\/(about|contact|privacy-policy|terms|dmca|disclaimer|editorial-policy)\/$/;
const gitDate = (file) => {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], {
      cwd: import.meta.dirname, encoding: 'utf8',
    }).trim();
    return out ? new Date(out) : null;
  } catch { return null; }
};

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

        const route = item.url.replace(SITE.domain, '');
        const slug = route.replace(/^\/|\/$/g, '');
        item.lastmod = lastmodBySlug.get(slug)
          || (STATIC_PAGES.test(route) ? gitDate(`src/pages/${slug}.astro`) : null)
          || newest;
        return item;
      },
    }),
  ],
});
