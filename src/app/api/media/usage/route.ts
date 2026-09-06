/* ================================================================
   src/app/api/media/usage/route.ts — NEW.

   GET /api/media/usage?url=/uploads/x.jpg
   Where is this file referenced right now? The single-document store
   makes this a plain substring walk — no index to maintain. Call it
   from the media library before offering Delete.
   ================================================================ */
import { NextResponse } from 'next/server';
import { readContent } from '@/lib/store';
import { requireCapability } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const guard = await requireCapability('manageMedia');
  if (!guard.ok) return guard.response;

  const url = new URL(req.url).searchParams.get('url') || '';
  if (!url) return NextResponse.json({ error: 'Missing ?url=' }, { status: 400 });

  const doc = await readContent();
  const usedIn: { pageId: string; title: string; slug: string; where: 'draft' | 'published' | 'both' }[] = [];

  for (const p of doc.pages) {
    const { lastPublished, ...working } = p;
    const inDraft = JSON.stringify(working).includes(url);
    const inLive = lastPublished ? JSON.stringify(lastPublished).includes(url) : false;
    if (inDraft || inLive) {
      usedIn.push({
        pageId: p.id,
        title: p.title,
        slug: p.slug,
        where: inDraft && inLive ? 'both' : inDraft ? 'draft' : 'published',
      });
    }
  }

  const inSettings = JSON.stringify(doc.settings).includes(url);
  const inForms = JSON.stringify(doc.forms ?? []).includes(url);

  return NextResponse.json({
    url,
    inUse: usedIn.length > 0 || inSettings || inForms,
    pages: usedIn,
    settings: inSettings,
    forms: inForms,
  });
}
