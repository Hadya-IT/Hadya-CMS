'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { SiteSettings } from '@/lib/types';

/* Opening sequence, matched to the reference site: cream ground, emblem,
   the brand word, a gold rule drawing out, then the sub line. It lifts
   after the page has loaded plus the configured hold, with a hard cap so a
   slow asset can never trap the visitor behind it.

   Arabic is the default locale (unprefixed); English lives under /en. The
   layout that renders this has no locale of its own, so it reads the path. */

export default function Splash({ settings }: { settings: SiteSettings }) {
  const pathname = usePathname() || '/';
  const ar = !/^\/en(\/|$)/.test(pathname) && settings.locales?.enabled?.[0] === 'ar';
  const [done, setDone] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hold = reduce ? 300 : settings.splash.durationMs || 2300;
    const root = document.documentElement;
    root.style.overflow = 'hidden';
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setDone(true);
      root.style.overflow = '';
    };
    const timers: number[] = [];
    const onLoad = () => timers.push(window.setTimeout(finish, hold));
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });
    timers.push(window.setTimeout(finish, reduce ? 1500 : 4800));
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('load', onLoad);
      root.style.overflow = '';
    };
  }, [settings.splash.durationMs]);

  if (gone) return null;

  const word = (ar && settings.splash.wordAr) || settings.splash.word || settings.brandName;
  const sub = (ar && settings.splash.subAr) || settings.splash.sub;

  return (
    <div
      aria-hidden="true"
      dir={ar ? 'rtl' : 'ltr'}
      onTransitionEnd={() => done && setGone(true)}
      className={[
        'fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-[22px] bg-brand-cream',
        'transition-[opacity,visibility] duration-1000 ease-[cubic-bezier(.16,.84,.44,1)]',
        done ? 'invisible pointer-events-none opacity-0' : 'opacity-100',
      ].join(' ')}
    >
      {(settings.logoDark || settings.logoLight) && (
        <img
          src={settings.logoDark || settings.logoLight}
          alt=""
          className="splash-emb h-[54px] w-[54px] object-contain"
        />
      )}
      <div
        className={[
          'splash-word font-serif text-[clamp(34px,7vw,60px)] font-medium text-brand-ink',
          ar ? 'tracking-[.04em]' : 'ps-[.5em] tracking-[.5em]',
        ].join(' ')}
      >
        {word}
      </div>
      <div className="splash-line h-px bg-brand-gold" />
      <div
        className={[
          'splash-sub font-sans text-[10.5px] text-brand-gold',
          ar ? 'tracking-[.12em]' : 'ps-[.4em] uppercase tracking-[.4em]',
        ].join(' ')}
      >
        {sub}
      </div>
    </div>
  );
}