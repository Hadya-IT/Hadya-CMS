import 'server-only';
import path from 'path';
import type { MediaVariant } from './types';
import { putFile } from './storage';

/* ------------------------------------------------------------------
   Image optimisation on upload.

   WHY AT UPLOAD AND NOT ON REQUEST. Next's own image optimiser is turned
   off in next.config.mjs (`images: { unoptimized: true }`) and turning it
   on would not help much here: most block backgrounds are CSS
   `background-image`, which never passes through <Image>, and the OCI
   bucket is a remote origin that would need every host allow-listed. Doing
   the work once at upload means the CDN/bucket serves plain static files,
   the site needs no optimiser at runtime, and the local file driver
   behaves identically to the OCI one.

   WHAT IT PRODUCES. For a raster upload: the original, plus WebP
   renditions at 480/960/1600px (never upscaled). SmartImage emits those as
   a srcset. A 3 MB hero JPEG typically lands around 90 KB at 960px.

   SHARP IS OPTIONAL. It is a native module, and on Windows a failed
   postinstall is common enough that making uploads depend on it would be
   hostile. The import is lazy and every failure degrades to "store the
   original, no variants" — the site still works, images are just heavier.
   /admin/status reports which mode you are in.
-------------------------------------------------------------------*/

/** Widths we generate. Chosen to cover phone / tablet / desktop-2x. */
export const VARIANT_WIDTHS = [480, 960, 1600] as const;

/** Formats worth re-encoding. SVG is markup, GIF may be animated. */
const RASTER = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

/* Both members carry both keys (one always undefined) because with
   strict:false in tsconfig, discriminating on a boolean literal does not
   narrow — the same reason lib/rbac.ts shapes its Guard type this way. */
export type SharpState =
  | { available: true; version: string; reason?: undefined }
  | { available: false; version?: undefined; reason: string };

let sharpState: SharpState | null = null;
let sharpModule: any = null;

/** Loads sharp once and remembers the outcome, including the failure. */
export async function getSharp(): Promise<SharpState> {
  if (sharpState) return sharpState;
  try {
    const mod = await import('sharp');
    sharpModule = mod.default ?? mod;
    sharpState = {
      available: true,
      version: (sharpModule.versions?.sharp as string) || 'unknown',
    };
  } catch (e) {
    sharpModule = null;
    sharpState = {
      available: false,
      reason:
        'sharp is not installed or failed to load, so uploads are stored unoptimised. ' +
        'Run: npm install sharp  (' +
        (e as Error).message.split('\n')[0] +
        ')',
    };
  }
  return sharpState;
}

export interface ProcessedImage {
  /** The original bytes, possibly stripped of metadata. */
  master: Buffer;
  width?: number;
  height?: number;
  variants: MediaVariant[];
  /** True when sharp did the work; false when we passed the file through. */
  optimised: boolean;
  note?: string;
}

/**
 * Generates renditions for one upload and stores them alongside the
 * original. `baseName` is the already-sanitised filename stem.
 */
export async function processImage(
  baseName: string,
  ext: string,
  buffer: Buffer,
): Promise<ProcessedImage> {
  const lower = ext.toLowerCase();

  if (!RASTER.has(lower)) {
    // SVG and GIF pass straight through: re-encoding an SVG loses its
    // scalability, and flattening an animated GIF loses the animation.
    return { master: buffer, variants: [], optimised: false, note: 'vector or animated — stored as-is' };
  }

  const state = await getSharp();
  if (!state.available) {
    return { master: buffer, variants: [], optimised: false, note: state.reason };
  }

  try {
    const image = sharpModule(buffer, { failOn: 'none' });
    const meta = await image.metadata();
    const srcWidth: number = meta.width || 0;
    const srcHeight: number = meta.height || 0;

    /* Strip EXIF from the master. Phone photos carry GPS coordinates, and
       a media library on a public bucket is not the place for the
       photographer's home address. Orientation is applied first so the
       image does not end up sideways once EXIF is gone. */
    const master: Buffer = await sharpModule(buffer, { failOn: 'none' })
      .rotate()
      .toBuffer();

    const variants: MediaVariant[] = [];
    for (const width of VARIANT_WIDTHS) {
      // Never upscale — a 600px logo has no business becoming 1600px.
      if (srcWidth && width > srcWidth) continue;

      const out: Buffer = await sharpModule(buffer, { failOn: 'none' })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 78, effort: 4 })
        .toBuffer();

      // Skip a rendition that came out bigger than the original — happens
      // with already-tight PNGs and flat graphics.
      if (out.length >= buffer.length && width >= (srcWidth || width)) continue;

      const stored = await putFile(`${baseName}-${width}.webp`, out, 'image/webp');
      variants.push({
        width,
        url: stored.url,
        objectName: stored.objectName,
        format: 'webp',
        size: out.length,
      });
    }

    return {
      master,
      width: srcWidth || undefined,
      height: srcHeight || undefined,
      variants,
      optimised: true,
    };
  } catch (e) {
    // A corrupt or exotic file should not fail the upload.
    console.error('image processing failed, storing original:', (e as Error).message);
    return {
      master: buffer,
      variants: [],
      optimised: false,
      note: 'could not be processed: ' + (e as Error).message.split('\n')[0],
    };
  }
}

/** Builds a srcset string from stored variants. */
export function buildSrcSet(variants: MediaVariant[] | undefined): string {
  if (!variants?.length) return '';
  return variants
    .slice()
    .sort((a, b) => a.width - b.width)
    .map((v) => `${v.url} ${v.width}w`)
    .join(', ');
}

/** Strips the extension off a stored filename, for naming variants. */
export function stem(filename: string): string {
  return path.basename(filename, path.extname(filename));
}
