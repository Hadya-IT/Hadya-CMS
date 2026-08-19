import type { CSSProperties } from 'react';
import type { MediaItem } from '@/lib/types';

/* ------------------------------------------------------------------
   Responsive images for CMS-supplied URLs.

   WHY NOT next/image. Three reasons, in order of weight:

   1. The editor stores a bare URL string in block data, not a MediaItem —
      so at render time we have "/uploads/hero-abc.jpg" and no dimensions.
      next/image needs width/height or `fill`, and getting them means a
      lookup back into doc.media on every block.
   2. `images.unoptimized` is on, so next/image would add a wrapper and a
      lazy-loading shim while doing no actual optimisation.
   3. The renditions already exist as static files from lib/images.ts. A
      plain <img srcset> uses them with no runtime cost and works
      identically on the local driver and behind the OCI bucket.

   HOW IT FINDS VARIANTS. The media library is the source of truth: given a
   URL, `findMedia` locates the MediaItem whose `url` matches and reads its
   `variants`. Uploads predating optimisation have none, and then this
   degrades to a plain <img> — same output as before, no breakage.
-------------------------------------------------------------------*/

/** Matches a stored URL back to its media record. */
export function findMedia(url: string | undefined, media: MediaItem[] | undefined): MediaItem | undefined {
  if (!url || !media?.length) return undefined;
  return media.find((m) => m.url === url);
}

export function srcSetFor(item: MediaItem | undefined): string | undefined {
  if (!item?.variants?.length) return undefined;
  return item.variants
    .slice()
    .sort((a, b) => a.width - b.width)
    .map((v) => `${v.url} ${v.width}w`)
    .join(', ');
}

export interface SmartImageProps {
  src: string | undefined;
  alt?: string;
  media?: MediaItem[];
  /** The `sizes` attribute. Get this right or srcset picks badly — it is
   *  the browser's only clue about layout width before CSS is applied. */
  sizes?: string;
  className?: string;
  style?: CSSProperties;
  /** Above-the-fold images should not be lazy: it delays LCP. */
  priority?: boolean;
  width?: number;
  height?: number;
}

export default function SmartImage({
  src,
  alt = '',
  media,
  sizes = '100vw',
  className,
  style,
  priority = false,
  width,
  height,
}: SmartImageProps) {
  if (!src) return null;
  const item = findMedia(src, media);
  const srcSet = srcSetFor(item);

  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt || item?.alt || ''}
      width={width ?? item?.width}
      height={height ?? item?.height}
      className={className}
      style={style}
      loading={priority ? 'eager' : 'lazy'}
      // fetchPriority is what actually moves an LCP image up the queue;
      // loading="eager" alone only stops it being deferred.
      fetchPriority={priority ? 'high' : undefined}
      decoding={priority ? 'sync' : 'async'}
    />
  );
}

/* ------------------------------------------------------------------
   Background-image variant.

   Hero and banner blocks paint through CSS `background-image`, which has no
   srcset. `image-set()` is the CSS equivalent and is supported everywhere
   that matters now; the plain url() stays first as the fallback. This does
   not do width-based selection — it lets the browser pick WebP over the
   original, which is where most of the saving is anyway.
-------------------------------------------------------------------*/

export function backgroundImageValue(
  src: string | undefined,
  media: MediaItem[] | undefined,
  /** Extra layers painted over the image, e.g. a darkening gradient. */
  overlays: string[] = [],
): string | undefined {
  if (!src) return undefined;
  const item = findMedia(src, media);
  const widest = item?.variants?.slice().sort((a, b) => b.width - a.width)[0];

  const layer = widest
    ? `image-set(url("${widest.url}") type("image/webp"), url("${src}"))`
    : `url("${src}")`;

  return [...overlays, layer].filter(Boolean).join(', ');
}
