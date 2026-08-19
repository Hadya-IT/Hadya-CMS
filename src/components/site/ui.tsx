import type { AnchorHTMLAttributes, ReactNode } from 'react';

/* ------------------------------------------------------------------
   Site primitives.

   Every colour, font, size and space here resolves to a CSS custom
   property that the CMS writes at runtime — `tokensToCss()` on the layout
   wrapper, `envelopeToCss()` on each section. That is why these are
   utilities over variables rather than fixed values: one style panel in
   the admin has to be able to restyle any block without a rebuild.

   The variables and their Tailwind aliases are declared in app/globals.css.
-------------------------------------------------------------------*/

export const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

/** Section content column. Width is editor-controlled per section. */
export function Wrap({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx('mx-auto w-full max-w-sec px-6 md:px-10', className)}>{children}</div>
  );
}

/** Editor-controlled responsive columns. Three numbers, no breakpoints in
 *  the block components themselves. */
export const COLS =
  'grid gap-[var(--sec-gap)] grid-cols-[repeat(var(--cols-m,1),minmax(0,1fr))] ' +
  'md:grid-cols-[repeat(var(--cols-t,2),minmax(0,1fr))] ' +
  'lg:grid-cols-[repeat(var(--cols,3),minmax(0,1fr))]';

/** Heading treatment. `[text-transform:…]` is a variable, so it cannot be
 *  a plain `uppercase` utility. */
export const HEADING =
  'font-heading text-sec-heading tracking-sec [text-transform:var(--sec-heading-transform)]';

export function Eyebrow({
  tone = 'accent',
  className,
  children,
}: {
  tone?: 'accent' | 'light' | 'soft';
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        'mb-4 block text-eyebrow font-medium uppercase tracking-[0.22em]',
        tone === 'light' && 'text-white/70',
        tone === 'soft' && 'text-sec-text',
        tone === 'accent' && 'text-sec-accent',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** CMS headline strings may contain <em> for the accent, so they are set
 *  with dangerouslySetInnerHTML by the caller. `data-display` is the hook
 *  the base layer uses to style that <em>. */
export function H2({
  size = 'md',
  html,
  className,
}: {
  size?: 'md' | 'lg';
  html: string;
  className?: string;
}) {
  return (
    <h2
      data-display
      className={cx(
        HEADING,
        size === 'lg' ? 'text-h2-lg' : 'text-h2',
        'leading-[1.1] [text-wrap:balance]',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function H3({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <h3 className={cx(HEADING, 'text-h3 font-medium leading-snug', className)}>{children}</h3>
  );
}

/** Editor-authored HTML. `data-rich` is the hook for the paragraph, list
 *  and link rules in the base layer — that markup has no classes to target. */
export function Rich({
  html,
  className,
  style,
}: {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      data-rich
      style={style}
      className={cx('text-body leading-sec text-sec-text', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** Small caps label used above addresses and form groups. */
export function Label({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cx(
        'mb-2.5 block text-eyebrow uppercase tracking-[0.18em] text-sec-accent',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Outlined link-button. Hairline in the section's own line colour, filling
 *  with the accent on hover. */
export function GhostLink({
  href,
  className,
  target,
  rel,
  children,
  ...rest
}: {
  href: string;
  className?: string;
  target?: string;
  rel?: string;
  children: ReactNode;
  /* Extra attributes are forwarded so callers can add data-* hooks —
     analytics tagging in particular — without a wrapper component. */
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className' | 'target' | 'rel' | 'children'>) {
  return (
    <a
      {...rest}
      href={href}
      target={target}
      rel={rel}
      className={cx(
        'inline-flex items-center gap-2.5 border border-sec-line px-7 py-3.5',
        'text-eyebrow uppercase tracking-[0.18em] text-sec-heading no-underline',
        'transition-colors duration-300',
        'hover:border-sec-accent hover:bg-sec-accent hover:text-sec',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sec-accent',
        className,
      )}
    >
      {children}
    </a>
  );
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <span className={cx(HEADING, 'block text-stat leading-none')}>{value}</span>
      <span className="mt-2.5 block text-eyebrow uppercase tracking-[0.16em] text-sec-text">
        {label}
      </span>
    </div>
  );
}
