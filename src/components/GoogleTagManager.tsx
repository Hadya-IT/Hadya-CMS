'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import {
  CONSENT_EVENT,
  consentModePayload,
  readConsentCookie,
  type ConsentState,
} from '@/lib/consent';

/* ------------------------------------------------------------------
   Google Tag Manager container, gated on consent.

   WHAT CHANGED AND WHY. This used to load the container unconditionally as
   a server component. Under PDPL that is the compliance gap: GTM sets
   cookies and contacts Google the moment it loads, which is processing that
   happens before the visitor has agreed to anything.

   THE TWO-LAYER APPROACH:

   1. Consent Mode v2 defaults are pushed with everything DENIED before any
      Google script exists. This is what makes tags configured for consent
      hold themselves back, and what Google's own tooling checks for.
   2. The container script itself is not injected until a decision exists.
      Belt and braces — layer 1 depends on every tag inside GTM being
      configured correctly by whoever administers the container, which this
      codebase cannot enforce.

   So: no decision, no network request. Decision made, container loads with
   the visitor's actual signals. Changing the choice later pushes an
   `update`, which GTM handles without a reload.

   Consent Mode needs the gtag `arguments` shape rather than a plain object
   push — a naive dataLayer.push({consent:...}) does not register.
-------------------------------------------------------------------*/

const VALID_ID = /^GTM-[A-Z0-9]+$/i;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/** Pushes a Consent Mode command in the array form GTM recognises. */
function pushConsent(mode: 'default' | 'update', state: ConsentState | null) {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  const command = ['consent', mode, consentModePayload(state)];
  window.dataLayer.push(command as unknown as Record<string, unknown>);
}

export default function GoogleTagManager({
  id,
  /** When false the container loads regardless of consent. Only pass this
   *  if the banner is switched off AND that decision has been signed off. */
  requireConsent = true,
}: {
  id?: string | null;
  requireConsent?: boolean;
}) {
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [ready, setReady] = useState(false);

  /* Defaults must land before the container, so this runs on mount whether
     or not a decision exists yet. */
  useEffect(() => {
    const existing = readConsentCookie();
    pushConsent('default', null);
    if (existing) pushConsent('update', existing);
    setConsent(existing);
    setReady(true);

    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<ConsentState>).detail;
      pushConsent('update', detail);
      setConsent(detail);
    };
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  if (!id || !VALID_ID.test(id)) return null;
  if (!ready) return null;

  const mayLoad = !requireConsent || consent !== null;
  if (!mayLoad) return null;

  return (
    <>
      <Script id="gtm-init" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${id}');`}
      </Script>
      {consent !== null && (
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${id}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
            title="Google Tag Manager"
          />
        </noscript>
      )}
    </>
  );
}
