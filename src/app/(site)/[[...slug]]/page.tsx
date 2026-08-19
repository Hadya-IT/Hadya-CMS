/* ================================================================
   4) src/app/(site)/[[...slug]]/page.tsx  —  FULL REPLACEMENT.
   Change vs your version: instead of 404ing on any non-published
   page, the route resolves what the visitor may see:
     - editors with ?preview=1  -> the working copy (drafts included)
     - everyone else            -> the page if published, otherwise
                                   its last published snapshot
     - draft never published    -> real 404 (nothing to show)
   ================================================================ */
import { notFound, redirect, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readContent, publicPage } from '@/lib/store';
import { envelopeToCss } from '@/lib/style';
import { matchRedirect } from '@/lib/redirects';
import {
  dirFor,
  enabledLocales,
  localeHref,
  splitLocale,
  t,
  translatePage,
  translateSettings,
} from '@/lib/i18n';
import BlockRenderer from '@/components/BlockRenderer';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import type { NavLink, Page } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Params = { slug?: string[] };

/* ------------------------------------------------------------------
   One route serves every page, in every locale.

   The locale is a path prefix stripped by splitLocale() rather than its own
   route segment — adding `[locale]` alongside this optional catch-all would
   be an ambiguous match. See lib/i18n.ts for the model.
-------------------------------------------------------------------*/

/**
 * Draft preview requires a signed-in editor. It used to be `?preview=1`
 * and nothing else, which meant anyone who guessed a slug could read
 * unpublished pages.
 */
async function mayPreview(requested: boolean): Promise<boolean> {
  if (!requested) return false;
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  return role === 'ADMIN' || role === 'EDITOR';
}

/** The slug this page answers to for anonymous visitors. A draft that was
 *  published before keeps answering at its published slug, even if the
 *  editor renamed the slug in the draft. Never-published drafts answer
 *  nowhere. */
function liveSlug(p: Page): string | null {
  if (p.status === 'published') return p.slug;
  return p.lastPublished ? p.lastPublished.slug : null;
}

/** Find the page for this request and resolve which version to render.
 *  Returns null when there is nothing the caller may see. */
function resolve(pages: Page[], target: string, preview: boolean): Page | null {
  const raw = pages.find(
    (p) => (preview && p.slug === target) || liveSlug(p) === target,
  );
  if (!raw) return null;
  if (preview) return raw; // editors see the working copy, drafts included
  return publicPage(raw); // published page itself, or its last snapshot
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const doc = await readContent();
  const { locale, slug: target } = splitLocale(slug, doc.settings);
  const preview = await mayPreview(sp?.preview === '1');

  const resolved = resolve(doc.pages, target, preview);
  if (!resolved) return { title: 'Not found' };

  const page = translatePage(resolved, locale);
  const settings = translateSettings(doc.settings, locale);
  const locales = enabledLocales(doc.settings);
  const base = (process.env.SITE_URL || process.env.NEXTAUTH_URL || '').trim().replace(/\/+$/, '');

  const languages: Record<string, string> = {};
  if (locales.length > 1) {
    for (const alt of locales) languages[alt] = localeHref(page.slug, alt, doc.settings);
  }

  return {
    title: page.seo?.title || `${page.title} · ${settings.brandName}`,
    description: page.seo?.description || settings.brandTagline,
    // A draft being previewed must never be indexed, whatever its SEO tab says.
    robots:
      page.seo?.noIndex || page.status !== 'published' || sp?.preview === '1'
        ? { index: false, follow: false }
        : undefined,
    openGraph: page.seo?.ogImage ? { images: [page.seo.ogImage] } : undefined,
    // Resolves the metadataBase warning and makes OG image paths absolute.
    metadataBase: base ? new URL(base) : undefined,
    alternates: locales.length > 1
      ? { canonical: localeHref(page.slug, locale, doc.settings), languages }
      : undefined,
  };
}

export default async function DynamicPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const doc = await readContent();
  const { locale, slug: target } = splitLocale(slug, doc.settings);
  const preview = await mayPreview(sp?.preview === '1');

  const resolved = resolve(doc.pages, target, preview);

  /* Nothing visible here — check the editor-managed redirects before
     404ing. Doing it in this order means a redirect can never shadow live
     content, so a mistyped rule is inert rather than catastrophic. */
  if (!resolved) {
    const requestPath = '/' + (slug || []).join('/');
    const hit = matchRedirect(doc.settings.redirects, requestPath);
    if (hit) {
      // Both of these throw, so nothing below runs.
      if (hit.permanent) permanentRedirect(hit.to);
      redirect(hit.to);
    }
    notFound();
  }

  const page = translatePage(resolved, locale);
  const settings = translateSettings(doc.settings, locale);
  const dir = dirFor(locale);

  /* Nav is built from what THIS visitor may see: editors in preview get
     working copies (drafts included); the public gets published pages and
     last-published snapshots — so a page dropped to draft neither
     vanishes from the menu nor leaks its unpublished title. */
  const navLinks: NavLink[] = [
    ...doc.pages
      .map((p) => (preview ? p : publicPage(p)))
      .filter((p): p is Page => !!p && p.showInNav)
      .sort((a, b) => a.navOrder - b.navOrder)
      .map((p) => {
        const tp = translatePage(p, locale);
        return {
          id: p.id,
          label: tp.navLabel || tp.title,
          href: localeHref(p.slug, locale, doc.settings),
        };
      }),
    ...(doc.settings.navExtra || []).map((l) => ({
      ...l,
      label: doc.settings.i18n?.[locale]?.navLabels?.[l.id] || l.label,
    })),
  ];

  const firstBlock = page.blocks.find((b) => !b.style?.hidden);
  const overHero = !!firstBlock && ['hero', 'imageBanner'].includes(firstBlock.type);

  return (
    /* Page-level style supplies inherited defaults (background, colour,
       fonts) for the whole document. Its padding must NOT be applied here:
       it would push the first section down and leave a band of page
       background sitting under the fixed header, making the header links
       unreadable. Spacing belongs to sections.

       `dir` is set here rather than on <html> because the root layout is
       shared with the admin portal, which is always LTR. Every logical CSS
       property in the site resolves against the nearest dir, so this is the
       correct scope — see docs/ARABIC.md for the one caveat (scrollbar
       side). */
    <div
      dir={dir}
      lang={locale}
      style={{ ...envelopeToCss(page.style, settings), paddingTop: 0, paddingBottom: 0 }}
    >
      <SiteHeader
        settings={settings}
        links={navLinks}
        overHero={overHero}
        locale={locale}
        allSettings={doc.settings}
      />
      <main className={overHero ? undefined : 'pt-[92px]'}>
        {page.blocks.map((b) => (
          <BlockRenderer
            key={b.id}
            block={b}
            settings={settings}
            media={doc.media}
            forms={doc.forms}
            locale={locale}
          />
        ))}
      </main>
      <SiteFooter settings={settings} />
      {/* Badge only makes sense in editor preview: the public never sees a
          non-published version any more. */}
      {preview && page.status !== 'published' && (
        <div
          className="fixed bottom-5 right-5 z-50 rounded-full bg-brand-navy px-4 py-2
            text-[11px] uppercase tracking-[0.16em] text-white shadow-lg"
        >
          {t(locale, 'draftPreview')}
        </div>
      )}
    </div>
  );
}
