/* ================================================================
   src/app/api/workflow/route.ts — NEW.

   The ONLY writer of workflow state, page.status transitions for
   non-admins, and schedule times. The content PUT deliberately
   ignores those fields for untrusted roles, so every approval step
   passes through this state machine and leaves an event row.

     Editor/Contributor:  submit, withdraw
     Approver/Admin:      return, reject, approve_publish,
                          approve_schedule, unpublish, set_unpublish
     Marketing Admin:     everything, on any state (override)

   GET  /api/workflow            -> review queue + recent events
   GET  /api/workflow?pageId=x   -> full event history for one page
   POST /api/workflow            -> { pageId, action, comment?, at? }
   ================================================================ */
import { NextResponse } from 'next/server';
import { readContent, writeContent, snapshotOf, activeDriver, VersionConflictError } from '@/lib/store';
import { requireCapability } from '@/lib/rbac';
import { can } from '@/lib/permissions';
import { audit, isDbConfigured, withConnection } from '@/lib/db';
import type { Page, PageWorkflow } from '@/lib/types';

export const dynamic = 'force-dynamic';

const TENANT = () => process.env.CMS_TENANT_ID || 'hadya';

type WfAction =
  | 'submit'
  | 'withdraw'
  | 'return'
  | 'reject'
  | 'approve_publish'
  | 'approve_schedule'
  | 'unpublish'
  | 'set_unpublish';

const EVENT_NAME: Record<WfAction, string> = {
  submit: 'SUBMIT',
  withdraw: 'WITHDRAW',
  return: 'RETURN',
  reject: 'REJECT',
  approve_publish: 'APPROVE_PUBLISH',
  approve_schedule: 'APPROVE_SCHEDULE',
  unpublish: 'UNPUBLISH',
  set_unpublish: 'UNPUBLISH',
};

async function recordEvent(
  pageId: string,
  pageTitle: string,
  action: string,
  actor: string,
  comment?: string,
): Promise<void> {
  if (!isDbConfigured()) return; // file driver: doc state still carries the workflow
  try {
    await withConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO cms_workflow_event (tenant_id, page_id, page_title, action, actor, comment_text)
         VALUES (:t, :p, :ti, :a, :ac, :c)`,
        {
          t: TENANT(),
          p: pageId,
          ti: (pageTitle || '').slice(0, 300),
          a: action,
          ac: actor,
          c: comment ? comment.slice(0, 2000) : null,
        },
        { autoCommit: true },
      );
    });
  } catch (e) {
    console.error('workflow event insert failed:', e);
  }
}

export async function GET(req: Request) {
  const guard = await requireCapability('view');
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const pageId = url.searchParams.get('pageId');

  const doc = await readContent();
  const queue = doc.pages
    .filter((p) => p.workflow && p.workflow.state !== 'draft')
    .map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      status: p.status,
      updatedAt: p.updatedAt,
      scheduledAt: p.scheduledAt,
      unpublishAt: p.unpublishAt,
      hasPublishedVersion: p.status === 'published' || !!p.lastPublished,
      workflow: p.workflow,
    }));

  let events: unknown[] = [];
  if (isDbConfigured()) {
    try {
      events = await withConnection(async (conn) => {
        const r = await conn.execute(
          pageId
            ? `SELECT page_id, page_title, action, actor, comment_text, occurred_at
                 FROM cms_workflow_event
                WHERE tenant_id = :t AND page_id = :p
                ORDER BY occurred_at DESC FETCH FIRST 100 ROWS ONLY`
            : `SELECT page_id, page_title, action, actor, comment_text, occurred_at
                 FROM cms_workflow_event
                WHERE tenant_id = :t
                ORDER BY occurred_at DESC FETCH FIRST 50 ROWS ONLY`,
          pageId ? { t: TENANT(), p: pageId } : { t: TENANT() },
        );
        return r.rows ?? [];
      });
    } catch (e) {
      console.error('workflow events read failed:', e);
    }
  }

  return NextResponse.json({ queue, events, _role: guard.admin.role, _driver: activeDriver() });
}

export async function POST(req: Request) {
  // Everyone in the workflow can at least see; specific caps below.
  const guard = await requireCapability('view');
  if (!guard.ok) return guard.response;
  const role = guard.admin.role;
  const actor = guard.admin.actor;

  const body = (await req.json().catch(() => ({}))) as {
    pageId?: string;
    action?: WfAction;
    comment?: string;
    at?: string; // ISO datetime for approve_schedule / set_unpublish
  };
  const { pageId, action, comment, at } = body;
  if (!pageId || !action || !EVENT_NAME[action]) {
    return NextResponse.json({ error: 'Missing pageId or action.' }, { status: 400 });
  }

  const doc = await readContent();
  const page = doc.pages.find((p) => p.id === pageId);
  if (!page) return NextResponse.json({ error: 'Page not found.' }, { status: 404 });

  const state = page.workflow?.state ?? 'draft';
  const override = can(role, 'overrideWorkflow');
  const now = new Date().toISOString();
  const deny = (msg: string, code = 403) => NextResponse.json({ error: msg }, { status: code });

  const wf = (patch: Partial<PageWorkflow>): PageWorkflow => ({
    state: 'draft',
    ...(page.workflow || {}),
    ...patch,
  });

  switch (action) {
    case 'submit': {
      if (!can(role, 'submitReview')) return deny('Your role cannot submit for review.');
      if (!['draft', 'returned', 'rejected'].includes(state) && !override) {
        return deny(`Cannot submit from state "${state}".`, 409);
      }
      page.workflow = { state: 'in_review', submittedBy: actor, submittedAt: now, note: comment };
      break;
    }

    case 'withdraw': {
      if (state !== 'in_review') return deny('Nothing to withdraw.', 409);
      const own = page.workflow?.submittedBy === actor;
      if (!own && !can(role, 'review')) return deny('Only the submitter or a reviewer can withdraw.');
      page.workflow = { state: 'draft' };
      break;
    }

    case 'return': {
      if (!can(role, 'review')) return deny('Your role cannot review submissions.');
      if (state !== 'in_review' && !override) return deny('Page is not in review.', 409);
      if (!comment) return deny('A comment is required when returning for changes.', 400);
      page.workflow = wf({ state: 'returned', note: comment, reviewedBy: actor, reviewedAt: now });
      break;
    }

    case 'reject': {
      if (!can(role, 'review')) return deny('Your role cannot review submissions.');
      if (state !== 'in_review' && !override) return deny('Page is not in review.', 409);
      if (!comment) return deny('A comment is required when rejecting.', 400);
      page.workflow = wf({ state: 'rejected', note: comment, reviewedBy: actor, reviewedAt: now });
      break;
    }

    case 'approve_publish': {
      if (!can(role, 'publish')) return deny('Your role cannot publish.');
      if (state !== 'in_review' && state !== 'approved' && !override) {
        return deny('Page is not awaiting approval.', 409);
      }
      page.status = 'published';
      page.scheduledAt = undefined;
      page.updatedAt = now;
      page.lastPublished = snapshotOf(page, now);
      page.workflow = undefined; // clean slate for the next edit cycle
      break;
    }

    case 'approve_schedule': {
      if (!can(role, 'schedule')) return deny('Your role cannot schedule.');
      if (state !== 'in_review' && state !== 'approved' && !override) {
        return deny('Page is not awaiting approval.', 409);
      }
      if (!at || isNaN(Date.parse(at))) return deny('A valid date/time is required.', 400);
      page.scheduledAt = new Date(at).toISOString();
      page.workflow = wf({ state: 'approved', reviewedBy: actor, reviewedAt: now, note: comment });
      break;
    }

    case 'unpublish': {
      if (!can(role, 'publish')) return deny('Your role cannot unpublish.');
      if (page.status !== 'published') return deny('Page is not published.', 409);
      // Unpublish means OFF the site: clearing the snapshot stops the
      // draft-fallback from continuing to serve the old version.
      page.status = 'draft';
      page.lastPublished = undefined;
      page.unpublishAt = undefined;
      page.workflow = undefined;
      break;
    }

    case 'set_unpublish': {
      if (!can(role, 'schedule')) return deny('Your role cannot schedule.');
      if (at == null || at === '') {
        page.unpublishAt = undefined; // clear a scheduled unpublish
        break;
      }
      if (isNaN(Date.parse(at))) return deny('A valid date/time is required.', 400);
      page.unpublishAt = new Date(at).toISOString();
      break;
    }
  }

  try {
    const version = await writeContent(doc, actor);
    await recordEvent(page.id, page.title, EVENT_NAME[action], actor, comment);
    audit('WORKFLOW_' + EVENT_NAME[action], actor, `${page.title} (${page.id}) v${version}`);
    return NextResponse.json({ ok: true, version, workflow: page.workflow ?? null, status: page.status });
  } catch (e) {
    if (e instanceof VersionConflictError) {
      return NextResponse.json(
        { error: 'The content changed while you were reviewing. Reload and try again.' },
        { status: 409 },
      );
    }
    console.error('workflow action failed:', e);
    return NextResponse.json({ error: 'Could not apply the action.' }, { status: 500 });
  }
}
