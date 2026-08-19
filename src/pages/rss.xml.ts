import rss from '@astrojs/rss';
import { SITE } from '../../site.config.mjs';
import { allPosts } from '../lib/content.mjs';

export async function GET() {
  const posts = allPosts().slice(0, 50);
  return rss({
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    site: SITE.domain,
    trailingSlash: true,
    items: posts.map((p) => ({
      title: p.title,
      description: p.metaDescription,
      link: `/${p.slug}/`,
      pubDate: new Date(p.publishedAt + 'T09:00:00Z'),
      categories: [p.category],
    })),
    customData: `<language>en-us</language><ttl>1440</ttl>`,
  });
}
