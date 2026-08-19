'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Card, CardTitle, ErrorNote, Muted, Pill } from '@/components/admin/ui';
import type { AnalyticsPayload, Kpi, SeriesPoint } from '@/lib/analytics-sample';

type Payload = AnalyticsPayload & { mode: string; gtmId: string | null };

const RANGES = [7, 30, 90];

/* ---------------------------------------------------------------- format */

function fmt(v: number, f: Kpi['format']) {
  switch (f) {
    case 'pct': return `${v.toFixed(1)}%`;
    case 'currency': return `SAR ${Math.round(v).toLocaleString()}`;
    case 'duration': {
      const m = Math.floor(v / 60);
      const s = Math.round(v % 60);
      return `${m}m ${String(s).padStart(2, '0')}s`;
    }
    default: return Math.round(v).toLocaleString();
  }
}

function delta(cur: number, prev: number) {
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}

/* ---------------------------------------------------------------- charts */

function LineChart({ data, keys }: { data: SeriesPoint[]; keys: { k: keyof SeriesPoint; color: string; label: string }[] }) {
  const w = 760, h = 200, pad = 28;
  if (!data.length) return null;

  const maxes = keys.map((s) => Math.max(...data.map((d) => Number(d[s.k]))));
  const max = Math.max(...maxes) || 1;
  const x = (i: number) => pad + (i / Math.max(1, data.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[520px]" role="img" aria-label="Traffic over time">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={pad} x2={w - pad} y1={y(max * t)} y2={y(max * t)}
            stroke="var(--color-edge)" strokeWidth="1" strokeDasharray={t ? '3 4' : ''} />
        ))}
        {keys.map((s) => (
          <polyline key={String(s.k)} fill="none" stroke={s.color} strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round"
            points={data.map((d, i) => `${x(i)},${y(Number(d[s.k]))}`).join(' ')} />
        ))}
        <text x={pad} y={14} fontSize="10" fill="var(--color-dim)">{Math.round(max).toLocaleString()}</text>
        <text x={pad} y={h - 8} fontSize="10" fill="var(--color-dim)">{data[0]?.date}</text>
        <text x={w - pad} y={h - 8} fontSize="10" textAnchor="end" fill="var(--color-dim)">
          {data[data.length - 1]?.date}
        </text>
      </svg>
      <div className="mt-2 flex flex-wrap gap-4">
        {keys.map((s) => (
          <span key={String(s.k)} className="flex items-center gap-1.5 text-xs text-dim">
            <span className="h-0.5 w-4 rounded" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Bars({ rows }: { rows: { label: string; value: number; sub?: string }[] }) {
  const max = Math.max(...rows.map((r) => r.value)) || 1;
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[minmax(96px,150px)_1fr_auto] items-center gap-3">
          <span className="truncate text-xs text-ink">{r.label}</span>
          <span className="h-2 rounded-full bg-subtle">
            <span className="block h-2 rounded-full bg-gold/70" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="tabular-nums text-xs text-dim">
            {r.value.toLocaleString()}{r.sub ? ` · ${r.sub}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- page */

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d: number) => {
    setLoading(true); setErr('');
    try {
      const r = await fetch(`/api/analytics?days=${d}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not load analytics.');
      setData(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Website analytics</h1>
          <Muted>Traffic, campaigns and form submissions.</Muted>
        </div>
        <div className="flex gap-1.5">
          {RANGES.map((d) => (
            <Button key={d} onClick={() => setDays(d)} variant={d === days ? 'primary' : 'default'} size="sm">
              {d} days
            </Button>
          ))}
        </div>
      </div>

      {/* The banner is not optional. If the payload says sample, this shows. */}
      {data?.isSample && (
        <div className="mb-5 flex flex-wrap items-start gap-3 rounded-panel border-2 border-dashed border-danger/50 bg-danger/5 p-4">
          <span className="rounded-full bg-danger px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
            Sample data
          </span>
          <div className="flex-1 text-sm leading-relaxed text-danger-ink">
            <strong>Every number on this page is invented.</strong> It shows what the
            dashboard will look like once Google Tag Manager and GA4 are connected — it is
            not measurement of your site and must not be used for reporting, budget
            decisions or anything shown to a client or the board.
            <span className="mt-1 block text-xs text-dim">
              {data.gtmId
                ? `GTM container ${data.gtmId} is installed and collecting, but this screen is not yet reading from GA4. Set ANALYTICS_MODE=ga4 once the GA4 client is implemented.`
                : 'No GTM container is configured. Add one in Settings → Analytics to start collecting real data.'}
            </span>
          </div>
        </div>
      )}

      {err && <ErrorNote>{err}</ErrorNote>}
      {loading && !data && <Muted>Loading…</Muted>}

      {data && (
        <div className={data.isSample ? 'relative' : ''}>
          {/* diagonal watermark, so a screenshot cannot lose the context */}
          {data.isSample && (
            <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] whitespace-nowrap text-[80px] font-black uppercase tracking-widest text-danger/[0.06]">
                Sample data
              </div>
            </div>
          )}

          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.kpis.map((k) => {
              const d = delta(k.value, k.previous);
              const good = k.key === 'bounce' || k.key === 'cpl' ? (d ?? 0) < 0 : (d ?? 0) > 0;
              return (
                <Card key={k.key}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-dim">{k.label}</span>
                    {d !== null && (
                      <span className={`text-[11px] font-semibold ${good ? 'text-ok' : 'text-danger'}`}>
                        {d > 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 text-2xl font-semibold tabular-nums text-ink">
                    {fmt(k.value, k.format)}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-snug text-dim">{k.hint}</p>
                </Card>
              );
            })}
          </div>

          <Card className="mb-5">
            <CardTitle>Sessions and submissions over time</CardTitle>
            <LineChart data={data.series} keys={[
              { k: 'sessions', color: '#8a6c25', label: 'Sessions' },
              { k: 'users', color: '#bcc4d0', label: 'Users' },
              { k: 'leads', color: '#1c7a4d', label: 'Form submissions' },
            ]} />
          </Card>

          <div className="mb-5 grid gap-5 lg:grid-cols-2">
            <Card>
              <CardTitle>Where visitors came from</CardTitle>
              <Bars rows={data.channels.map((c) => ({
                label: c.name,
                value: c.sessions,
                sub: c.cpl ? `SAR ${Math.round(c.cpl)}/lead` : `${c.leads} leads`,
              }))} />
              <p className="mt-3 text-[11px] leading-snug text-dim">
                Paid rows show cost per lead. Organic and direct have no media cost, so
                they show lead count instead.
              </p>
            </Card>

            <Card>
              <CardTitle>Most visited pages</CardTitle>
              <Bars rows={data.pages.map((p) => ({
                label: p.title,
                value: p.views,
                sub: `${Math.round(p.avgSeconds)}s`,
              }))} />
              <p className="mt-3 text-[11px] leading-snug text-dim">
                Time shown is average time on the page. A high-traffic page with very low
                time usually means the headline promised something the page did not deliver.
              </p>
            </Card>
          </div>

          <Card className="mb-5 overflow-x-auto">
            <CardTitle>Ad campaigns</CardTitle>
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wider text-dim">
                  <th className="py-2 pr-3 font-semibold">Campaign</th>
                  <th className="py-2 pr-3 font-semibold">Platform</th>
                  <th className="py-2 pr-3 text-right font-semibold">Impressions</th>
                  <th className="py-2 pr-3 text-right font-semibold">Clicks</th>
                  <th className="py-2 pr-3 text-right font-semibold">CTR</th>
                  <th className="py-2 pr-3 text-right font-semibold">CPC</th>
                  <th className="py-2 pr-3 text-right font-semibold">Spend</th>
                  <th className="py-2 pr-3 text-right font-semibold">Leads</th>
                  <th className="py-2 text-right font-semibold">Cost / lead</th>
                </tr>
              </thead>
              <tbody>
                {data.campaigns.map((c) => (
                  <tr key={c.name} className="border-b border-edge/60 last:border-0">
                    <td className="py-2.5 pr-3 text-ink">{c.name}</td>
                    <td className="py-2.5 pr-3 text-dim">{c.source}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-dim">{c.impressions.toLocaleString()}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-ink">{c.clicks.toLocaleString()}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-dim">{c.ctr.toFixed(2)}%</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-dim">SAR {c.cpc.toFixed(2)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-ink">SAR {c.spend.toLocaleString()}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-ink">{c.leads}</td>
                    <td className="py-2.5 text-right tabular-nums font-semibold text-ink">SAR {Math.round(c.cpl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card>
              <CardTitle>Tracked events</CardTitle>
              <div className="flex flex-col gap-2">
                {data.events.map((e) => (
                  <div key={e.name} className="flex items-center justify-between gap-2 border-b border-edge/60 pb-2 last:border-0">
                    <div className="min-w-0">
                      <code className="block truncate text-xs text-ink">{e.name}</code>
                      <span className="text-[10px] uppercase tracking-wider text-dim">{e.category}</span>
                    </div>
                    <span className="tabular-nums text-sm text-ink">{e.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-snug text-dim">
                These are the dataLayer events the site pushes. GTM turns them into GA4
                conversions.
              </p>
            </Card>

            <Card>
              <CardTitle>Devices</CardTitle>
              <Bars rows={data.devices.map((d) => ({ label: d.name, value: d.sessions, sub: `${d.share}%` }))} />
              <p className="mt-3 text-[11px] leading-snug text-dim">
                Mobile majority is normal here. It is the reason every section has a
                separate mobile column count.
              </p>
            </Card>

            <Card>
              <CardTitle>Cities</CardTitle>
              <Bars rows={data.geo.map((g) => ({ label: g.city, value: g.sessions, sub: `${g.leads} leads` }))} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
