import type { CSSProperties } from 'react';
import type { StyleEnvelope, SiteSettings, FontKey } from './types';

export const DEFAULT_STYLE: StyleEnvelope = {
  theme: 'light',
  bgType: 'none',
  bgOverlay: 0,
  bodyScale: 1,
  headingScale: 1,
  paddingTop: 84,
  paddingBottom: 84,
  align: 'left',
  animation: 'fade-up',
  animationDuration: 900,
  animationDelay: 0,
};

const FONT_VAR: Record<Exclude<FontKey, ''>, string> = {
  serif: 'var(--font-serif)',
  sans: 'var(--font-sans)',
  arabicSerif: 'var(--font-ar-serif)',
  arabicSans: 'var(--font-ar-sans)',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

/** Theme presets give the admin a one-click starting point;
 *  every value below is still individually overridable. */
function themeColors(theme: string, s: SiteSettings) {
  const t = s.tokens;
  switch (theme) {
    case 'dark':
      return {
        bg: t.navy,
        text: 'rgba(255,255,255,.70)',
        heading: '#ffffff',
        accent: t.goldSoft,
        line: 'rgba(255,255,255,.14)',
      };
    case 'brand':
      return {
        bg: t.creamAlt,
        text: t.inkSoft,
        heading: t.ink,
        accent: t.gold,
        line: t.line,
      };
    case 'custom':
      return { bg: 'transparent', text: t.inkSoft, heading: t.ink, accent: t.gold, line: t.line };
    default:
      return { bg: t.cream, text: t.inkSoft, heading: t.ink, accent: t.gold, line: t.line };
  }
}

/**
 * Turns a style envelope into a `style` object of CSS custom properties.
 * Every block component reads only from these variables, which is what makes
 * a single style panel able to restyle any block.
 */
export function envelopeToCss(
  st: Partial<StyleEnvelope> | undefined,
  settings: SiteSettings,
): CSSProperties {
  const s: StyleEnvelope = { ...DEFAULT_STYLE, ...(st || {}) } as StyleEnvelope;
  const th = themeColors(s.theme, settings);
  const css: Record<string, string | number> = {};

  /* ---- background ---- */
  if (s.bgType === 'color') {
    css['--sec-bg'] = s.bgColor || th.bg;
    css.background = s.bgColor || th.bg;
  } else if (s.bgType === 'gradient') {
    const g = `linear-gradient(${s.bgGradientAngle ?? 160}deg, ${s.bgColor || th.bg}, ${
      s.bgColor2 || settings.tokens.creamAlt
    })`;
    css['--sec-bg'] = g;
    css.background = g;
  } else if (s.bgType === 'image' && s.bgImage) {
    const veil = (s.bgOverlay ?? 0) / 100;
    const layers = [
      veil > 0 ? `linear-gradient(rgba(8,10,18,${veil}), rgba(8,10,18,${veil}))` : null,
      `url("${s.bgImage}")`,
    ]
      .filter(Boolean)
      .join(', ');
    css.backgroundImage = layers;
    css.backgroundSize = 'cover';
    css.backgroundPosition = s.bgPosition || 'center';
    css.backgroundAttachment = s.bgFixed ? 'fixed' : 'scroll';
    css['--sec-bg'] = 'transparent';
  } else {
    css['--sec-bg'] = th.bg;
    css.background = th.bg;
  }

  /* ---- colour ---- */
  css['--sec-text'] = s.textColor || th.text;
  css['--sec-heading'] = s.headingColor || th.heading;
  css['--sec-accent'] = s.accentColor || th.accent;
  css['--sec-line'] = s.borderColor || th.line;
  css.color = 'var(--sec-text)';

  /* ---- typography ---- */
  css['--sec-body-font'] = s.bodyFont ? FONT_VAR[s.bodyFont] : 'var(--font-sans)';
  css['--sec-heading-font'] = s.headingFont ? FONT_VAR[s.headingFont] : 'var(--font-serif)';
  css['--sec-body-scale'] = String(s.bodyScale ?? 1);
  css['--sec-heading-scale'] = String(s.headingScale ?? 1);
  css['--sec-tracking'] = `${s.letterSpacing ?? 0}em`;
  css['--sec-leading'] = String(s.lineHeight ?? 1.6);
  css['--sec-heading-transform'] = s.uppercaseHeadings ? 'uppercase' : 'none';

  /* ---- spacing / layout ---- */
  css.paddingTop = `${s.paddingTop ?? 84}px`;
  css.paddingBottom = `${s.paddingBottom ?? 84}px`;
  css['--sec-gap'] = `${s.gap ?? 28}px`;
  css['--sec-max'] = `${s.maxWidth || settings.tokens.contentWidth || 1280}px`;
  css['--sec-align'] = s.align || 'left';
  css.textAlign = (s.align || 'left') as any;
  css['--sec-radius'] = `${s.radius ?? settings.tokens.radius ?? 4}px`;

  /* ---- motion ---- */
  css['--sec-anim-dur'] = `${s.animationDuration ?? 900}ms`;
  css['--sec-anim-delay'] = `${s.animationDelay ?? 0}ms`;

  return css as CSSProperties;
}

export function envelopeClasses(st: Partial<StyleEnvelope> | undefined): string {
  const s = { ...DEFAULT_STYLE, ...(st || {}) };
  return [
    /* Base section typography. Colour, background, padding and text-align
       arrive as inline styles from envelopeToCss(); these are the parts that
       need a utility rather than a property. */
    'relative isolate font-body text-body leading-sec tracking-sec',
    s.bgType === 'image' ? 'bg-cover bg-no-repeat' : '',
    s.hideOnMobile ? 'hidden md:block' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function tokensToCss(s: SiteSettings): CSSProperties {
  const t = s.tokens;
  return {
    '--cream': t.cream,
    '--cream-2': t.creamAlt,
    '--ink': t.ink,
    '--ink-soft': t.inkSoft,
    '--gold': t.gold,
    '--gold-soft': t.goldSoft,
    '--navy': t.navy,
    '--line': t.line,
    '--font-serif': t.serifFamily,
    '--font-sans': t.sansFamily,
    '--font-ar-serif': t.arabicSerifFamily,
    '--font-ar-sans': t.arabicSansFamily,
    '--base-size': `${t.baseFontSize}px`,
    '--content-width': `${t.contentWidth}px`,
    '--radius': `${t.radius}px`,
  } as CSSProperties;
}
