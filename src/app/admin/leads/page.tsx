'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { Button, ErrorNote, Muted, Pill } from '@/components/admin/ui';

type Lead = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  subject?: string;
  message?: string;
  pageUrl?: string;
  crmId?: string | null;
  crmStatus: 'pending' | 'sent' | 'failed' | 'off';
  crmError?: string | null;
  createdAt: string;
};

const CRM_LABEL: Record<Lead['crmStatus'], string> = {
  sent: 'In Dynamics',
  failed: 'Not sent',
  pending: 'Sending',
  off: 'Stored here',
};

const CRM_TONE: Record<Lead['crmStatus'], 'ok' | 'danger' | 'neutral'> = {
  sent: 'ok',
  failed: 'danger',
  pending: 'neutral',
  off: 'neutral',
};

const TH = 'border-b border-edge px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-dim';
const TD = 'border-b border-edge px-2.5 py-2.5 align-top';

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const r = await fetch('/api/forms', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not load submissions.');
      setLeads(j.leads);
    } catch (e) {
      setError((e as Error).message);
      setLeads([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function retry(id: string) {
    setBusy(id);
    try {
      const r = await fetch('/api/forms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Retry failed.');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-[22px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="mb-1 text-[17px] font-medium">Form submissions</h2>
          <Muted className="max-w-[60ch]">
            Every enquiry sent from the website. When Dynamics 365 is switched on, each one is
            also created as a lead there.
          </Muted>
        </div>
        <Button size="sm" onClick={load}>Refresh</Button>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {!leads && <Muted className="mt-4">Loading submissions…</Muted>}

      {leads && leads.length === 0 && !error && (
        <div className="mt-4 rounded-panel border border-edge bg-panel p-8 text-center shadow-[0_1px_2px_rgb(16_24_40/0.04)]">
          <strong className="mb-1.5 block">No submissions yet.</strong>
          <Muted className="mx-auto max-w-[46ch]">
            Add a Contact form block to a page and publish it. Submissions appear here as soon as
            visitors start sending them.
          </Muted>
        </div>
      )}

      {leads && leads.length > 0 && (
        <div className="mt-[18px] overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={TH}>Received</th>
                <th className={TH}>Name</th>
                <th className={TH}>Email</th>
                <th className={TH}>Subject</th>
                <th className={TH}>Dynamics</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <Fragment key={l.id}>
                  <tr
                    className="cursor-pointer [&:hover>td]:bg-subtle/70"
                    onClick={() => setOpen(open === l.id ? null : l.id)}
                  >
                    <td className={`${TD} text-dim`}>
                      {new Date(l.createdAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className={TD}>
                      <strong>{l.name}</strong>
                      {l.company && <span className="text-dim"> · {l.company}</span>}
                    </td>
                    <td className={TD}>{l.email}</td>
                    <td className={`${TD} text-dim`}>{l.subject || '—'}</td>
                    <td className={TD}>
                      <Pill tone={CRM_TONE[l.crmStatus]} className="text-[11px] normal-case tracking-normal">
                        {CRM_LABEL[l.crmStatus]}
                      </Pill>
                    </td>
                    <td className={`${TD} whitespace-nowrap text-right`}>
                      {l.crmStatus === 'failed' && (
                        <Button
                          size="sm"
                          disabled={busy === l.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            retry(l.id);
                          }}
                        >
                          {busy === l.id ? 'Retrying…' : 'Retry'}
                        </Button>
                      )}
                    </td>
                  </tr>
                  {open === l.id && (
                    <tr>
                      <td className={`${TD} bg-subtle/50`} colSpan={6}>
                        {l.message && (
                          <p className="mb-3 max-w-[80ch] whitespace-pre-wrap leading-relaxed">
                            {l.message}
                          </p>
                        )}
                        <dl className="grid grid-cols-[140px_1fr] gap-x-3.5 gap-y-1">
                          {l.phone && (
                            <>
                              <dt className="text-xs text-dim">Phone</dt>
                              <dd className="text-xs">{l.phone}</dd>
                            </>
                          )}
                          {l.pageUrl && (
                            <>
                              <dt className="text-xs text-dim">Sent from</dt>
                              <dd className="break-words text-xs">{l.pageUrl}</dd>
                            </>
                          )}
                          {l.crmId && (
                            <>
                              <dt className="text-xs text-dim">Dynamics lead id</dt>
                              <dd className="break-words text-xs">
                                <code className="rounded bg-subtle px-1 py-px">{l.crmId}</code>
                              </dd>
                            </>
                          )}
                          {l.crmError && (
                            <>
                              <dt className="text-xs text-dim">Last CRM error</dt>
                              <dd className="break-words text-xs text-danger">{l.crmError}</dd>
                            </>
                          )}
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
