'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Locale, NavLink, SiteSettings } from '@/lib/types';
import { cx } from '@/components/site/ui';
import { enabledLocales, localeLabel, switchLocaleHref } from '@/lib/i18n';

/* Over a hero the header starts transparent with the light logo, then
   swaps to a solid cream bar with the dark logo once you scroll past it.
   On every other page it is solid from the start. */

export default function SiteHeader({
  settings,
  links,
  overHero,
  locale = 'en',
  /* The UNtranslated settings. The switch has to know which locales exist,
     and `settings` arrives already narrowed to the active one. */
  allSettings,
}: {
  settings: SiteSettings;
  links: NavLink[];
  overHero: boolean;
  locale?: Locale;
  allSettings?: SiteSettings;
}) {
  const pathname = usePathname();
  const localeSource = allSettings || settings;
  const locales = enabledLocales(localeSource);
  const showSwitch = locales.length > 1 && localeSource.locales?.showSwitch !== false;
  const transparentAllowed = overHero && settings.header.transparentOnHero !== false;
  const [scrolled, setScrolled] = useState(!transparentAllowed);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!transparentAllowed) {
      setScrolled(true);
      return;
    }
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [transparentAllowed]);

  /* The mobile panel is a fixed overlay, so background scrolling has to be
     locked while it is open or the page slides behind it. */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const logo = scrolled ? settings.logoDark : settings.logoLight;

  const linkBase =
    'text-eyebrow uppercase tracking-[0.16em] no-underline transition-colors ' +
    'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold';

  return (
    <header
      className={cx(
        'z-40 w-full transition-[background-color,box-shadow,border-color] duration-500',
        settings.header.sticky ? 'fixed inset-x-0 top-0' : 'absolute inset-x-0 top-0',
        scrolled
          ? 'border-b border-brand-line bg-brand-cream/95 backdrop-blur-md'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-[92px] max-w-site items-center justify-between gap-6 px-6 md:px-10">
        <Link
          href="/"
          className={cx(
            'flex shrink-0 items-center gap-3 no-underline',
            'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold',
          )}
        >
          {logo && <img src={logo} alt="" className="h-9 w-auto" />}
          <span
            className={cx(
              'font-serif text-lg tracking-[0.16em] uppercase transition-colors',
              scrolled ? 'text-brand-ink' : 'text-white',
            )}
          >
            {settings.brandName}
          </span>
        </Link>

        {/* desktop nav */}
        <nav className="hidden items-center gap-9 lg:flex">
          {links.map((l) => (
            <Link
              key={l.id}
              href={l.href}
              className={cx(
                linkBase,
                scrolled
                  ? 'text-brand-ink-soft hover:text-brand-gold'
                  : 'text-white/80 hover:text-white',
              )}
            >
              {l.label}
            </Link>
          ))}
          {showSwitch && (
            <div className="flex items-center gap-2" role="group" aria-label="Language">
              {locales.map((code) => {
                const on = code === locale;
                return (
                  <Link
                    key={code}
                    href={switchLocaleHref(pathname || '/', code, localeSource)}
                    hrefLang={code}
                    aria-current={on ? 'true' : undefined}
                    className={cx(
                      linkBase,
                      'px-1',
                      on
                        ? scrolled
                          ? 'text-brand-gold'
                          : 'text-white'
                        : scrolled
                          ? 'text-brand-ink-soft/60 hover:text-brand-gold'
                          : 'text-white/50 hover:text-white',
                    )}
                  >
                    {localeLabel(code)}
                  </Link>
                );
              })}
            </div>
          )}
          {settings.header.ctaLabel && (
            <Link
              href={settings.header.ctaHref || '/contact-us'}
              className={cx(
                linkBase,
                'border px-6 py-3',
                scrolled
                  ? 'border-brand-gold text-brand-gold hover:bg-brand-gold hover:text-brand-cream'
                  : 'border-white/45 text-white hover:bg-white hover:text-brand-navy',
              )}
            >
              {settings.header.ctaLabel}
            </Link>
          )}
        </nav>

        {/* burger */}
        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="relative z-50 flex size-10 shrink-0 flex-col items-center justify-center gap-[5px] lg:hidden"
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cx(
                'block h-px w-6 transition-all duration-300',
                open || scrolled ? 'bg-brand-ink' : 'bg-white',
                open && i === 0 && 'translate-y-[6px] rotate-45',
                open && i === 1 && 'scale-x-0 opacity-0',
                open && i === 2 && '-translate-y-[6px] -rotate-45',
              )}
            />
          ))}
        </button>
      </div>

      {/* mobile panel */}
      <nav
        className={cx(
          'fixed inset-0 z-40 flex flex-col items-center justify-center gap-7 bg-brand-cream',
          'transition-[opacity,visibility] duration-300 lg:hidden',
          open ? 'visible opacity-100' : 'invisible opacity-0',
        )}
      >
        {links.map((l) => (
          <Link
            key={l.id}
            href={l.href}
            onClick={() => setOpen(false)}
            tabIndex={open ? 0 : -1}
            className="font-serif text-2xl text-brand-ink no-underline hover:text-brand-gold"
          >
            {l.label}
          </Link>
        ))}
        {showSwitch && (
          <div className="mt-2 flex items-center gap-4" role="group" aria-label="Language">
            {locales.map((code) => (
              <Link
                key={code}
                href={switchLocaleHref(pathname || '/', code, localeSource)}
                hrefLang={code}
                onClick={() => setOpen(false)}
                tabIndex={open ? 0 : -1}
                aria-current={code === locale ? 'true' : undefined}
                className={cx(
                  'text-eyebrow uppercase tracking-[0.16em] no-underline',
                  code === locale ? 'text-brand-gold' : 'text-brand-ink-soft/60',
                )}
              >
                {localeLabel(code)}
              </Link>
            ))}
          </div>
        )}
        {settings.header.ctaLabel && (
          <Link
            href={settings.header.ctaHref || '/contact-us'}
            onClick={() => setOpen(false)}
            tabIndex={open ? 0 : -1}
            className="mt-2 border border-brand-gold px-7 py-3.5 text-eyebrow uppercase
              tracking-[0.18em] text-brand-gold no-underline hover:bg-brand-gold hover:text-brand-cream"
          >
            {settings.header.ctaLabel}
          </Link>
        )}
      </nav>
    </header>
  );
}
