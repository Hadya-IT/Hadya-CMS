'use client';

/* ================================================================
   /admin/review — NEW. The approval queue.

   Approver / Marketing Admin: approve & publish, approve & schedule,
   return with comments, reject. Everyone with 'view' can read the
   queue and the history; the buttons simply are not offered (and the
   API refuses them anyway — see api/workflow).
   ================================================================ */

import { useCallback, useEffect, useState } from 'react';
import { Button, Card, CardTitle, ErrorNote, Input, Muted, Pill, SubHeading, Textarea, cx } from '@/components/admin/ui';

type QueueItem = {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  updatedAt: string;
  scheduledAt?: string;
  unpublishAt?: string;
  hasPublishedVersion: boolean;
  workflow: {
    state: 'in_review' | 'returned' | 'rejected' | 'approved';
    submittedBy?: string;
    submittedAt?: string;
    note?: string;
    reviewedBy?: string;
    reviewedAt?: string;
  };
};

type WfEvent = {
  PAGE_ID: string; PAGE_TITLE: string; ACTION: string; ACTOR: string;
  COMMENT_TEXT: string | null; OCCURRED_AT: string;
};

const CAN_REVIEW = new Set(['APPROVER', 'MARKETING_ADMIN']);

const STATE_TONE: Record<string, 'ok' | 'danger' | 'neutral'> = {
  in_review: 'neutral', approved: 'ok', returned: 'danger', rejected: 'danger',
};

export default function ReviewPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [events, setEvents] = useState<WfEvent[]>([]);
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [comment, setComment] = useState<Record<string, string>>({});
  const [when, setWhen] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/workflow', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not load the queue.');
      setQueue(j.queue || []);
      setEvents(j.events || []);
      setRole(j._role || '');
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(pageId: string, action: string, needsComment = false, needsWhen = false) {
    const c = (comment[pageId] || '').trim();
    if (needsComment && !c) { setError('Add a comment first — the editor needs to know why.'); return; }
    const at = when[pageId] || '';
    if (needsWhen && !at) { setError('Pick a date and time first.'); return; }
    setBusy(pageId + action);
    setError('');
    try {
      const r = await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, action, comment: c || undefined, at: at ? new Date(at).toISOString() : undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Action failed.');
      setComment((m) => ({ ...m, [pageId]: '' }));
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  const reviewer = CAN_REVIEW.has(role);
  const pending = queue.filter((q) => q.workflow.state === 'in_review');
  const other = queue.filter((q) => q.workflow.state !== 'in_review');

  return (
    <div className="mx-auto max-w-[860px] px-5 py-6">
      <SubHeading>Review queue</SubHeading>
      <Muted className="mb-4 block">
        Content submitted for approval. Publishing and scheduling happen here — nowhere else.
      </Muted>
      {error && <ErrorNote>{error}</ErrorNote>}

      {pending.length === 0 && (
        <Card className="mb-4"><Muted>Nothing is waiting for review.</Muted></Card>
      )}

      {[...pending, ...other].map((q) => (
        <Card key={q.id} className="mb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>{q.title}</CardTitle>
              <span className="font-mono text-[11px] text-dim">/{q.slug}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Pill tone={STATE_TONE[q.workflow.state] || 'neutral'}>{q.workflow.state.replace('_', ' ')}</Pill>
              {q.scheduledAt && <Pill tone="ok">goes live {new Date(q.scheduledAt).toLocaleString()}</Pill>}
              {q.unpublishAt && <Pill tone="danger">off at {new Date(q.unpublishAt).toLocaleString()}</Pill>}
            </div>
          </div>

          <div className="mt-2 text-[12px] text-dim">
            {q.workflow.submittedBy && (
              <span>Submitted by {q.workflow.submittedBy}
                {q.workflow.submittedAt ? ` · ${new Date(q.workflow.submittedAt).toLocaleString()}` : ''}</span>
            )}
            {q.workflow.note && (
              <p className="mt-1 rounded-panel bg-subtle px-2.5 py-2 text-ink">“{q.workflow.note}”</p>
            )}
          </div>

          <div className="mt-2.5 flex flex-wrap gap-2">
            <a className="text-[12px] text-gold underline" href={`/${q.slug}?preview=1`} target="_blank" rel="noreferrer">
              Preview draft ↗
            </a>
            {q.hasPublishedVersion && (
              <a className="text-[12px] text-dim underline" href={`/${q.slug}`} target="_blank" rel="noreferrer">
                Compare with live ↗
              </a>
            )}
          </div>

          {reviewer && (
            <div className="mt-3 border-t border-edge pt-3">
              <Textarea
                rows={2}
                placeholder="Comment for the editor (required to return or reject)"
                value={comment[q.id] || ''}
                onChange={(e) => setComment((m) => ({ ...m, [q.id]: e.target.value }))}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button size="sm" disabled={!!busy} onClick={() => act(q.id, 'approve_publish')}>
                  {busy === q.id + 'approve_publish' ? 'Publishing…' : 'Approve & publish'}
                </Button>
                <span className="inline-flex items-center gap-1.5">
                  <Input
                    type="datetime-local"
                    value={when[q.id] || ''}
                    onChange={(e) => setWhen((m) => ({ ...m, [q.id]: e.target.value }))}
                  />
                  <Button size="sm" disabled={!!busy} onClick={() => act(q.id, 'approve_schedule', false, true)}>
                    Approve & schedule
                  </Button>
                </span>
                <Button size="sm" disabled={!!busy} onClick={() => act(q.id, 'return', true)}>
                  Return for changes
                </Button>
                <Button size="sm" disabled={!!busy} onClick={() => act(q.id, 'reject', true)}>
                  Reject
                </Button>
              </div>
            </div>
          )}
        </Card>
      ))}

      <SubHeading>Approval history</SubHeading>
      {events.length === 0 ? (
        <Muted>No workflow activity recorded yet.</Muted>
      ) : (
        <ul className="list-none">
          {events.map((e, i) => (
            <li key={i} className={cx('border-b border-edge py-2 text-[12px]', i === 0 && 'border-t')}>
              <span className="font-mono text-[11px] text-gold">{e.ACTION}</span>{' '}
              <strong>{e.PAGE_TITLE}</strong> — {e.ACTOR}
              <span className="text-dim"> · {new Date(e.OCCURRED_AT).toLocaleString()}</span>
              {e.COMMENT_TEXT && <p className="mt-0.5 text-dim">“{e.COMMENT_TEXT}”</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
