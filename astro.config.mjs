import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { SITE } from './site.config.mjs';

export default defineConfig({
  site: SITE.domain,
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  compressHTML: true,
  integrations: [
    sitemap({
      changefreq: 'weekly',
      lastmod: new Date(),
      entryLimit: 5000,
      filter: (page) => !/\/(search|404)\//.test(page),
      serialize(item) {
        if (item.url === SITE.domain + '/') item.priority = 1.0;
        else if (/\/(celebrities|category)\//.test(item.url)) item.priority = 0.6;
        else if (/\/(privacy|terms|dmca|disclaimer|contact|about)/.test(item.url)) item.priority = 0.2;
        else item.priority = 0.8;
        return item;
      },
    }),
  ],
});
