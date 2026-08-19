'use client';

import { useEffect, useState } from 'react';
import {
  CONSENT_VERSION,
  broadcastConsent,
  readConsentCookie,
  writeConsentCookie,
  type ConsentState,
} from '@/lib/consent';
import type { Locale, SiteSettings } from '@/lib/types';

/* ------------------------------------------------------------------
   The consent banner.

   DESIGN CONSTRAINTS THAT ARE NOT NEGOTIABLE, and why:

   - Decline is a real button, visually equal to Accept. Under PDPL (and
     GDPR) consent must be freely given; a styled-down "decline" link is the
     dark pattern regulators name explicitly.
   - Nothing is pre-ticked in Preferences. Opt-in means off by default.
   - Dismissing without choosing is NOT consent, so there is no X. The only
     ways out are Accept, Decline, or Save preferences.
   - It does not block the page. A modal overlay on a corporate site tanks
     bounce rate and is not required — a persistent bar is compliant.

   RENDERING. It returns null until the cookie has been read, which happens
   after mount. That avoids the flash where the banner appears for a
   returning visitor who already decided. The trade-off is that it cannot be
   server-rendered, which is fine: it is chrome, not content.
-------------------------------------------------------------------*/

export default function CookieConsent({
  settings,
  locale = 'en',
}: {
  settings: SiteSettings;
  locale?: Locale;
}) {
  const cfg = settings.consent;
  const [decided, setDecided] = useState<boolean | null>(null);
  const [showPrefs, setShowPrefs] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    setDecided(readConsentCookie() !== null);
  }, []);

  function commit(next: { analytics: boolean; marketing: boolean }) {
    const state: ConsentState = {
      version: CONSENT_VERSION,
      analytics: next.analytics,
      marketing: next.marketing,
      at: new Date().toISOString(),
    };
    writeConsentCookie(state);
    broadcastConsent(state);
    setDecided(true);
  }

  if (!cfg?.enabled) return null;
  if (decided === null || decided === true) return null;

  const ar = locale === 'ar';
  const title = (ar && cfg.titleAr?.trim() ? cfg.titleAr : cfg.title) || 'We use cookies';
  const body = (ar && cfg.bodyAr?.trim() ? cfg.bodyAr : cfg.body) || '';
  const prefsLabel = ar ? 'الخيارات' : 'Preferences';
  const saveLabel = ar ? 'حفظ الخيارات' : 'Save preferences';
  const necessaryLabel = ar ? 'ضرورية (دائمًا مفعّلة)' : 'Necessary (always on)';
  const analyticsLabel = ar ? 'التحليلات' : 'Analytics';
  const marketingLabel = ar ? 'التسويق والإعلانات' : 'Marketing and advertising';

  const BTN =
    'cursor-pointer border px-5 py-2.5 text-[11px] uppercase tracking-[0.16em] transition-colors ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold';

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={title}
      dir={ar ? 'rtl' : 'ltr'}
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-brand-line
        bg-brand-cream/97 backdrop-blur-sm print:hidden"
    >
      <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-5 py-5 md:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-[62ch]">
            <strong className="block font-serif text-[16px] text-brand-ink">{title}</strong>
            <p className="mt-1.5 text-[13px] leading-relaxed text-brand-ink-soft">
              {body}
              {cfg.policyHref && (
                <>
                  {' '}
                  <a
                    href={cfg.policyHref}
                    className="underline underline-offset-2 hover:text-brand-gold"
                  >
                    {cfg.policyLabel || (ar ? 'سياسة الخصوصية' : 'Privacy policy')}
                  </a>
                </>
              )}
            </p>
          </div>

          {/* Accept and Decline are the same size on purpose — see the note above. */}
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowPrefs((v) => !v)}
              aria-expanded={showPrefs}
              aria-controls="consent-prefs"
              className={`${BTN} border-brand-line bg-transparent text-brand-ink-soft
                hover:border-brand-ink hover:text-brand-ink`}
            >
              {prefsLabel}
            </button>
            <button
              type="button"
              onClick={() => commit({ analytics: false, marketing: false })}
              className={`${BTN} border-brand-ink bg-transparent text-brand-ink
                hover:bg-brand-ink hover:text-brand-cream`}
            >
              {cfg.rejectLabel || (ar ? 'رفض' : 'Decline')}
            </button>
            <button
              type="button"
              onClick={() => commit({ analytics: true, marketing: true })}
              className={`${BTN} border-brand-gold bg-brand-gold text-white
                hover:brightness-110`}
            >
              {cfg.acceptLabel || (ar ? 'قبول' : 'Accept')}
            </button>
          </div>
        </div>

        {showPrefs && (
          <div
            id="consent-prefs"
            className="grid gap-3 border-t border-brand-line pt-4 sm:grid-cols-3"
          >
            <label className="flex items-start gap-2.5 text-[12.5px] text-brand-ink-soft">
              <input type="checkbox" checked disabled className="mt-0.5 accent-brand-gold" />
              <span>
                <strong className="block text-brand-ink">{necessaryLabel}</strong>
                {ar
                  ? 'الجلسة وتسجيل الدخول وحفظ اختيارك هنا.'
                  : 'Session, sign-in, and remembering this choice.'}
              </span>
            </label>

            <label className="flex items-start gap-2.5 text-[12.5px] text-brand-ink-soft">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="mt-0.5 accent-brand-gold"
              />
              <span>
                <strong className="block text-brand-ink">{analyticsLabel}</strong>
                {ar ? 'كيف يُستخدم الموقع، بشكل مجمّع.' : 'How the site is used, in aggregate.'}
              </span>
            </label>

            <label className="flex items-start gap-2.5 text-[12.5px] text-brand-ink-soft">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="mt-0.5 accent-brand-gold"
              />
              <span>
                <strong className="block text-brand-ink">{marketingLabel}</strong>
                {ar ? 'قياس أداء الحملات الإعلانية.' : 'Measuring our advertising campaigns.'}
              </span>
            </label>

            <div className="sm:col-span-3">
              <button
                type="button"
                onClick={() => commit({ analytics, marketing })}
                className={`${BTN} border-brand-ink bg-brand-ink text-brand-cream
                  hover:brightness-125`}
              >
                {saveLabel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   A link editors can drop into the footer so a visitor can change their
   mind. Required in practice: consent has to be withdrawable as easily as
   it was given, and clearing a cookie by hand does not count.
-------------------------------------------------------------------*/

export function ConsentReopenLink({
  label = 'Cookie preferences',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        // Expiring the cookie brings the banner back on the next render.
        document.cookie = 'hadya_consent=; Path=/; Max-Age=0; SameSite=Lax';
        window.location.reload();
      }}
    >
      {label}
    </button>
  );
}
