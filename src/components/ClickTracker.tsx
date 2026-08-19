'use client';

import { useEffect } from 'react';
import { track, type TrackEvent } from '@/lib/track';

/* ------------------------------------------------------------------
   One delegated listener for the whole page instead of a handler on
   every link. Any element carrying data-track="event_name" reports a
   click; add the attribute in a block component and nothing else is
   needed.

   Also fires scroll_90 once per page, which is the cheapest useful
   engagement signal — it separates "landed and left" from "actually read
   it" without any per-section instrumentation.
-------------------------------------------------------------------*/

export default function ClickTracker() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-track]');
      if (!el) return;
      const event = el.dataset.track as TrackEvent | undefined;
      if (!event) return;
      track(event, {
        link_label: el.dataset.trackLabel || el.textContent?.trim().slice(0, 80),
        link_url: (el as HTMLAnchorElement).href || undefined,
      });
    }

    function onAnchorClick(e: MouseEvent) {
      const a = (e.target as HTMLElement | null)?.closest('a');
      if (!a || a.dataset.track) return;
      const href = a.getAttribute('href') || '';
      if (href.startsWith('tel:')) track('tel_click', { link_url: href });
      else if (href.startsWith('mailto:')) track('email_click', { link_url: href });
      else if (/\.(pdf|docx?|xlsx?|pptx?|zip)$/i.test(href)) track('file_download', { link_url: href });
    }

    let deep = false;
    function onScroll() {
      if (deep) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max >= 0.9) {
        deep = true;
        track('scroll_90');
        window.removeEventListener('scroll', onScroll);
      }
    }

    document.addEventListener('click', onClick);
    document.addEventListener('click', onAnchorClick);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('click', onAnchorClick);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return null;
}
