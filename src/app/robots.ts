import type { MetadataRoute } from 'next';

/* ------------------------------------------------------------------
   /robots.txt

   The important line is the staging guard. A staging or preview deployment
   that gets indexed competes with production for the same content and is
   the single most common way a corporate site loses ranking to itself. So
   unless SITE_URL is explicitly set, this file disallows everything —
   failing closed rather than open.

   Note what robots.txt does NOT do: it stops crawling, not indexing. A URL
   linked from elsewhere can still appear in results without being fetched.
   Per-page `noIndex` in the SEO tab is the mechanism for that, and it emits
   a real robots meta tag via generateMetadata.
-------------------------------------------------------------------*/

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const raw = (process.env.SITE_URL || '').trim().replace(/\/+$/, '');
  const isProduction = !!raw && !/localhost|127\.0\.0\.1|\.local/i.test(raw);

  if (!isProduction) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',          // the portal
          '/api/',           // no crawlable endpoints
          '/login',
          '/grid-demo',      // component showcase
          '/*?preview=1',    // draft previews
        ],
      },
    ],
    sitemap: `${raw}/sitemap.xml`,
    host: raw,
  };
}
