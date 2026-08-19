'use client';

import { useMemo, useState } from 'react';
import { Card, Input, Muted, Pill } from '@/components/admin/ui';
import { GUIDE, GUIDE_INDEX, type GuideSection } from '@/lib/guide';

/** Bold **markers** without pulling in a markdown dependency. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) {
          return <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong>;
        }
        if (p.startsWith('`') && p.endsWith('`')) {
          return <code key={i} className="rounded bg-subtle px-1.5 py-0.5 text-[12px] text-ink">{p.slice(1, -1)}</code>;
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

function Section({ s }: { s: GuideSection }) {
  return (
    <Card className="scroll-mt-20">
      <div id={s.id} className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-ink">{s.title}</h3>
        {s.audience === 'admin' && <Pill tone="neutral">Admin only</Pill>}
      </div>
      <p className="mt-1 text-sm text-dim">{s.summary}</p>

      {s.warn && (
        <div className="mt-3 rounded-panel border border-danger/40 bg-danger/5 p-3 text-sm leading-relaxed text-danger-ink">
          <RichText text={s.warn} />
        </div>
      )}

      {s.steps && (
        <ol className="mt-4 flex flex-col gap-3">
          {s.steps.map((st, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/15 text-[11px] font-bold text-gold">
                {i + 1}
              </span>
              <div className="text-sm leading-relaxed text-ink">
                <RichText text={st.do} />
                {st.note && (
                  <span className="mt-1 block text-[12.5px] leading-snug text-dim">
                    <RichText text={st.note} />
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {s.body && (
        <div className="mt-3 flex flex-col gap-2.5 text-sm leading-relaxed text-dim">
          {s.body.map((b, i) => <p key={i}><RichText text={b} /></p>)}
        </div>
      )}

      {s.table && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[380px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wider text-dim">
                {s.table.head.map((h) => <th key={h} className="py-2 pr-4 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {s.table.rows.map((r, i) => (
                <tr key={i} className="border-b border-edge/60 last:border-0">
                  {r.map((c, j) => (
                    <td key={j} className={`py-2.5 pr-4 align-top ${j === 0 ? 'font-medium text-ink' : 'text-dim'}`}>
                      <RichText text={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function GuidePage() {
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState(GUIDE[0].id);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return null;
    return GUIDE_INDEX.filter((s) => s.haystack.includes(needle));
  }, [q]);

  const current = GUIDE.find((t) => t.id === topic) || GUIDE[0];

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-ink">User guide</h1>
        <Muted>How to add pages, build sections and publish. Written for people who have not used a CMS before.</Muted>
      </div>

      <div className="mb-5 max-w-md">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the guide — try “publish”, “columns”, “image”"
        />
      </div>

      {results ? (
        <div>
          <Muted>
            {results.length === 0
              ? 'Nothing matched. Try a single word — the guide is short.'
              : `${results.length} result${results.length === 1 ? '' : 's'}`}
          </Muted>
          <div className="mt-2 flex flex-col gap-4">
            {results.map((s) => (
              <div key={`${s.topicId}-${s.id}`}>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gold">{s.topicTitle}</span>
                <Section s={s} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[210px_1fr]">
          <nav className="flex flex-row flex-wrap gap-1 lg:sticky lg:top-4 lg:flex-col lg:self-start">
            {GUIDE.map((t) => (
              <button
                key={t.id}
                onClick={() => setTopic(t.id)}
                className={`rounded-panel px-3 py-2 text-left text-sm transition ${
                  t.id === topic ? 'bg-subtle font-medium text-gold' : 'text-dim hover:bg-subtle hover:text-ink'
                }`}
              >
                {t.title}
              </button>
            ))}
          </nav>

          <div>
            <h2 className="text-lg font-semibold text-ink">{current.title}</h2>
            <Muted>{current.blurb}</Muted>
            <div className="flex flex-col gap-4">
              {current.sections.map((s) => <Section key={s.id} s={s} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
