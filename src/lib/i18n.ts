import { LOCALES, type Locale, type Page, type SiteSettings } from './types';

/* ------------------------------------------------------------------
   Locales, and how a translated page is assembled.

   THE MODEL. English is the canonical document. A locale stores only the
   fields somebody actually translated, in `page.i18n[locale]`, and every
   missing field falls through to English at render time. That means:

     - adding Arabic never duplicates the document or the media library
     - an untranslated section still renders (in English) instead of
       vanishing or showing an empty box
     - deleting a locale is a no-op on the English site

   The cost is that there is no way to have a section exist in Arabic and
   not in English. If you ever need genuinely divergent per-locale pages,
   that is a second `pages` array, not an extension of this.

   ROUTING. The default locale is unprefixed (`/about-us`) and every other
   locale is a path prefix (`/ar/about-us`). The prefix is stripped by
   splitLocale() inside the existing optional catch-all route, so no new
   route segment was added — that avoids a conflict with the `[[...slug]]`
   pattern that already matches everything.
-------------------------------------------------------------------*/

export { LOCALES };
export type { Locale };

export const DEFAULT_LOCALE: Locale = 'en';

export function enabledLocales(settings: SiteSettings): Locale[] {
  const list = settings.locales?.enabled;
  if (!list || !list.length) return [DEFAULT_LOCALE];
  // Guard against a settings save that dropped the default.
  return list.includes(DEFAULT_LOCALE) ? list : [DEFAULT_LOCALE, ...list];
}

export function defaultLocale(settings: SiteSettings): Locale {
  return enabledLocales(settings)[0];
}

export function isLocale(v: string | undefined): v is Locale {
  return !!v && LOCALES.some((l) => l.code === v);
}

export function dirFor(locale: Locale): 'ltr' | 'rtl' {
  return LOCALES.find((l) => l.code === locale)?.dir ?? 'ltr';
}

export function localeLabel(locale: Locale): string {
  return LOCALES.find((l) => l.code === locale)?.nativeLabel ?? locale;
}

/**
 * Splits a locale prefix off the front of a slug array.
 *   ['ar','about-us'] -> { locale: 'ar', slug: 'about-us' }
 *   ['about-us']      -> { locale: <default>, slug: 'about-us' }
 * An unknown first segment is treated as part of the slug, so a page
 * legitimately called `/fr-report` still resolves.
 */
export function splitLocale(
  segments: string[] | undefined,
  settings: SiteSettings,
): { locale: Locale; slug: string } {
  const parts = [...(segments || [])];
  const fallback = defaultLocale(settings);
  const head = parts[0];

  if (isLocale(head) && enabledLocales(settings).includes(head)) {
    parts.shift();
    return { locale: head, slug: parts.join('/') };
  }
  return { locale: fallback, slug: parts.join('/') };
}

/** Builds an href for a slug in a locale. The default locale is unprefixed. */
export function localeHref(slug: string, locale: Locale, settings: SiteSettings): string {
  const clean = (slug || '').replace(/^\/+/, '');
  const prefix = locale === defaultLocale(settings) ? '' : `/${locale}`;
  return clean ? `${prefix}/${clean}` : prefix || '/';
}

/** Rewrites an existing href into another locale, preserving the path. */
export function switchLocaleHref(
  pathname: string,
  to: Locale,
  settings: SiteSettings,
): string {
  const parts = pathname.split('/').filter(Boolean);
  if (isLocale(parts[0])) parts.shift();
  return localeHref(parts.join('/'), to, settings);
}

/* ------------------------- the overlay ------------------------- */

/**
 * Returns a copy of the page with `locale` translations merged over the
 * English values. Only non-empty strings override, so a blank field in the
 * translation editor means "not translated yet", not "make it blank".
 */
export function translatePage(page: Page, locale: Locale): Page {
  const tr = page.i18n?.[locale];
  if (!tr) return page;

  const pick = (translated: string | undefined, original: string | undefined) =>
    translated && translated.trim() ? translated : original;

  return {
    ...page,
    title: pick(tr.title, page.title) as string,
    navLabel: pick(tr.navLabel, page.navLabel),
    seo: {
      ...page.seo,
      title: pick(tr.seo?.title, page.seo?.title),
      description: pick(tr.seo?.description, page.seo?.description),
    },
    blocks: page.blocks.map((b) => {
      const fields = tr.blocks?.[b.id];
      if (!fields) return b;
      // Deep copy so list items can be overridden without touching English.
      const data = JSON.parse(JSON.stringify(b.data));
      for (const [key, value] of Object.entries(fields)) {
        if (typeof value !== 'string' || !value.trim()) continue;
        // 'items.0.title' addresses a field inside a list item.
        const path = key.split('.');
        let node: any = data;
        for (let i = 0; i < path.length - 1 && node != null; i++) node = node[path[i]];
        if (node != null && typeof node === 'object') node[path[path.length - 1]] = value;
      }
      return { ...b, data };
    }),
  };
}

/** Site-wide strings, with the same fall-through behaviour. */
export function translateSettings(settings: SiteSettings, locale: Locale): SiteSettings {
  const tr = settings.i18n?.[locale];
  if (!tr) return settings;
  return {
    ...settings,
    brandName: tr.brandName?.trim() || settings.brandName,
    brandTagline: tr.brandTagline?.trim() || settings.brandTagline,
    header: {
      ...settings.header,
      ctaLabel: tr.headerCtaLabel?.trim() || settings.header.ctaLabel,
    },
    footer: {
      ...settings.footer,
      copy: tr.footerCopy?.trim() || settings.footer.copy,
      links: (settings.footer.links || []).map((l) => ({
        ...l,
        label: tr.navLabels?.[l.id]?.trim() || l.label,
      })),
    },
  };
}

/* --------------------------- UI strings --------------------------- */

/* Chrome that is not editor content: form validation, the consent banner
   buttons, the draft badge. Kept here rather than in the CMS because an
   editor has no reason to translate "Sending…" and every reason to forget. */

const STRINGS = {
  en: {
    send: 'Send message',
    sending: 'Sending…',
    sent: 'Thank you — your message has been received.',
    sentSub: 'Our team will be in touch shortly.',
    sendAnother: 'Send another message',
    required: 'This field is required.',
    invalidEmail: 'Enter a valid email address.',
    genericError: 'Something went wrong. Please try again.',
    draftPreview: 'Draft preview',
    skipToContent: 'Skip to content',
    menu: 'Menu',
    close: 'Close',
    optional: 'optional',
  },
  ar: {
    send: 'إرسال الرسالة',
    sending: '…جارٍ الإرسال',
    sent: 'شكرًا لك — تم استلام رسالتك.',
    sentSub: 'سيتواصل معك فريقنا قريبًا.',
    sendAnother: 'إرسال رسالة أخرى',
    required: 'هذا الحقل مطلوب.',
    invalidEmail: 'أدخل بريدًا إلكترونيًا صحيحًا.',
    genericError: 'حدث خطأ ما. حاول مرة أخرى.',
    draftPreview: 'معاينة مسودة',
    skipToContent: 'الانتقال إلى المحتوى',
    menu: 'القائمة',
    close: 'إغلاق',
    optional: 'اختياري',
  },
} satisfies Record<Locale, Record<string, string>>;

export type UiKey = keyof typeof STRINGS.en;

export function t(locale: Locale, key: UiKey): string {
  return STRINGS[locale]?.[key] ?? STRINGS.en[key];
}