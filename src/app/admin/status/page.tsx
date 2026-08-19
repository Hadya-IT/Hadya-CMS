'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Card, ErrorNote, Muted, Pill, cx } from '@/components/admin/ui';

type Check = { name: string; configured: boolean; detail: string; missing: string[] };
type Health = {
  envFileMissing: boolean;
  contentStore: string;
  role: string;
  provider?: string;
  checks: Record<string, Check>;
  live?: {
    database: { ok: boolean; detail: string; tables?: string[] };
    dynamics: { ok: boolean; detail: string };
  };
};

const CODE = 'rounded bg-subtle px-1.5 py-px font-mono text-[11px]';

export default function StatusPage() {
  const [h, setH] = useState<Health | null>(null);
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);

  const load = useCallback(async (deep: boolean) => {
    setError('');
    if (deep) setTesting(true);
    try {
      const r = await fetch(`/api/health${deep ? '?deep=1' : ''}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not read system status.');
      setH(j);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTesting(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  if (!h && !error) return <div className="p-[22px] text-dim">Loading status…</div>;

  return (
    <div className="p-[22px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="mb-1 text-[17px] font-medium">System status</h2>
          <Muted className="max-w-[60ch]">
            What is wired up, and the exact setting to change when something is not.
          </Muted>
        </div>
        <Button size="sm" disabled={testing} onClick={() => load(true)}>
          {testing ? 'Testing…' : 'Test connections'}
        </Button>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {h?.envFileMissing && (
        <ErrorNote>
          <strong>No .env.local file found.</strong> Nothing is configured until it exists — SSO,
          the database and Dynamics all read from it. Run <code className={CODE}>npm run setup</code>,
          fill in the values, then restart <code className={CODE}>npm run dev</code>.
        </ErrorNote>
      )}

      {h && (
        <>
          <Card className="flex flex-wrap gap-6 text-[13px]">
            <span>
              Signed in as <strong>{h.role}</strong>
              {h.provider ? ` via ${h.provider === 'local' ? 'local password' : h.provider}` : ''}
            </span>
            <span>
              Content is stored in{' '}
              <strong>{h.contentStore === 'oracle' ? 'Oracle' : 'data/content.json'}</strong>
            </span>
          </Card>

          <div className="mt-[18px] grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3.5">
            {Object.entries(h.checks).map(([key, c]) => {
              const live: { ok: boolean; detail: string } | undefined =
                key === 'database' ? h.live?.database : key === 'dynamics' ? h.live?.dynamics : undefined;
              const tables = key === 'database' ? h.live?.database?.tables : undefined;
              return (
                <Card
                  key={key}
                  className={cx('mt-0 border-l-[3px]', c.configured ? 'border-l-ok' : 'border-l-gold')}
                >
                  <header className="mb-2 flex items-center justify-between gap-2.5">
                    <strong>{c.name}</strong>
                    <Pill tone={c.configured ? 'ok' : 'neutral'}>
                      {c.configured ? 'Configured' : 'Not configured'}
                    </Pill>
                  </header>
                  <p className="mb-1.5 text-[13px] leading-relaxed">{c.detail}</p>

                  {c.missing.length > 0 && (
                    <p className="text-xs text-dim">
                      Add to <code className={CODE}>.env.local</code>:{' '}
                      {c.missing.map((m) => (
                        <code key={m} className={`${CODE} mr-1.5`}>{m}</code>
                      ))}
                    </p>
                  )}

                  {live && (
                    <p className={cx('mb-1.5 text-[13px]', live.ok ? 'text-ok' : 'break-words text-danger')}>
                      {live.ok ? '✓ ' : '✗ '}
                      {live.detail}
                    </p>
                  )}

                  {tables && (
                    <p className="text-xs text-dim">
                      Tables found: {tables.length ? tables.join(', ') : 'none — run db/schema.sql'}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
