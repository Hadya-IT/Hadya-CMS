/* ------------------------------------------------------------------
   Consent state.

   PDPL, not GDPR. Saudi Arabia's Personal Data Protection Law is the
   regime that actually applies here, and its practical requirement is the
   same shape as the European one for our purposes: no non-essential
   tracking fires before the visitor agrees, and refusing has to be as
   easy as accepting. So the banner has a real Reject button that is the
   same size as Accept — not a greyed link.

   WHY A COOKIE AND NOT localStorage. The choice has to be readable by the
   server on the next request so the GTM snippet can be omitted entirely
   rather than injected and then held back. A cookie is sent with the
   document request; localStorage is not.

   This module is imported by both client and server code, so it must stay
   free of `server-only` and of any Node built-ins.
-------------------------------------------------------------------*/

export const CONSENT_COOKIE = 'hadya_consent';
export const CONSENT_VERSION = 1;

/** Categories. `necessary` is not negotiable and is not stored as a choice. */
export interface ConsentState {
  version: number;
  analytics: boolean;
  marketing: boolean;
  /** ISO timestamp of the decision — PDPL expects you to be able to show when. */
  at: string;
}

export const CONSENT_DENIED: ConsentState = {
  version: CONSENT_VERSION,
  analytics: false,
  marketing: false,
  at: '',
};

export function parseConsent(raw: string | undefined | null): ConsentState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw)) as Partial<ConsentState>;
    if (typeof v !== 'object' || v === null) return null;
    // A version bump invalidates old choices — that is the mechanism for
    // re-asking when you add a new tracking category.
    if (v.version !== CONSENT_VERSION) return null;
    return {
      version: CONSENT_VERSION,
      analytics: !!v.analytics,
      marketing: !!v.marketing,
      at: typeof v.at === 'string' ? v.at : '',
    };
  } catch {
    return null;
  }
}

export function serialiseConsent(state: ConsentState): string {
  return encodeURIComponent(JSON.stringify(state));
}

/* ----------------------------- client ----------------------------- */

export function readConsentCookie(): ConsentState | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(CONSENT_COOKIE + '='));
  return parseConsent(match?.slice(CONSENT_COOKIE.length + 1));
}

export function writeConsentCookie(state: ConsentState): void {
  if (typeof document === 'undefined') return;
  const oneYear = 60 * 60 * 24 * 365;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie =
    `${CONSENT_COOKIE}=${serialiseConsent(state)}; Path=/; Max-Age=${oneYear}; SameSite=Lax${secure}`;
}

export const CONSENT_EVENT = 'hadya:consent';

/** Notifies listeners in the same tab; the cookie alone fires no event. */
export function broadcastConsent(state: ConsentState): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ConsentState>(CONSENT_EVENT, { detail: state }));
}

/* ------------------------- Google Consent Mode ------------------------- */

/* Consent Mode v2 is how GTM is told what it may do. We push `default`
   with everything denied before the container loads, then `update` when a
   choice exists. Tags configured for consent then hold themselves back
   without us having to know which tags exist. */

export type ConsentSignal = 'granted' | 'denied';

export function consentModePayload(state: ConsentState | null) {
  const analytics: ConsentSignal = state?.analytics ? 'granted' : 'denied';
  const marketing: ConsentSignal = state?.marketing ? 'granted' : 'denied';
  return {
    ad_storage: marketing,
    ad_user_data: marketing,
    ad_personalization: marketing,
    analytics_storage: analytics,
    functionality_storage: 'granted' as ConsentSignal,
    security_storage: 'granted' as ConsentSignal,
  };
}
