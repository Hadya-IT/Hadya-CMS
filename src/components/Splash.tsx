'use client';
import { useEffect, useState } from 'react';
import type { SiteSettings } from '@/lib/types';

/* Shown once per session. Purely decorative, so it is aria-hidden and
   removed from the flow the moment it finishes rather than left as an
   invisible overlay swallowing clicks. */

export default function Splash({ settings }: { settings: SiteSettings }) {
  const [done, setDone] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('splash_seen')) { setDone(true); setGone(true); return; }
    const t = setTimeout(() => {
      setDone(true);
      sessionStorage.setItem('splash_seen', '1');
    }, settings.splash.durationMs || 2200);
    return () => clearTimeout(t);
  }, [settings.splash.durationMs]);

  if (gone) return null;

  return (
    <div
      aria-hidden="true"
      onTransitionEnd={() => setGone(true)}
      className={[
        'fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-brand-navy',
        'transition-opacity duration-700 ease-out motion-reduce:transition-none',
        done ? 'pointer-events-none opacity-0' : 'opacity-100',
      ].join(' ')}
    >
      {settings.logoLight && <img src={settings.logoLight} alt="" className="h-12 w-auto" />}
      <div className="font-serif text-3xl uppercase tracking-[0.3em] text-white">
        {settings.splash.word || settings.brandName}
      </div>
      <div className="h-px w-16 bg-brand-gold-soft" />
      <div className="text-eyebrow uppercase tracking-[0.24em] text-white/55">
        {settings.splash.sub}
      </div>
    </div>
  );
}
