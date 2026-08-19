/* ================================================================
   3) src/app/api/content/route.ts  —  FULL REPLACEMENT.
   Change vs your version: the PUT handler now reconciles the
   lastPublished snapshot on the server for every page, so the
   browser can never invent or delete a published version.
   ================================================================ */
import { NextResponse } from 'next/server';
import {
  readContent,
  writeContent,
  activeDriver,
  snapshotOf,
  VersionConflictError,
} from '@/lib/store';
import { requireEditor, requireAdmin } from '@/lib/rbac';
import { audit } from '@/lib/db';
import type { Page } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requireEditor();
  if (!guard.ok) return guard.response;

  const doc = await readContent();
  return NextResponse.json({ ...doc, _driver: activeDriver(), _role: guard.admin.role });
}

export async function PUT(req: Request) {
  const guard = await requireEditor();
  if (!guard.ok) return guard.response;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Could not read the submitted content.' }, { status: 400 });
  }
  if (!body || !Array.isArray(body.pages) || !body.settings) {
    return NextResponse.json(
      { error: 'The content document is malformed - reload the page and try again.' },
      { status: 400 },
    );
  }
  delete body._driver;
  delete body._role;

  // One read serves both the settings guard and snapshot reconciliation.
  const current = await readContent();

  // Site settings are Admin territory. An editor's save keeps whatever
  // settings are already stored, so their page edits still go through.
  if (guard.admin.role !== 'ADMIN') {
    body.settings = current.settings;
  }

  /* ----- last-published snapshots (server-authoritative) -----------
     Publishing a page freezes it: the snapshot is rebuilt from the
     incoming content on every published save, so it always equals
     what is live. Saving a page as draft keeps the snapshot the
     SERVER already has — whatever the client sent in that field is
     discarded. That means the public site keeps serving the last
     published version while editors work on the draft.             */
  const prevById = new Map(current.pages.map((p) => [p.id, p]));
  const now = new Date().toISOString();

  body.pages = (body.pages as Page[]).map((p) => {
    if (p.status === 'published') {
      return { ...p, lastPublished: snapshotOf(p, now) };
    }
    const prev = prevById.get(p.id);
    return { ...p, lastPublished: prev?.lastPublished };
  });

  try {
    const version = await writeContent(body, guard.admin.actor);
    audit('SAVE', guard.admin.actor, `version ${version}`);
    return NextResponse.json({ ok: true, version });
  } catch (e) {
    if (e instanceof VersionConflictError) {
      return NextResponse.json(
        {
          error:
            'Someone else saved changes while you were editing. Reload to get their version - your unsaved edits will be lost.',
          currentVersion: e.currentVersion,
        },
        { status: 409 },
      );
    }
    console.error('content save failed:', e);
    return NextResponse.json(
      { error: 'Save failed. Run npm run db:test, then check the server log.' },
      { status: 500 },
    );
  }
}

/** Admin-only: restore a specific revision number. */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { version } = (await req.json().catch(() => ({}))) as { version?: number };
  if (!version) return NextResponse.json({ error: 'Missing version.' }, { status: 400 });

  const { restoreRevision } = await import('@/lib/store');
  try {
    const newVersion = await restoreRevision(Number(version), guard.admin.actor);
    audit('RESTORE', guard.admin.actor, `restored ${version} as ${newVersion}`);
    return NextResponse.json({ ok: true, version: newVersion });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
