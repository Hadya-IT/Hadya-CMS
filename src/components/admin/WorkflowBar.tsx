'use client';

/* ================================================================
   WorkflowBar — NEW. Drop into the pages editor above the page tab
   (see PATCHES.md for the exact mount point). Shows the page's
   workflow state and the reviewer's latest comment, and lets the
   editor submit / resubmit / withdraw. Save happens first, so what
   the approver reviews is what was actually stored.
   ================================================================ */

import { useState } from 'react';
import { useAdmin } from './AdminProvider';
import { Button, Input, Muted, Pill } from './ui';
import type { Page } from '@/lib/types';

const CAN_SCHEDULE = new Set(['APPROVER', 'MARKETING_ADMIN']);

const TONE: Record<string, 'ok' | 'danger' | 'neutral'> = {
  in_review: 'neutral', approved: 'ok', returned: 'danger', rejected: 'danger',
};

export default function WorkflowBar({ page }: { page: Page }) {
  const { doc, dirty, save, reload } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [offAt, setOffAt] = useState('');

  const state = page.workflow?.state ?? 'draft';
  const note = page.workflow?.note;
  const scheduler = CAN_SCHEDULE.has(String((doc as any)?._role || ''));

  async function run(action: 'submit' | 'withdraw' | 'set_unpublish', at?: string | null) {
    setBusy(true);
    setErr('');
    try {
      if (dirty) await save(); // review what is stored, not what is on screen
      const r = await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: page.id, action, at }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not update the workflow.');
      setOffAt('');
      await reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3 rounded-panel border border-edge bg-panel px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={TONE[state] || 'neutral'}>{state.replace('_', ' ')}</Pill>
        {page.status === 'published' && state === 'draft' && (
          <Muted>Live. New edits are parked as a draft until approved.</Muted>
        )}
        {page.scheduledAt && <Muted>Scheduled: {new Date(page.scheduledAt).toLocaleString()}</Muted>}
        {page.unpublishAt && <Muted>Off at: {new Date(page.unpublishAt).toLocaleString()}</Muted>}

        <span className="ml-auto flex gap-2">
          {state === 'in_review' ? (
            <Button size="sm" disabled={busy} onClick={() => run('withdraw')}>
              {busy ? 'Working…' : 'Withdraw from review'}
            </Button>
          ) : (
            <Button size="sm" disabled={busy} onClick={() => run('submit')}>
              {busy ? 'Working…' : state === 'returned' || state === 'rejected' ? 'Resubmit for review' : 'Submit for review'}
            </Button>
          )}
        </span>
      </div>
      {scheduler && page.status === 'published' && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-edge pt-2">
          <Muted className="text-[11px]">Take off the site automatically:</Muted>
          <Input
            type="datetime-local"
            value={offAt}
            onChange={(e) => setOffAt(e.target.value)}
          />
          <Button
            size="sm"
            disabled={busy || !offAt}
            onClick={() => run('set_unpublish', new Date(offAt).toISOString())}
          >
            Schedule unpublish
          </Button>
          {page.unpublishAt && (
            <Button size="sm" disabled={busy} onClick={() => run('set_unpublish', null)}>
              Cancel ({new Date(page.unpublishAt).toLocaleString()})
            </Button>
          )}
        </div>
      )}
      {note && (state === 'returned' || state === 'rejected') && (
        <p className="mt-2 rounded-panel bg-subtle px-2.5 py-2 text-[12px]">
          Reviewer: “{note}”
        </p>
      )}
      {err && <p className="mt-2 text-[12px] text-red-600">{err}</p>}
    </div>
  );
}
