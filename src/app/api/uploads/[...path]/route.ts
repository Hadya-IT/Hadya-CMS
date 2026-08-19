import fs from 'fs';
import path from 'path';

/* ------------------------------------------------------------------
   Next.js snapshots /public at build time, so an image uploaded after
   a production build is not served by the static handler. A rewrite in
   next.config.mjs sends those misses here, and this reads them off disk.

   Static files still win — the rewrite runs after the filesystem check —
   so seeded images cost nothing extra.
-------------------------------------------------------------------*/

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const target = path.resolve(UPLOAD_DIR, ...segments);

  // refuse anything that escapes the uploads directory
  if (!target.startsWith(UPLOAD_DIR + path.sep)) {
    return new Response('Forbidden', { status: 403 });
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    return new Response('Not found', { status: 404 });
  }

  const ext = path.extname(target).toLowerCase();
  if (!TYPES[ext]) return new Response('Not found', { status: 404 });

  return new Response(new Uint8Array(fs.readFileSync(target)), {
    headers: {
      'Content-Type': TYPES[ext],
      /* Upload filenames carry a timestamp suffix, so a given URL never
         changes content — which makes a long immutable TTL safe and takes
         these requests off the origin entirely once a CDN is in front.
         The old one-hour TTL meant every visitor re-fetched every image. */
      'Cache-Control': 'public, max-age=31536000, immutable',
      /* Defence in depth: even though SVG is no longer an accepted upload
         type, anything that does get served here must not be sniffed into
         something executable. */
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
