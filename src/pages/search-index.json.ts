import type { APIRoute } from 'astro';
import { allPosts } from '../lib/content.mjs';

export const GET: APIRoute = async () => {
  const idx = allPosts().map((p) => ({
    s: p.slug, n: p.name, r: p.role || '',
    i: p.image?.url || '', c: p.category,
  }));
  return new Response(JSON.stringify(idx), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
  });
};
