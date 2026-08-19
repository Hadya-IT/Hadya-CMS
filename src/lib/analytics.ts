import 'server-only';
import { buildSampleAnalytics, type AnalyticsPayload } from './analytics-sample';

/* ------------------------------------------------------------------
   Analytics source selection.

   'sample' — fabricated numbers from analytics-sample.ts. The default,
              because it is the only mode that works with no external
              account. Every payload carries isSample: true and the UI
              must show the sample banner.
   'ga4'    — not implemented. Reaching this throws rather than silently
              falling back to fabricated data, because a dashboard that
              quietly serves invented numbers when the real source is
              down is worse than one that shows an error.

   Set ANALYTICS_MODE=ga4 only once getGa4Analytics() is written.
-------------------------------------------------------------------*/

export type AnalyticsMode = 'sample' | 'ga4';

export function analyticsMode(): AnalyticsMode {
  return process.env.ANALYTICS_MODE === 'ga4' ? 'ga4' : 'sample';
}

export function gtmContainerId(): string | null {
  const id = (process.env.NEXT_PUBLIC_GTM_ID || '').trim();
  return /^GTM-[A-Z0-9]+$/i.test(id) ? id : null;
}

async function getGa4Analytics(): Promise<AnalyticsPayload> {
  /* To implement:
     1. npm i @google-analytics/data
     2. Create a GCP service account, grant it Viewer on the GA4 property
     3. GA4_PROPERTY_ID + GOOGLE_APPLICATION_CREDENTIALS in .env.local
     4. runReport() for the same shape this module returns
     Ads figures (impressions, CPC, spend) come from the Google Ads API,
     which is a separate credential and a separate approval process. */
  throw new Error(
    'ANALYTICS_MODE=ga4 is set but the GA4 client is not implemented. ' +
      'Set ANALYTICS_MODE=sample, or implement getGa4Analytics() in src/lib/analytics.ts.',
  );
}

export async function getAnalytics(rangeDays = 30): Promise<AnalyticsPayload> {
  if (analyticsMode() === 'ga4') return getGa4Analytics();
  return buildSampleAnalytics(rangeDays);
}

export type { AnalyticsPayload } from './analytics-sample';
