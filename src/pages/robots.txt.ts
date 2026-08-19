import type { APIRoute } from 'astro';
import { SITE } from '../../site.config.mjs';

export const GET: APIRoute = () => new Response(
`User-agent: *
Allow: /
Disallow: /search/
Disallow: /search-index.json

# Crawl the whole archive — pages are static and cheap to serve.
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

Sitemap: ${SITE.domain}/sitemap-index.xml
`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
