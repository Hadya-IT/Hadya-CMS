import type { MetadataRoute } from 'next';
import { readContent } from '@/lib/store';
import { enabledLocales, localeHref, defaultLocale } from '@/lib/i18n';

/* ------------------------------------------------------------------
   /sitemap.xml, generated from the live document on request.

   WHY force-dynamic. Next would otherwise generate this once at build time,
   which is wrong for a CMS: publishing a page has to appear in the sitemap
   without a redeploy. The cost is one document read per crawler request,
   which is negligible against how often search engines fetch it.

   WHAT IS EXCLUDED, and deliberately:
     - draft pages (status !== 'published')
     - pages flagged noIndex in their SEO tab — a sitemap entry for a
       noindex page sends search engines contradictory instructions
     - /grid-demo, which ships as a component showcase

   ORIGIN. Taken from SITE_URL, falling back to NEXTAUTH_URL. Both must be
   the public origin, not localhost, or you will submit a sitemap full of
   localhost URLs — which is silently accepted and does nothing.
-------------------------------------------------------------------*/

export const dynamic = 'force-dynamic';

function origin(): string {
  const raw = (process.env.SITE_URL || process.env.NEXTAUTH_URL || '').trim();
  return raw.replace(/\/+$/, '') || 'http://localhost:3000';
}

/** Pages that exist for developers, not visitors. */
const EXCLUDED_SLUGS = new Set(['grid-demo']);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = origin();

  let doc;
  try {
    doc = await readContent();
  } catch (e) {
    // A sitemap that 500s gets the site penalised; an empty one does not.
    console.error('sitemap: could not read content:', e);
    return [];
  }

  const locales = enabledLocales(doc.settings);
  const primary = defaultLocale(doc.settings);

  const pages = doc.pages.filter(
    (p) => p.status === 'published' && !p.seo?.noIndex && !EXCLUDED_SLUGS.has(p.slug),
  );

  const entries: MetadataRoute.Sitemap = [];

  for (const page of pages) {
    for (const locale of locales) {
      /* hreflang alternates tell Google that /about-us and /ar/about-us are
         the same page in two languages rather than duplicates competing with
         each other. Without this, a bilingual site routinely has one locale
         suppressed from results. */
      const languages: Record<string, string> = {};
      for (const alt of locales) {
        languages[alt] = base + localeHref(page.slug, alt, doc.settings);
      }

      entries.push({
        url: base + localeHref(page.slug, locale, doc.settings),
        lastModified: page.updatedAt ? new Date(page.updatedAt) : new Date(),
        changeFrequency: page.slug === '' ? 'weekly' : 'monthly',
        // The homepage is the entry point; interior pages matter less. These
        // are hints only — search engines largely ignore them, but a
        // uniform 0.5 everywhere is worse than nothing.
        priority: page.slug === '' ? 1 : locale === primary ? 0.7 : 0.6,
        alternates: locales.length > 1 ? { languages } : undefined,
      });
    }
  }

  return entries;
}
