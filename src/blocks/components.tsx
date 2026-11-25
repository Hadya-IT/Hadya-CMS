import type { ReactElement, CSSProperties } from 'react';
import type { Block, FormDef, Locale, MediaItem, SiteSettings } from '@/lib/types';
import Reveal from '@/components/Reveal';
import ContactForm from '@/components/ContactForm';
import DynamicForm from '@/components/DynamicForm';
import { findForm } from '@/lib/formdefs';
import { backgroundImageValue } from '@/components/site/SmartImage';
import AccordionList from '@/components/AccordionList';
import {
  COLS,
  Eyebrow,
  GhostLink,
  H2,
  H3,
  HEADING,
  Label,
  Rich,
  Stat,
  Wrap,
  cx,
} from '@/components/site/ui';

export interface BlockProps {
  block: Block;
  settings: SiteSettings;
  /** Needed to resolve a stored image URL to its responsive renditions. */
  media?: MediaItem[];
  /** Editor-defined forms, for the `form` block. */
  forms?: FormDef[];
  locale?: Locale;
}

const html = (s?: string) => ({ __html: s || '' });

/* CSS background-image has no srcset, so image-set() is how a WebP
   rendition gets preferred over the original. Returns undefined for a
   missing image, which React drops from the style object. */
const bgFor = (src: string | undefined, media?: MediaItem[]) =>
  backgroundImageValue(src, media);

/** Grid column counts are emitted as CSS variables so the responsive
 *  utilities in COLS can pick the right one. Editors set three numbers; the
 *  component never hardcodes a breakpoint. */
function gridVars(d: any, dc = 3, tc = 2, mc = 1): CSSProperties {
  return {
    ['--cols' as any]: String(d.columns || dc),
    ['--cols-t' as any]: String(d.columnsTablet || tc),
    ['--cols-m' as any]: String(d.columnsMobile || mc),
  };
}

function anim(block: Block) {
  return {
    animation: block.style?.animation ?? 'fade-up',
    delay: block.style?.animationDelay ?? 0,
    duration: block.style?.animationDuration ?? 900,
  };
}

/** Full-bleed media layer shared by the hero and the banner. */
const MEDIA_LAYER = 'absolute inset-0 -z-10 bg-cover bg-center';

/* ------------------------------------------------------------------ HERO */
function Hero({ block, media }: BlockProps) {
  const bg = (src?: string) => bgFor(src, media);
  const d = block.data;
  const a = anim(block);
  /* Matches the reference landing: centred headline over a slow Ken Burns
     image, caption bottom-start and scroll cue bottom-end. Set the section
     alignment to Left in the style panel to get the old left-hand layout. */
  const left = block.style?.align === 'left';
  return (
    <div
      className={cx(
        'relative flex flex-col justify-center overflow-hidden',
        left ? 'items-start text-start' : 'items-center text-center',
      )}
      style={{ minHeight: `${d.height || 100}vh` }}
    >
      {d.image && (
        <div
          className={cx(
            MEDIA_LAYER,
            'scale-[1.04]',
            d.kenBurns && 'animate-kenburns motion-reduce:animate-none',
          )}
          style={{ backgroundImage: bg(d.image) }}
        />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(15_12_20/0.55)_0%,rgb(15_12_22/0.28)_32%,rgb(15_12_22/0.42)_70%,rgb(15_12_18/0.72)_100%)]"
      />

      <Wrap className={cx('relative', left ? '' : 'flex justify-center')}>
        <Reveal {...a} className={cx('max-w-[1000px]', left ? '' : 'mx-auto')}>
          {d.eyebrow && (
            <Eyebrow tone="light" className="!mb-[30px] block">
              {d.eyebrow}
            </Eyebrow>
          )}
          <h1
            data-display
            className={cx(
              HEADING,
              'text-[calc(clamp(42px,7vw,96px)*var(--sec-heading-scale,1))] font-medium leading-[1.02] [text-wrap:balance]',
            )}
            dangerouslySetInnerHTML={html(d.title)}
          />
          {d.subtitle && (
            <p
              className={cx(
                'mt-8 max-w-[52ch] text-[clamp(14px,1.4vw,16px)] font-light leading-[1.7] text-white/80',
                left ? '' : 'mx-auto',
              )}
            >
              {d.subtitle}
            </p>
          )}
          {d.ctaLabel && (
            <GhostLink href={d.ctaHref || '#'} className="mt-9">
              {d.ctaLabel}
            </GhostLink>
          )}
        </Reveal>
      </Wrap>

      {(d.captionTitle || d.scrollLabel) && (
        <div className="absolute inset-x-0 bottom-0 z-[3] mx-auto flex max-w-[1280px] items-end justify-between px-[clamp(24px,5vw,56px)] pb-[38px] text-start">
          <div>
            {d.captionTitle && (
              <span className="block font-heading text-[19px] text-white">{d.captionTitle}</span>
            )}
            {d.captionSub && (
              <small className="mt-1.5 block font-sans text-[10.5px] uppercase tracking-[.22em] text-white/55">
                {d.captionSub}
              </small>
            )}
          </div>
          {d.scrollLabel && (
            <div className="flex items-center gap-3 font-sans text-[10.5px] uppercase tracking-[.24em] text-white/60 after:h-px after:w-[46px] after:bg-white/50 after:content-['']">
              {d.scrollLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- IMAGE BANNER */
function ImageBanner({ block, media }: BlockProps) {
  const bg = (src?: string) => bgFor(src, media);
  const d = block.data;
  const a = anim(block);
  const veil = (d.overlay ?? 50) / 100;
  return (
    <div
      className="relative flex items-center overflow-hidden"
      style={{ minHeight: `${d.height || 52}vh` }}
    >
      {d.image && (
        <div className={MEDIA_LAYER} style={{ backgroundImage: bg(d.image) }} />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background: `linear-gradient(180deg, rgba(8,10,18,${veil * 0.8}), rgba(8,10,18,${veil}))`,
        }}
      />
      <Wrap className="relative py-24 pt-[116px]">
        <Reveal {...a}>
          {d.eyebrow && <Eyebrow tone="light">{d.eyebrow}</Eyebrow>}
          <h1
            data-display
            className={cx(HEADING, 'text-h2-lg leading-[1.08] [text-wrap:balance]')}
            dangerouslySetInnerHTML={html(d.title)}
          />
          {d.subtitle && (
            <p className="mt-5 max-w-[52ch] text-lede leading-sec text-sec-text">{d.subtitle}</p>
          )}
        </Reveal>
      </Wrap>
    </div>
  );
}

/* ------------------------------------------------------------- RICH TEXT */
function RichText({ block }: BlockProps) {
  const d = block.data;
  const a = anim(block);
  const cols = Number(d.columns || 1);
  return (
    <Wrap>
      <Reveal {...a}>
        {d.eyebrow && <Eyebrow>{d.eyebrow}</Eyebrow>}
        {d.heading && <H2 html={d.heading} className="mb-7" />}
        <Rich
          html={d.body}
          className={cx(cols > 1 && 'gap-x-12')}
          style={{
            maxWidth: `${d.measure || 62}ch`,
            columnCount: cols > 1 ? cols : undefined,
            marginInline: block.style?.align === 'center' ? 'auto' : undefined,
          }}
        />
      </Reveal>
    </Wrap>
  );
}

/* --------------------------------------------------------- SPLIT FEATURE */
const FLOW_PATH =
  'M150,-20 C150,50 150,90 150,130 C150,170 200,178 200,142 C200,112 162,110 162,150 ' +
  'C162,188 150,206 150,246 C150,320 150,360 150,416 C150,470 100,482 100,522 C100,558 150,560 150,522 ' +
  'C150,488 108,490 108,530 C112,600 150,652 150,732 C150,832 150,912 150,1020';

function SplitFeature({ block, media }: BlockProps) {
  const bg = (src?: string) => bgFor(src, media);
  const d = block.data;
  const a = anim(block);
  const left = d.mediaSide === 'left';
  return (
    <div className="relative">
      {d.showFlowLine && (
        <div
          className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-[300px] -translate-x-1/2 lg:block"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 300 1000"
            preserveAspectRatio="xMidYMid slice"
            fill="none"
            className="size-full"
          >
            <path d={FLOW_PATH} className="stroke-sec-line" strokeWidth={1} />
            <path
              d={FLOW_PATH}
              pathLength={1000}
              strokeDasharray="130 870"
              strokeWidth={1.5}
              className="animate-flow stroke-sec-accent motion-reduce:animate-none"
            />
          </svg>
        </div>
      )}

      <Wrap
        className={cx(
          'relative grid items-center gap-[var(--sec-gap)] lg:grid-cols-2',
          left && '[&>*:first-child]:lg:order-2',
        )}
      >
        <div>
          <Reveal {...a}>
            {d.eyebrow && <Eyebrow>{d.eyebrow}</Eyebrow>}
            {d.statement && (
              <h2
                data-display
                className={cx(HEADING, 'text-h2 leading-[1.12] [text-wrap:balance]')}
                dangerouslySetInnerHTML={html(d.statement)}
              />
            )}
            {d.body && (
              <p className="mt-6 max-w-[52ch] text-body leading-sec text-sec-text">{d.body}</p>
            )}
          </Reveal>

          {Array.isArray(d.stats) && d.stats.length > 0 && (
            <Reveal
              {...a}
              className="mt-11 flex flex-wrap gap-x-14 gap-y-8 border-t border-sec-line pt-8"
            >
              {d.stats.map((s: any, i: number) => (
                <Stat key={i} value={s.value} label={s.label} />
              ))}
            </Reveal>
          )}
        </div>

        <Reveal {...a}>
          {d.image && (
            <div
              className={cx(
                'aspect-[4/5] w-full rounded-sec bg-cover bg-center',
                d.tilt && 'rotate-[-1.5deg] transition-transform duration-700 hover:rotate-0',
              )}
              style={{ backgroundImage: bg(d.image) }}
              role="img"
              aria-label={d.imageCaption || ''}
            />
          )}
          {(d.imageCaption || d.imageSub) && (
            <div className="mt-4 flex flex-col gap-1 border-t border-sec-line pt-4">
              {d.imageCaption && (
                <span className="text-eyebrow uppercase tracking-[0.18em] text-sec-heading">
                  {d.imageCaption}
                </span>
              )}
              {d.imageSub && <span className="text-eyebrow text-sec-text">{d.imageSub}</span>}
            </div>
          )}
        </Reveal>
      </Wrap>
    </div>
  );
}

/* ------------------------------------------------------------ STATS BAND */
function StatsBand({ block }: BlockProps) {
  const d = block.data;
  const a = anim(block);
  return (
    <Wrap>
      {d.heading && (
        <Reveal {...a}>
          <H2 html={d.heading} className="mb-12" />
        </Reveal>
      )}
      <div
        className={cx(COLS, d.divider && 'divide-sec-line lg:divide-x')}
        style={gridVars(d, 4, 2, 2)}
      >
        {(d.items || []).map((s: any, i: number) => (
          <Reveal {...a} index={i} key={i} className={cx(d.divider && 'lg:px-8 lg:first:pl-0')}>
            <Stat value={s.value} label={s.label} />
          </Reveal>
        ))}
      </div>
    </Wrap>
  );
}

/* -------------------------------------------------------------- CARD GRID */
function CardGrid({ block, media }: BlockProps) {
  const bg = (src?: string) => bgFor(src, media);
  const d = block.data;
  const a = anim(block);
  return (
    <Wrap>
      {(d.heading || d.eyebrow) && (
        <Reveal
          {...a}
          className={cx(
            'mb-12',
            d.headingSide === 'split' &&
              'flex flex-col justify-between gap-6 md:flex-row md:items-end',
          )}
        >
          {d.heading && <H2 html={d.heading} />}
          {d.eyebrow && <Eyebrow className="mb-0">{d.eyebrow}</Eyebrow>}
        </Reveal>
      )}

      <div className={COLS} style={gridVars(d, 4, 2, 1)}>
        {(d.items || []).map((it: any, i: number) => {
          const inner = (
            <>
              {it.image && (
                <div
                  className="w-full rounded-sec bg-cover bg-center"
                  style={{ backgroundImage: bg(it.image), aspectRatio: d.ratio || '3/4' }}
                  role="img"
                  aria-label={it.title || ''}
                />
              )}
              <div className="mt-5 flex items-baseline gap-3">
                {d.showNumbers && (
                  <span className="font-mono text-eyebrow text-sec-accent">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                )}
                <H3>{it.title}</H3>
              </div>
              {it.body && (
                <p className="mt-2.5 text-body leading-sec text-sec-text">{it.body}</p>
              )}
            </>
          );
          return (
            <Reveal {...a} index={i} key={i} as="article" className="group">
              {it.href ? (
                <a
                  href={it.href}
                  className="block no-underline transition-opacity hover:opacity-85
                    focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sec-accent"
                >
                  {inner}
                </a>
              ) : (
                inner
              )}
            </Reveal>
          );
        })}
      </div>
    </Wrap>
  );
}

/* -------------------------------------------------------------- WORK GRID */
function WorkGrid({ block, media }: BlockProps) {
  const bg = (src?: string) => bgFor(src, media);
  const d = block.data;
  const a = anim(block);
  return (
    <Wrap>
      <div className="mb-14 flex flex-col justify-between gap-8 md:flex-row md:items-end">
        <Reveal {...a}>
          {d.eyebrow && <Eyebrow tone="soft">{d.eyebrow}</Eyebrow>}
          {d.heading && <H2 size="lg" html={d.heading} />}
        </Reveal>
        {d.ctaLabel && (
          <Reveal {...a}>
            <GhostLink href={d.ctaHref || '#'}>
              <span aria-hidden="true" className="text-sec-accent">&rsaquo;</span> {d.ctaLabel}
            </GhostLink>
          </Reveal>
        )}
      </div>

      <div
        className={cx(COLS, d.stagger && '[&>*:nth-child(even)]:lg:mt-20')}
        style={gridVars(d, 2, 2, 1)}
      >
        {(d.items || []).map((it: any, i: number) => {
          const inner = (
            <>
              <div className="overflow-hidden rounded-sec">
                <div
                  className="aspect-[4/3] w-full bg-cover bg-center transition-transform
                    duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
                  style={{ backgroundImage: bg(it.image) }}
                  role="img"
                  aria-label={it.title || ''}
                />
              </div>
              <div className="mt-5 flex items-baseline justify-between gap-4 border-t border-sec-line pt-4">
                <span className="text-eyebrow uppercase tracking-[0.18em] text-sec-accent">
                  {it.kicker}
                </span>
                <span className="font-mono text-eyebrow text-sec-text">{it.meta}</span>
              </div>
              <h3 className={cx(HEADING, 'mt-3 text-h3 font-medium leading-snug')}>{it.title}</h3>
            </>
          );
          return (
            <Reveal {...a} index={i} key={i} as="figure" className="group">
              {it.href ? (
                <a
                  href={it.href}
                  className="block no-underline focus-visible:outline-2
                    focus-visible:outline-offset-4 focus-visible:outline-sec-accent"
                >
                  {inner}
                </a>
              ) : (
                inner
              )}
            </Reveal>
          );
        })}
      </div>
    </Wrap>
  );
}

/* ---------------------------------------------------------------- PROFILE */
function Profile({ block, media }: BlockProps) {
  const bg = (src?: string) => bgFor(src, media);
  const d = block.data;
  const a = anim(block);
  const left = d.mediaSide === 'left';
  return (
    <Wrap
      className={cx(
        'grid items-center gap-[var(--sec-gap)] lg:grid-cols-[1.1fr_0.9fr]',
        left && '[&>*:first-child]:lg:order-2',
      )}
    >
      <div>
        <Reveal {...a}>
          {d.eyebrow && <Eyebrow>{d.eyebrow}</Eyebrow>}
          {d.heading && <H2 html={d.heading} />}
          {d.body && (
            <p className="mt-6 max-w-[54ch] text-body leading-sec text-sec-text">{d.body}</p>
          )}
        </Reveal>
      </div>

      <Reveal {...a}>
        {d.image && (
          <div
            className="aspect-[3/4] w-full rounded-sec bg-cover bg-center"
            style={{ backgroundImage: bg(d.image) }}
            role="img"
            aria-label={d.name || ''}
          />
        )}
        <div className="mt-5 border-t border-sec-line pt-4">
          {d.label && <Label className="mb-1.5">{d.label}</Label>}
          {d.name && <div className={cx(HEADING, 'text-h3 font-medium')}>{d.name}</div>}
          {d.role && <div className="mt-1 text-eyebrow text-sec-text">{d.role}</div>}
        </div>
      </Reveal>
    </Wrap>
  );
}

/* ------------------------------------------------------------- LINK CARDS */
function LinkCards({ block }: BlockProps) {
  const d = block.data;
  const a = anim(block);
  return (
    <Wrap>
      <div className="mb-12 max-w-[60ch]">
        <Reveal {...a}>
          {d.eyebrow && <Eyebrow>{d.eyebrow}</Eyebrow>}
          {d.heading && <H2 html={d.heading} />}
        </Reveal>
        {d.description && (
          <Reveal {...a}>
            <p className="mt-5 text-body leading-sec text-sec-text">{d.description}</p>
          </Reveal>
        )}
      </div>

      <div className={COLS} style={gridVars(d, 3, 2, 1)}>
        {(d.items || []).map((it: any, i: number) => (
          <Reveal {...a} index={i} key={i}>
            <a
              href={it.href || '#'}
              className="group flex h-full flex-col rounded-sec border border-sec-line p-8
                no-underline transition-colors duration-300 hover:border-sec-accent
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sec-accent"
            >
              {it.kicker && (
                <span className="text-eyebrow uppercase tracking-[0.18em] text-sec-accent">
                  {it.kicker}
                </span>
              )}
              <h3 className={cx(HEADING, 'mt-4 text-h3 font-medium leading-snug')}>{it.title}</h3>
              <span className="mt-auto pt-8 text-eyebrow uppercase tracking-[0.18em] text-sec-text transition-colors group-hover:text-sec-accent">
                {d.readLabel || 'Read →'}
              </span>
            </a>
          </Reveal>
        ))}
      </div>
    </Wrap>
  );
}

/* ---------------------------------------------------------------- GALLERY */
function Gallery({ block, media }: BlockProps) {
  const bg = (src?: string) => bgFor(src, media);
  const d = block.data;
  const a = anim(block);
  return (
    <Wrap>
      {d.heading && (
        <Reveal {...a}>
          <H2 html={d.heading} className="mb-12" />
        </Reveal>
      )}
      <div className={COLS} style={gridVars(d, 3, 2, 2)}>
        {(d.items || []).map((it: any, i: number) => (
          <Reveal {...a} index={i} key={i} as="figure">
            <div
              className="w-full rounded-sec bg-cover bg-center"
              style={{ backgroundImage: bg(it.image), aspectRatio: d.ratio || '4/3' }}
              role="img"
              aria-label={it.caption || ''}
            />
            {it.caption && (
              <figcaption className="mt-3 text-eyebrow text-sec-text">{it.caption}</figcaption>
            )}
          </Reveal>
        ))}
      </div>
    </Wrap>
  );
}

/* -------------------------------------------------------------- ACCORDION */
function Accordion({ block }: BlockProps) {
  const d = block.data;
  const a = anim(block);
  return (
    <Wrap>
      <Reveal {...a} className="max-w-[60ch]">
        {d.eyebrow && <Eyebrow>{d.eyebrow}</Eyebrow>}
        {d.heading && <H2 html={d.heading} />}
      </Reveal>
      <AccordionList items={d.items || []} />
    </Wrap>
  );
}

/* --------------------------------------------------------------- CTA BAND */
function CtaBand({ block }: BlockProps) {
  const d = block.data;
  const a = anim(block);
  const centred = d.layout === 'centred';
  return (
    <Wrap
      className={cx(
        'flex gap-10',
        centred
          ? 'flex-col items-center text-center'
          : 'flex-col justify-between md:flex-row md:items-end',
      )}
    >
      <Reveal {...a} className={cx(centred ? 'max-w-[54ch]' : 'max-w-[46ch]')}>
        {d.eyebrow && <Eyebrow tone="soft">{d.eyebrow}</Eyebrow>}
        {d.heading && <H2 size="lg" html={d.heading} />}
        {d.body && <p className="mt-5 text-lede leading-sec text-sec-text">{d.body}</p>}
      </Reveal>
      {d.buttonLabel && (
        <Reveal {...a} className="shrink-0">
          <GhostLink
            href={d.buttonHref || '#'}
            target={d.newTab ? '_blank' : undefined}
            rel={d.newTab ? 'noopener' : undefined}
            data-track="cta_click"
            data-track-label={d.buttonLabel}
          >
            {d.buttonLabel}
          </GhostLink>
        </Reveal>
      )}
    </Wrap>
  );
}

/* ---------------------------------------------------------------- CONTACT */
function Contact({ block }: BlockProps) {
  const d = block.data;
  const a = anim(block);
  return (
    <Wrap>
      <div className="grid gap-[var(--sec-gap)] lg:grid-cols-2">
        <Reveal {...a}>
          {d.eyebrow && <Eyebrow>{d.eyebrow}</Eyebrow>}
          {d.heading && (
            <h2
              data-display
              className={cx(HEADING, 'text-h2 leading-[1.12] [text-wrap:balance]')}
              dangerouslySetInnerHTML={html(d.heading)}
            />
          )}
          <div className="mt-9">
            {d.hqLabel && <Label>{d.hqLabel}</Label>}
            <Rich html={d.address} className="max-w-[34ch]" />
            {d.showMap && d.mapEmbed && (
              <div className="mt-7 aspect-[16/10] w-full overflow-hidden rounded-sec border border-sec-line">
                <iframe
                  title="Location"
                  loading="lazy"
                  src={d.mapEmbed}
                  className="size-full border-0"
                />
              </div>
            )}
          </div>
        </Reveal>

        <Reveal {...a} className="lg:pl-10">
          {d.inquiriesLabel && <Label>{d.inquiriesLabel}</Label>}
          {d.email && (
            <a
              href={`mailto:${d.email}`}
              dir="ltr"
              className={cx(
                HEADING,
                'block text-h3 no-underline transition-colors hover:text-sec-accent',
              )}
            >
              {d.email}
            </a>
          )}
          {d.phone && (
            <a
              href={`tel:${String(d.phone).replace(/\s/g, '')}`}
              dir="ltr"
              className="mt-2.5 block text-body text-sec-text no-underline transition-colors hover:text-sec-accent"
            >
              {d.phone}
            </a>
          )}
        </Reveal>
      </div>

      {d.showForm && (
        <Reveal {...a}>
          <ContactForm label={d.formLabel} button={d.formButton} email={d.email} />
        </Reveal>
      )}
    </Wrap>
  );
}

/* ---------------------------------------------------------- PRODUCT GRID */
function ProductGrid({ block, media }: BlockProps) {
  const bg = (src?: string) => bgFor(src, media);
  const d = block.data;
  const a = anim(block);
  const style: string = d.cardStyle || 'below';
  const overlay = ['overlay', 'overlay-bottom', 'overlay-hover'].includes(style);
  const veil = (d.overlayStrength ?? 45) / 100;

  return (
    <Wrap>
      {(d.eyebrow || d.heading) && (
        <Reveal {...a} className="mb-12">
          {d.eyebrow && <Eyebrow>{d.eyebrow}</Eyebrow>}
          {d.heading && <H2 html={d.heading} />}
        </Reveal>
      )}

      <div className={COLS} style={gridVars(d, 3, 2, 1)}>
        {(d.items || []).map((it: any, i: number) => {
          const text = (
            <div
              className={cx(
                overlay
                  ? cx(
                      'absolute inset-x-0 bottom-0 z-10 p-7',
                      style === 'overlay' && 'top-0 flex flex-col justify-end',
                      style === 'overlay-hover' &&
                        'opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-within:opacity-100',
                    )
                  : 'mt-5',
              )}
            >
              {d.showTag && it.tag && (
                <span className="mb-2.5 block text-eyebrow uppercase tracking-[0.18em] text-sec-accent">
                  {it.tag}
                </span>
              )}
              {it.title && (
                <h3 className={cx(HEADING, 'text-h3 font-medium leading-snug')}>{it.title}</h3>
              )}
              {d.showBody && it.body && (
                <p className="mt-2 text-body leading-sec text-sec-text">{it.body}</p>
              )}
              {((d.showPrice && it.price) || d.ctaLabel) && (
                <div className="mt-4 flex items-baseline justify-between gap-4">
                  {d.showPrice && it.price && (
                    <span className={cx(HEADING, 'text-body font-medium')}>{it.price}</span>
                  )}
                  {d.ctaLabel && (
                    <span className="text-eyebrow uppercase tracking-[0.18em] text-sec-accent">
                      {d.ctaLabel}
                    </span>
                  )}
                </div>
              )}
            </div>
          );

          const inner = (
            <>
              <div
                className="relative overflow-hidden rounded-sec"
                style={{ aspectRatio: d.ratio || '1/1' }}
              >
                {it.image && (
                  <div
                    className={cx(
                      'absolute inset-0 bg-cover bg-center',
                      d.hoverZoom &&
                        'transition-transform duration-700 ease-out group-hover:scale-[1.05] motion-reduce:transition-none',
                    )}
                    style={{ backgroundImage: bg(it.image) }}
                    role="img"
                    aria-label={it.title || ''}
                  />
                )}
                {overlay && (
                  <span
                    aria-hidden="true"
                    className={cx(
                      'absolute inset-0',
                      style === 'overlay-hover' &&
                        'opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-within:opacity-100',
                    )}
                    style={{
                      background:
                        style === 'overlay-bottom'
                          ? `linear-gradient(to top, rgba(8,10,18,${veil + 0.25}) 0%, rgba(8,10,18,0) 62%)`
                          : `rgba(8,10,18,${veil})`,
                    }}
                  />
                )}
                {overlay && text}
              </div>
              {!overlay && text}
            </>
          );

          return (
            <Reveal {...a} index={i} key={i} as="article" className="group">
              {it.href ? (
                <a
                  href={it.href}
                  className="block no-underline focus-visible:outline-2
                    focus-visible:outline-offset-4 focus-visible:outline-sec-accent"
                >
                  {inner}
                </a>
              ) : (
                inner
              )}
            </Reveal>
          );
        })}
      </div>
    </Wrap>
  );
}

/* ------------------------------------------------------------------ FORM */
/* Renders any form the editor built in /admin/forms. Kept separate from
   `contact` so a form can stand alone on a careers or RFP page without
   dragging an address block along with it. */
function FormBlock({ block, forms, locale = 'en' }: BlockProps) {
  const d = block.data;
  const a = anim(block);
  const form = findForm(forms, d.formId);

  if (!form) {
    return (
      <Wrap>
        <p className="font-mono text-xs text-danger">
          This section points at a form that no longer exists. Pick another in the editor.
        </p>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <Reveal {...a} className="mx-auto max-w-[--sec-max]">
        {d.eyebrow && <Eyebrow>{d.eyebrow}</Eyebrow>}
        {d.heading && (
          <h2
            className={cx(HEADING, 'text-h2 leading-[1.12] [text-wrap:balance]')}
            dangerouslySetInnerHTML={html(d.heading)}
          />
        )}
        {d.intro && (
          <div data-rich className="mt-5 max-w-[62ch] text-body leading-sec text-sec-text">
            <Rich html={d.intro} />
          </div>
        )}
        <div className={d.narrow ? 'mx-auto max-w-[680px]' : undefined}>
          <DynamicForm form={form} locale={locale} label={d.formLabel} />
        </div>
      </Reveal>
    </Wrap>
  );
}

/* ------------------------------------------------------------- REGISTRY */
export const RENDERERS: Record<string, (p: BlockProps) => ReactElement> = {
  hero: Hero,
  imageBanner: ImageBanner,
  richText: RichText,
  splitFeature: SplitFeature,
  statsBand: StatsBand,
  cardGrid: CardGrid,
  productGrid: ProductGrid,
  workGrid: WorkGrid,
  profile: Profile,
  linkCards: LinkCards,
  gallery: Gallery,
  accordion: Accordion,
  ctaBand: CtaBand,
  contact: Contact,
  form: FormBlock,
};