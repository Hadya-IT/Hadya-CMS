'use client';

import { useState } from 'react';
import { useAdmin } from '@/components/admin/AdminProvider';
import { useDialog } from '@/components/admin/Dialog';
import {
  Button,
  Card,
  CardTitle,
  ErrorNote,
  FieldShell,
  IconButton,
  Input,
  Muted,
  Row,
  SubHeading,
  Toggle,
} from '@/components/admin/ui';
import { validateRule } from '@/lib/redirects';
import type { RedirectRule } from '@/lib/types';

/* ------------------------------------------------------------------
   Redirects, plus a short account of what the sitemap is doing.

   The constraint worth knowing, and the reason it is stated on screen
   rather than buried in a doc: a redirect only fires on a path that does
   NOT match a real page. That is what makes the feature safe to hand to a
   marketer — a mistyped rule is inert, and no rule can ever hide live
   content. It also means "redirect /about-us to /about" does nothing while
   /about-us still exists as a page.
-------------------------------------------------------------------*/

const rid = () =>
  `rd_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

export default function SeoAdmin() {
  const dialog = useDialog();
  const { doc, loading, update } = useAdmin();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [permanent, setPermanent] = useState(true);
  const [error, setError] = useState('');

  if (loading || !doc) return <div className="p-[22px] text-dim">Loading…</div>;

  const rules = doc.settings.redirects || [];
  const pages = doc.pages;

  async function add() {
    const problem = validateRule({ from, to }, rules);
    if (problem) {
      setError(problem);
      return;
    }
    // A rule whose source is a live page will never fire. Warn rather than
    // block — the page might be about to be deleted.
    const shadowed = pages.find((p) => '/' + p.slug === from.trim().replace(/\/+$/, ''));
    if (
      shadowed &&
      !(await dialog.confirm({
        title: 'This redirect will not fire yet',
        body:
          `/${shadowed.slug} is a live page, so this redirect only takes effect once that ` +
          `page is deleted or unpublished.`,
        confirmLabel: 'Add it anyway',
      }))
    ) {
      return;
    }

    update((d) => {
      if (!d.settings.redirects) d.settings.redirects = [];
      d.settings.redirects.push({ id: rid(), from: from.trim(), to: to.trim(), permanent });
    });
    setFrom('');
    setTo('');
    setError('');
  }

  return (
    <div className="p-[22px]">
      <h2 className="mb-1 text-[17px] font-medium">SEO</h2>
      <Muted className="mb-5 max-w-[70ch]">
        Sitemap and robots.txt are generated automatically from your published pages. Redirects are
        managed here.
      </Muted>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* ------------------------------------------------- redirects */}
        <div>
          <Card>
            <CardTitle>Add a redirect</CardTitle>
            <Row>
              <FieldShell label="Old path" help="e.g. /old-about or /news/*">
                <Input
                  value={from}
                  placeholder="/old-about"
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setError('');
                  }}
                />
              </FieldShell>
              <FieldShell label="Send to" help="A path, or a full https:// URL">
                <Input
                  value={to}
                  placeholder="/about-us"
                  onChange={(e) => {
                    setTo(e.target.value);
                    setError('');
                  }}
                />
              </FieldShell>
            </Row>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2.5 text-[12.5px]">
                <Toggle label="Permanent" checked={permanent} onChange={setPermanent} />
                Permanent (308) — tells search engines the move is final
              </label>
              <Button variant="primary" onClick={add} disabled={!from.trim() || !to.trim()}>
                Add redirect
              </Button>
            </div>
            {error && <ErrorNote>{error}</ErrorNote>}
          </Card>

          <div className="mt-5">
            <SubHeading>Existing redirects ({rules.length})</SubHeading>
            <div className="mt-2.5 flex flex-col gap-1.5">
              {rules.map((rule: RedirectRule) => {
                const shadowed = pages.some(
                  (p) => '/' + p.slug === rule.from.replace(/\/+$/, '') && p.status === 'published',
                );
                return (
                  <div
                    key={rule.id}
                    className="group flex items-center gap-3 rounded-panel border border-edge
                      bg-panel px-3 py-2.5"
                  >
                    <code className="truncate font-mono text-[11.5px] text-ink">{rule.from}</code>
                    <span aria-hidden="true" className="text-dim">
                      →
                    </span>
                    <code className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-dim">
                      {rule.to}
                    </code>
                    <span className="text-[10.5px] uppercase tracking-[0.08em] text-dim">
                      {rule.permanent !== false ? '308' : '307'}
                    </span>
                    {shadowed && (
                      <span
                        title="A published page already uses this path, so this rule never fires."
                        className="text-[10.5px] uppercase tracking-[0.08em] text-gold"
                      >
                        inactive
                      </span>
                    )}
                    <IconButton
                      danger
                      aria-label={`Delete redirect from ${rule.from}`}
                      className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                      onClick={() =>
                        update((d) => {
                          d.settings.redirects = (d.settings.redirects || []).filter(
                            (r) => r.id !== rule.id,
                          );
                        })
                      }
                    >
                      ×
                    </IconButton>
                  </div>
                );
              })}
              {!rules.length && <Muted>No redirects yet.</Muted>}
            </div>
          </div>
        </div>

        {/* ----------------------------------------------- reference */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle>How these behave</CardTitle>
            <ul className="flex flex-col gap-2.5 text-[12px] leading-relaxed text-dim">
              <li>
                A redirect only fires on a path with <strong>no matching page</strong>. That is why a
                rule pointing at a live page shows as <em>inactive</em>.
              </li>
              <li>
                <code className="font-mono text-[11px]">/news/*</code> →{' '}
                <code className="font-mono text-[11px]">/insights/*</code> forwards the rest of the
                path, so <code className="font-mono text-[11px]">/news/2024/q3</code> lands on{' '}
                <code className="font-mono text-[11px]">/insights/2024/q3</code>.
              </li>
              <li>
                A wildcard is only supported at the end. <code className="font-mono text-[11px]">/a/*/b</code>{' '}
                will not work.
              </li>
              <li>
                Rules are checked top to bottom; the first match wins. Loops are rejected when you
                add them.
              </li>
            </ul>
          </Card>

          <Card>
            <CardTitle>Sitemap</CardTitle>
            <Muted className="mb-2.5">
              Live at <code className="font-mono text-[11px]">/sitemap.xml</code>, regenerated on
              every request.
            </Muted>
            <ul className="flex flex-col gap-1.5 text-[12px] text-dim">
              <li>
                {pages.filter((p) => p.status === 'published' && !p.seo?.noIndex).length} pages
                included
              </li>
              <li>{pages.filter((p) => p.status !== 'published').length} drafts excluded</li>
              <li>{pages.filter((p) => p.seo?.noIndex).length} marked no-index and excluded</li>
            </ul>
            <p className="mt-3 text-[11.5px] text-dim">
              Both sitemap.xml and robots.txt need <code className="font-mono">SITE_URL</code> set to
              your public origin. Until it is, robots.txt disallows all crawling — deliberately, so
              a staging deployment cannot get indexed.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}