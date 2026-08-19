import type { RedirectRule } from './types';

/* ------------------------------------------------------------------
   Editor-managed redirects.

   WHERE THEY RUN. In the public catch-all page, immediately before it
   calls notFound(). That placement is deliberate:

     - next.config.mjs `redirects()` would need a rebuild for every change,
       which defeats the point of putting them in the CMS
     - middleware.ts runs on the Edge runtime, which cannot reach oracledb,
       so it cannot read the rules at all

   The consequence is that a redirect only fires on a path that does not
   match a real page — so a rule can never shadow live content, and a typo
   in `from` is inert rather than catastrophic. If you later need to
   redirect a path that IS a page, delete or unpublish the page.

   MATCHING. Exact paths, plus a single trailing `/*` wildcard. A `/*` on
   both sides forwards the remainder: /news/* -> /insights/* turns
   /news/2024/q3 into /insights/2024/q3.
-------------------------------------------------------------------*/

const normalise = (p: string): string => {
  const trimmed = (p || '').trim();
  if (!trimmed) return '';
  const withSlash = trimmed.startsWith('/') || /^https?:\/\//i.test(trimmed) ? trimmed : '/' + trimmed;
  // Collapse duplicate slashes in the path portion and drop a trailing one.
  return withSlash.replace(/([^:]\/)\/+/g, '$1').replace(/\/+$/, '') || '/';
};

export interface RedirectMatch {
  to: string;
  permanent: boolean;
}

/**
 * Finds the first rule matching `pathname` (which must start with `/` and
 * carry no query string). Returns null when nothing matches.
 */
export function matchRedirect(
  rules: RedirectRule[] | undefined,
  pathname: string,
): RedirectMatch | null {
  if (!rules?.length) return null;
  const path = normalise(pathname);

  for (const rule of rules) {
    const from = normalise(rule.from);
    const to = (rule.to || '').trim();
    if (!from || !to) continue;

    // Never allow a rule that would redirect to itself — that is an
    // infinite loop the browser reports as ERR_TOO_MANY_REDIRECTS.
    if (from === normalise(to)) continue;

    if (from.endsWith('/*')) {
      const prefix = from.slice(0, -2);
      if (path === prefix || path.startsWith(prefix + '/')) {
        const rest = path.slice(prefix.length).replace(/^\//, '');
        const target = to.endsWith('/*')
          ? normalise(to.slice(0, -2) + (rest ? '/' + rest : ''))
          : to;
        if (normalise(target) === path) continue;
        return { to: target, permanent: rule.permanent !== false };
      }
      continue;
    }

    if (from === path) {
      return { to, permanent: rule.permanent !== false };
    }
  }
  return null;
}

/** Validation for the admin editor. Returns a message, or null when valid. */
export function validateRule(
  rule: Pick<RedirectRule, 'from' | 'to'>,
  existing: RedirectRule[],
  selfId?: string,
): string | null {
  const from = normalise(rule.from);
  const to = (rule.to || '').trim();

  if (!from || from === '/') return 'Enter the old path, e.g. /old-about.';
  if (/^https?:\/\//i.test(rule.from.trim())) return 'The old path must be a path, not a full URL.';
  if (!to) return 'Enter where it should go.';
  if (from === normalise(to)) return 'That would redirect the path to itself.';
  if (from.includes('*') && !from.endsWith('/*')) return 'A wildcard is only supported as a trailing /*.';
  if (to.includes('*') && !to.endsWith('/*')) return 'A wildcard is only supported as a trailing /*.';
  if (to.endsWith('/*') && !from.endsWith('/*')) return 'Use /* on the destination only when the source has it too.';
  if (from.startsWith('/admin')) return '/admin is the portal — redirecting it would lock you out.';
  if (from.startsWith('/api')) return '/api paths cannot be redirected.';

  const clash = existing.find((r) => r.id !== selfId && normalise(r.from) === from);
  if (clash) return `There is already a redirect from ${from}.`;

  // A -> B where B -> C exists is fine, but A -> B and B -> A is a loop.
  const reverse = existing.find(
    (r) => r.id !== selfId && normalise(r.from) === normalise(to) && normalise(r.to) === from,
  );
  if (reverse) return `That would create a loop with the existing rule ${reverse.from} → ${reverse.to}.`;

  return null;
}
