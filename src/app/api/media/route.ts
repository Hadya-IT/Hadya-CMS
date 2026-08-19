import { NextResponse } from 'next/server';
import path from 'path';
import { readContent, writeContent, uid } from '@/lib/store';
import { requireEditor } from '@/lib/rbac';
import { putFile, deleteFile, mediaDriver } from '@/lib/storage';
import { audit } from '@/lib/db';
import { processImage, stem } from '@/lib/images';

export const dynamic = 'force-dynamic';

/* SVG is deliberately absent. An SVG is a script container, and these files
   are served from our own origin — so an uploaded SVG is stored XSS against
   any signed-in editor who opens it. If you genuinely need vector logos,
   re-add '.svg' here AND serve uploads with Content-Disposition: attachment
   plus a sandbox CSP (see api/uploads/[...path]/route.ts). */
const ALLOWED = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif',
};

export async function POST(req: Request) {
  const guard = await requireEditor();
  if (!guard.ok) return guard.response;
  const actor = guard.admin.actor;

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file received.' }, { status: 400 });

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED.includes(ext)) {
    return NextResponse.json({ error: `File type ${ext || '(none)'} is not allowed.` }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File is larger than 10 MB.' }, { status: 400 });
  }

  const safe = path.basename(file.name, ext).replace(/[^a-z0-9-_]/gi, '-').toLowerCase().slice(0, 50);
  const filename = `${safe}-${Date.now().toString(36)}${ext}`;

  let stored;
  let processed;
  try {
    const original = Buffer.from(await file.arrayBuffer());
    // Renditions are generated and stored first; the master goes last so a
    // half-finished variant set never leaves an orphaned primary record.
    processed = await processImage(stem(filename), ext, original);
    stored = await putFile(
      filename,
      processed.master,
      MIME[ext] || 'application/octet-stream',
    );
  } catch (e) {
    console.error('upload failed:', e);
    return NextResponse.json({ error: 'Upload failed. Check storage configuration.' }, { status: 500 });
  }

  const doc = await readContent();
  const item = {
    id: uid('m'),
    url: stored.url,
    objectName: stored.objectName,
    name: file.name,
    size: processed.master.length,
    uploadedAt: new Date().toISOString(),
    width: processed.width,
    height: processed.height,
    variants: processed.variants.length ? processed.variants : undefined,
  };
  doc.media.unshift(item as any);
  const version = await writeContent(doc, actor);
  audit(
    'MEDIA_UPLOAD',
    actor,
    `${file.name} -> ${stored.driver}` +
      (processed.optimised ? ` (+${processed.variants.length} variants)` : ' (unoptimised)'),
  );

  /* The new document version is returned so the editor can fold it into its
     in-memory copy. Without this, uploading from inside the page editor left
     the client on a stale version and its NEXT save failed the optimistic
     lock with "someone else saved changes" — when nobody had. */
  return NextResponse.json({ ...item, version, optimised: processed.optimised, note: processed.note });
}

export async function DELETE(req: Request) {
  const guard = await requireEditor();
  if (!guard.ok) return guard.response;
  const actor = guard.admin.actor;

  const { id } = await req.json();
  const doc = await readContent();
  const item = doc.media.find((m) => m.id === id);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    await deleteFile(item as any);
    // Renditions are separate objects and would otherwise be orphaned in
    // the bucket, invisible and still billed.
    for (const v of item.variants || []) {
      await deleteFile({ url: v.url, objectName: v.objectName }).catch((e) =>
        console.error('variant delete failed:', (e as Error).message),
      );
    }
  } catch (e) {
    console.error('media delete failed (record removed anyway):', e);
  }

  doc.media = doc.media.filter((m) => m.id !== id);
  const version = await writeContent(doc, actor);
  audit('MEDIA_DELETE', actor, item.name);

  return NextResponse.json({ ok: true, driver: mediaDriver(), version });
}
