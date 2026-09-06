/* ================================================================
   src/app/api/content/route.ts — FULL REPLACEMENT (workflow v3).

   What changed vs v2:
   - Capability checks replace the ADMIN/EDITOR rank.
   - The PUT handler reconciles every page against the stored copy
     per ROLE, not just the lastPublished snapshot:
       * page create/delete is gated,
       * slug / nav / page style / SEO are gated,
       * page.status is server-authoritative for everyone except
         Marketing Admin — publishing happens in /api/workflow,
       * an untrusted save over a PUBLISHED page flips it to draft,
         so the public site keeps serving the last published
         snapshot and the edits wait in the approval queue,
       * workflow state and schedule times can never be set from
         this endpoint by non-schedulers.
   ================================================================ */
import { NextResponse } from 'next/server';
import {
  readContent,
  writeContent,
  activeDriver,
  snapshotOf,
  VersionConflictError,
} from '@/lib/store';
import { requireCapability } from '@/lib/rbac';
import { can } from '@/lib/permissions';
import { audit } from '@/lib/db';
import type { Page } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requireCapability('view');
  if (!guard.ok) return guard.response;

  const doc = await readContent();
  return NextResponse.json({ ...doc, _driver: activeDriver(), _role: guard.admin.role });
}

/** The fields a visitor can see. If any of these differ, the save is a
 *  content change and an untrusted edit of a live page must not go live. */
function renderableOf(p: Page): string {
  const { title, slug, navLabel, showInNav, navOrder, seo, style, blocks, i18n } = p;
  return JSON.stringify({ title, slug, navLabel, showInNav, navOrder, seo, style, blocks, i18n });
}

export async function PUT(req: Request) {
  const guard = await requireCapability('editContent');
  if (!guard.ok) return guard.response;
  const role = guard.admin.role;
  const trusted = can(role, 'overrideWorkflow'); // Marketing Admin

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

  // One read serves the settings guard, role gating, and snapshots.
  const current = await readContent();
  const prevById = new Map(current.pages.map((p) => [p.id, p]));
  const now = new Date().toISOString();

  // Site settings are Marketing Admin territory.
  if (!can(role, 'manageSettings')) {
    body.settings = current.settings;
  }

  // Shared components render on every page that references them — LIVE
  // pages included, instantly, with no review step. So editing them is
  // reserved for roles that may publish; everyone else's save keeps the
  // stored definitions (inserting/removing references on a page is still
  // ordinary block editing and stays open to editors).
  if (!can(role, 'publish')) {
    body.sharedBlocks = current.sharedBlocks;
  }

  /* ----- page-level reconciliation, per role -------------------- */

  let pages = body.pages as Page[];

  // 1) Creations: drop pages this role may not create.
  if (!can(role, 'createPages')) {
    pages = pages.filter((p) => prevById.has(p.id));
  }

  // 2) Deletions: restore pages this role may not delete.
  const sentIds = new Set(pages.map((p) => p.id));
  for (const prev of current.pages) {
    if (sentIds.has(prev.id)) continue;
    const everLive = prev.status === 'published' || !!prev.lastPublished;
    const mayDelete = everLive ? can(role, 'deletePublished') : can(role, 'deleteDrafts');
    if (!mayDelete) pages.push(prev); // silently restored; UI reloads it
  }

  // 3) Field-level gating + workflow/status authority + snapshots.
  body.pages = pages.map((incoming) => {
    const prev = prevById.get(incoming.id);
    let p: Page = { ...incoming };

    if (prev) {
      // Workflow state and schedule times are written ONLY by /api/workflow.
      p.workflow = prev.workflow;
      if (!can(role, 'schedule')) {
        p.scheduledAt = prev.scheduledAt;
        p.unpublishAt = prev.unpublishAt;
      }

      if (!can(role, 'editPageMeta')) {
        p.slug = prev.slug;
        p.navLabel = prev.navLabel;
        p.showInNav = prev.showInNav;
        p.navOrder = prev.navOrder;
        p.style = prev.style;
      }
      if (!can(role, 'editSeo')) {
        p.seo = prev.seo;
      }

      if (!trusted) {
        // Status is server-authoritative. If the page is LIVE and this
        // save changes what visitors would see, park it as a draft: the
        // snapshot below keeps the published version on the site while
        // the edits go through review.
        p.status = prev.status;
        if (prev.status === 'published' && renderableOf(p) !== renderableOf(prev)) {
          p.status = 'draft';
        }
      }
    } else {
      // New page: always starts as an unpublished draft for everyone
      // except Marketing Admin.
      if (!trusted) p.status = 'draft';
      p.workflow = undefined;
      if (!can(role, 'schedule')) {
        p.scheduledAt = undefined;
        p.unpublishAt = undefined;
      }
    }

    /* last-published snapshots (server-authoritative, unchanged rule):
       published save -> rebuild from incoming; draft save -> keep the
       server's snapshot, discarding whatever the client sent. */
    if (p.status === 'published') {
      return { ...p, lastPublished: snapshotOf(p, now) };
    }
    return { ...p, lastPublished: prev?.lastPublished };
  });

  try {
    const version = await writeContent(body, guard.admin.actor);
    audit('SAVE', guard.admin.actor, `version ${version} (${role})`);
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

/** Restore a specific revision number. */
export async function POST(req: Request) {
  const guard = await requireCapability('restoreRevisions');
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
