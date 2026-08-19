'use client';

/* ------------------------------------------------------------------
   dataLayer push helper.

   Every event the site reports goes through here, so the event names are
   in one place and GTM triggers can be built against a known list. Safe
   to call when GTM is not installed — it just fills an array nobody reads.

   Event names below are also what the Analytics screen lists, so keep the
   two in step if you add one.
-------------------------------------------------------------------*/

declare global {
  interface Window { dataLayer?: Record<string, unknown>[] }
}

export type TrackEvent =
  | 'cta_click'
  | 'project_card_click'
  | 'form_start'
  | 'form_submit'
  | 'tel_click'
  | 'email_click'
  | 'file_download'
  | 'scroll_90';

export function track(event: TrackEvent, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event,
    ...params,
    page_path: window.location.pathname,
  });
}
