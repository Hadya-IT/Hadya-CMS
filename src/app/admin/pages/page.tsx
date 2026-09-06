'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAdmin } from '@/components/admin/AdminProvider';
import { useDialog } from '@/components/admin/Dialog';
import { Field } from '@/components/admin/Fields';
import StylePanel from '@/components/admin/StylePanel';
import {
  Button,
  IconButton,
  Muted,
  PaneHeader,
  Pill,
  Row,
  SubHeading,
  cx,
} from '@/components/admin/ui';
import { BLOCKS, BLOCK_MAP, BLOCK_GROUPS } from '@/blocks/registry';
import WorkflowBar from '@/components/admin/WorkflowBar';

/* Four panes on a wide screen; stacked below that. The original grid had a
   fixed 1150px-wide track set, which made the editor unusable on a laptop
   in a split window. */
const SHELL =
  'grid grid-cols-1 xl:h-[calc(100vh-52px)] ' +
  'xl:grid-cols-[220px_262px_minmax(320px,1fr)_minmax(340px,1.15fr)]';

const PANE = 'min-w-0 border-b border-edge xl:overflow-y-auto xl:border-b-0 xl:border-r';

export default function PagesEditor() {
  const { doc, loading, update, newBlock, newPage, save, dirty } = useAdmin();
  const dialog = useDialog();
  const [pageId, setPageId] = useState<string>('');
  const [blockId, setBlockId] = useState<string>('');
  const [tab, setTab] = useState<'content' | 'style' | 'page'>('content');
  const [showLibrary, setShowLibrary] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => {
    if (doc && !pageId && doc.pages.length) setPageId(doc.pages[0].id);
  }, [doc, pageId]);

  const page = useMemo(() => doc?.pages.find((p) => p.id === pageId), [doc, pageId]);
  const block = useMemo(() => page?.blocks.find((b) => b.id === blockId), [page, blockId]);
  const def = block ? BLOCK_MAP[block.type] : null;

  if (loading || !doc) return <div className="p-[22px] text-dim">Loading…</div>;

  /* The GET /api/content response carries the caller's role. Only the
     Marketing Admin gets the direct status control — everyone else
     publishes through the review queue, and the server ignores the
     field from them anyway. */
  const isAdmin = (doc as any)._role === 'MARKETING_ADMIN';

  /* ---------------- page ops ---------------- */
  const addPage = () => {
    const p = newPage();
    update((d) => { d.pages.push(p); });
    setPageId(p.id);
    setBlockId('');
    setTab('page');
  };
  const deletePage = async (id: string) => {
    const p = doc.pages.find((x) => x.id === id);
    const sure = await dialog.confirm({
      title: `Delete "${p?.title}"?`,
      body: `Its ${p?.blocks.length} section(s) go with it. This cannot be undone.`,
      confirmLabel: 'Delete page',
      danger: true,
    });
    if (!sure) return;
    update((d) => { d.pages = d.pages.filter((x) => x.id !== id); });
    setPageId(doc.pages.find((x) => x.id !== id)?.id || '');
  };
  const duplicatePage = (id: string) => {
    update((d) => {
      const src = d.pages.find((x) => x.id === id);
      if (!src) return;
      const copy = JSON.parse(JSON.stringify(src));
      copy.id = `pg_${Math.random().toString(36).slice(2, 9)}`;
      copy.title = `${src.title} (copy)`;
      copy.slug = `${src.slug || 'home'}-copy`;
      copy.status = 'draft';
      copy.showInNav = false;
      copy.blocks = copy.blocks.map((b: any) => ({ ...b, id: `blk_${Math.random().toString(36).slice(2, 9)}` }));
      d.pages.push(copy);
    });
  };
  const setPageField = (k: string, v: any) =>
    update((d) => {
      const p = d.pages.find((x) => x.id === pageId);
      if (!p) return;
      (p as any)[k] = v;
      p.updatedAt = new Date().toISOString();
    });

  /* ---------------- block ops ---------------- */
  const addBlock = (type: string) => {
    const b = newBlock(type);
    update((d) => { d.pages.find((p) => p.id === pageId)?.blocks.push(b); });
    setBlockId(b.id);
    setTab('content');
    setShowLibrary(false);
  };
  const moveBlock = (i: number, dir: -1 | 1) =>
    update((d) => {
      const p = d.pages.find((x) => x.id === pageId);
      if (!p) return;
      const j = i + dir;
      if (j < 0 || j >= p.blocks.length) return;
      [p.blocks[i], p.blocks[j]] = [p.blocks[j], p.blocks[i]];
    });
  const removeBlock = (id: string) =>
    update((d) => {
      const p = d.pages.find((x) => x.id === pageId);
      if (!p) return;
      p.blocks = p.blocks.filter((b) => b.id !== id);
    });
  const duplicateBlock = (id: string) =>
    update((d) => {
      const p = d.pages.find((x) => x.id === pageId);
      if (!p) return;
      const i = p.blocks.findIndex((b) => b.id === id);
      const copy = JSON.parse(JSON.stringify(p.blocks[i]));
      copy.id = `blk_${Math.random().toString(36).slice(2, 9)}`;
      p.blocks.splice(i + 1, 0, copy);
    });
  const setBlockData = (k: string, v: any) =>
    update((d) => {
      const b = d.pages.find((x) => x.id === pageId)?.blocks.find((x) => x.id === blockId);
      if (b) b.data[k] = v;
    });
  const setBlockStyle = (next: any) =>
    update((d) => {
      const b = d.pages.find((x) => x.id === pageId)?.blocks.find((x) => x.id === blockId);
      if (b) b.style = next;
    });

  async function saveAndPreview() {
    await save();
    setPreviewKey((k) => k + 1);
  }

  const TAB_BASE =
    'cursor-pointer border-b-2 px-3 py-2 text-xs transition-colors ' +
    'disabled:cursor-not-allowed disabled:opacity-35';

  return (
    <div className={SHELL}>
      {/* ---------------- pane 1: pages ---------------- */}
      <div className={cx(PANE, 'bg-panel')}>
        <PaneHeader title="Pages">
          <Button size="sm" onClick={addPage}>+ New</Button>
        </PaneHeader>
        <ul className="list-none px-2 pb-5">
          {doc.pages.map((p) => (
            <li key={p.id} className="group relative">
              <button
                type="button"
                className={cx(
                  'mb-0.5 block w-full cursor-pointer rounded-panel border px-2.5 py-[9px] text-left',
                  p.id === pageId
                    ? 'border-gold/40 bg-subtle'
                    : 'border-transparent hover:bg-subtle/60',
                )}
                onClick={() => { setPageId(p.id); setBlockId(''); setTab('page'); }}
              >
                <span className="block text-[12.5px]">{p.title}</span>
                <span className="block font-mono text-[11px] text-dim">/{p.slug}</span>
                <Pill tone={p.status === 'published' ? 'ok' : 'neutral'} className="mt-[5px]">
                  {p.status}
                </Pill>
              </button>
              <div
                className="absolute right-2 top-1.5 flex gap-0.5 opacity-0 transition-opacity
                  group-hover:opacity-100 group-focus-within:opacity-100"
              >
                <IconButton onClick={() => duplicatePage(p.id)} title="Duplicate" aria-label="Duplicate page">⧉</IconButton>
                <IconButton danger onClick={() => deletePage(p.id)} title="Delete" aria-label="Delete page">×</IconButton>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ---------------- pane 2: sections ---------------- */}
      <div className={cx(PANE, 'bg-panel')}>
        <PaneHeader title="Sections">
          <Button size="sm" onClick={() => setShowLibrary(!showLibrary)}>
            {showLibrary ? 'Close' : '+ Add section'}
          </Button>
        </PaneHeader>

        {showLibrary && (
          <div className="mb-2.5 border-b border-edge px-2 pb-3.5">
            {(doc.sharedBlocks?.length ?? 0) > 0 && (
              <div>
                <h4 className="mb-1.5 mt-3 text-[10px] uppercase tracking-[0.14em] text-dim">
                  Shared components
                </h4>
                {doc.sharedBlocks!.map((sb) => (
                  <button
                    type="button"
                    key={sb.id}
                    onClick={() => {
                      const b = newBlock('shared' as any);
                      b.type = 'shared';
                      b.data = { refId: sb.id };
                      b.label = sb.name;
                      update((d) => { d.pages.find((pp) => pp.id === pageId)?.blocks.push(b); });
                      setBlockId(b.id);
                      setTab('content');
                      setShowLibrary(false);
                    }}
                    className="mb-1 flex w-full cursor-pointer gap-2.5 rounded-panel border border-edge
                      bg-panel px-2.5 py-2 text-left transition-colors hover:border-gold"
                  >
                    <span aria-hidden="true" className="text-gold">⧉</span>
                    <span className="min-w-0">
                      <strong className="block text-xs font-medium">{sb.name}</strong>
                      <small className="block text-[10.5px] leading-snug text-dim">
                        Edited once in Shared components, updates every page.
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {BLOCK_GROUPS.map((g) => (
              <div key={g}>
                <h4 className="mb-1.5 mt-3 text-[10px] uppercase tracking-[0.14em] text-dim">{g}</h4>
                {BLOCKS.filter((b) => b.group === g).map((b) => (
                  <button
                    type="button"
                    key={b.type}
                    onClick={() => addBlock(b.type)}
                    className="mb-1 flex w-full cursor-pointer gap-2.5 rounded-panel border border-edge
                      bg-panel px-2.5 py-2 text-left transition-colors hover:border-gold"
                  >
                    <span aria-hidden="true" className="text-gold">{b.icon}</span>
                    <span className="min-w-0">
                      <strong className="block text-xs font-medium">{b.name}</strong>
                      <small className="block text-[10.5px] leading-snug text-dim">{b.description}</small>
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {page && (
          <ul className="list-none px-2 pb-5">
            {page.blocks.map((b, i) => (
              <li key={b.id} className="group relative">
                <button
                  type="button"
                  className={cx(
                    'mb-0.5 flex w-full cursor-pointer items-start gap-2.5 rounded-panel border px-2.5 py-[9px] text-left',
                    b.id === blockId
                      ? 'border-gold/40 bg-subtle'
                      : 'border-transparent hover:bg-subtle/60',
                    b.style?.hidden && 'opacity-45',
                  )}
                  onClick={() => { setBlockId(b.id); setTab('content'); }}
                >
                  <span aria-hidden="true" className="w-4 flex-none text-sm text-gold">
                    {BLOCK_MAP[b.type]?.icon || '▢'}
                  </span>
                  <span className="min-w-0">
                    <strong className="block text-[12.5px] font-medium">
                      {b.label ||
                        (b.type === 'shared'
                          ? doc.sharedBlocks?.find((sb) => sb.id === b.data?.refId)?.name || 'Shared component'
                          : BLOCK_MAP[b.type]?.name || b.type)}
                    </strong>
                    <small className="block text-[10.5px] capitalize text-dim">
                      {b.style?.theme} · {b.style?.animation}
                    </small>
                  </span>
                </button>
                <div
                  className="absolute right-2 top-1.5 flex gap-0.5 opacity-0 transition-opacity
                    group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  <IconButton onClick={() => moveBlock(i, -1)} title="Move up" aria-label="Move section up">↑</IconButton>
                  <IconButton onClick={() => moveBlock(i, 1)} title="Move down" aria-label="Move section down">↓</IconButton>
                  <IconButton onClick={() => duplicateBlock(b.id)} title="Duplicate" aria-label="Duplicate section">⧉</IconButton>
                  <IconButton danger onClick={() => removeBlock(b.id)} title="Delete" aria-label="Delete section">×</IconButton>
                </div>
              </li>
            ))}
            {page.blocks.length === 0 && (
              <Muted className="p-[22px]">No sections yet. Add one to start building the page.</Muted>
            )}
          </ul>
        )}
      </div>

      {/* ---------------- pane 3: inspector ---------------- */}
      <div className={cx(PANE, 'bg-app')}>
        <div className="sticky top-0 z-5 flex gap-0.5 bg-app px-3.5 pt-3">
          <button
            type="button"
            className={cx(TAB_BASE, tab === 'page'
              ? 'border-gold text-gold'
              : 'border-transparent text-dim hover:text-ink')}
            onClick={() => setTab('page')}
          >Page</button>
          <button
            type="button"
            className={cx(TAB_BASE, tab === 'content'
              ? 'border-gold text-gold'
              : 'border-transparent text-dim hover:text-ink')}
            onClick={() => setTab('content')}
            disabled={!block}
          >Content</button>
          <button
            type="button"
            className={cx(TAB_BASE, tab === 'style'
              ? 'border-gold text-gold'
              : 'border-transparent text-dim hover:text-ink')}
            onClick={() => setTab('style')}
            disabled={!block}
          >Design</button>
        </div>

        <div className="px-3.5 pb-15 pt-4">
          {tab === 'page' && page && (
            <>
              <WorkflowBar page={page} />
              <Field def={{ name: 'title', label: 'Page title', type: 'text' }} value={page.title} onChange={(v) => setPageField('title', v)} />
              <Field
                def={{ name: 'slug', label: 'URL slug', type: 'text', help: 'Leave empty for the home page. No leading slash.' }}
                value={page.slug}
                onChange={(v) => setPageField('slug', String(v).replace(/^\/+/, '').replace(/[^a-z0-9\-\/]/gi, '-').toLowerCase())}
              />
              <Row>
                {isAdmin ? (
                  <Field def={{ name: 'status', label: 'Status', type: 'select', options: [
                    { label: 'Draft', value: 'draft' }, { label: 'Published', value: 'published' },
                  ]}} value={page.status} onChange={(v) => setPageField('status', v)} />
                ) : (
                  <div>
                    <Muted className="mb-1 block text-[11px] uppercase tracking-[0.08em]">Status</Muted>
                    <Pill tone={page.status === 'published' ? 'ok' : 'neutral'}>{page.status}</Pill>
                    <Muted className="mt-1 block text-[11px]">Publishing goes through the review queue.</Muted>
                  </div>
                )}
                <Field def={{ name: 'navOrder', label: 'Menu order', type: 'number', min: 0, max: 99 }} value={page.navOrder} onChange={(v) => setPageField('navOrder', v)} />
              </Row>
              <Row>
                <Field def={{ name: 'showInNav', label: 'Show in main menu', type: 'boolean' }} value={page.showInNav} onChange={(v) => setPageField('showInNav', v)} />
                <Field def={{ name: 'navLabel', label: 'Menu label', type: 'text' }} value={page.navLabel} onChange={(v) => setPageField('navLabel', v)} />
              </Row>

              <SubHeading>Search engines</SubHeading>
              <Field def={{ name: 'seoTitle', label: 'SEO title', type: 'text' }} value={page.seo?.title} onChange={(v) => setPageField('seo', { ...page.seo, title: v })} />
              <Field def={{ name: 'seoDesc', label: 'Meta description', type: 'textarea' }} value={page.seo?.description} onChange={(v) => setPageField('seo', { ...page.seo, description: v })} />
              <Field def={{ name: 'ogImage', label: 'Share image', type: 'image' }} value={page.seo?.ogImage} onChange={(v) => setPageField('seo', { ...page.seo, ogImage: v })} />
              <Field def={{ name: 'noIndex', label: 'Hide from search engines', type: 'boolean' }} value={page.seo?.noIndex} onChange={(v) => setPageField('seo', { ...page.seo, noIndex: v })} />
              <Field
                def={{ name: 'canonical', label: 'Canonical URL', type: 'url', help: 'Only when this page mirrors another URL. Empty = this page is its own canonical.' }}
                value={page.seo?.canonical}
                onChange={(v) => setPageField('seo', { ...page.seo, canonical: v })}
              />
              <Field
                def={{ name: 'jsonLd', label: 'Structured data (JSON-LD)', type: 'textarea', help: 'Raw JSON-LD, rendered as-is in a script tag. Validate at schema.org before saving.' }}
                value={page.seo?.jsonLd}
                onChange={(v) => setPageField('seo', { ...page.seo, jsonLd: v })}
              />

              <SubHeading>Page defaults</SubHeading>
              <Muted className="mb-3">
                Background and colours behind the whole page. Sections override these.
              </Muted>
              <StylePanel style={page.style} onChange={(v) => setPageField('style', v)} showVisibility={false} scope="page" />
            </>
          )}

          {tab === 'content' && block && block.type === 'shared' && (
            <>
              <Muted className="mb-3 block">
                This section mirrors a shared component. Edit the component itself under
                “Shared components” — changes there update every page using it, live pages
                included.
              </Muted>
              <Field
                def={{
                  name: 'refId', label: 'Shared component', type: 'select',
                  options: (doc.sharedBlocks ?? []).map((sb) => ({ label: sb.name, value: sb.id })),
                }}
                value={block.data.refId}
                onChange={(v) => setBlockData('refId', v)}
              />
            </>
          )}

          {tab === 'content' && block && block.type !== 'shared' && def && (
            <>
              <Field
                def={{ name: 'label', label: 'Section nickname (admin only)', type: 'text', placeholder: def.name }}
                value={block.label}
                onChange={(v) => update((d) => {
                  const b = d.pages.find((x) => x.id === pageId)?.blocks.find((x) => x.id === blockId);
                  if (b) b.label = v;
                })}
              />
              <hr className="my-3.5 border-0 border-t border-edge" />
              {def.fields.map((f) => (
                <Field key={f.name} def={f} value={block.data[f.name]} onChange={(v) => setBlockData(f.name, v)} />
              ))}
            </>
          )}

          {tab === 'style' && block && <StylePanel style={block.style} onChange={setBlockStyle} />}

          {tab !== 'page' && !block && <Muted className="p-[22px]">Pick a section to edit it.</Muted>}
        </div>
      </div>

      {/* ---------------- pane 4: preview ---------------- */}
      <div className="flex min-w-0 flex-col bg-app">
        <PaneHeader title="Preview">
          <Button size="sm" variant="primary" onClick={saveAndPreview}>
            {dirty ? 'Save & refresh' : 'Refresh'}
          </Button>
        </PaneHeader>
        {page && (
          <iframe
            key={previewKey}
            className="min-h-[60vh] w-full flex-1 border border-edge bg-white"
            src={`/${page.slug}?preview=1`}
            title="Preview"
          />
        )}
        <Muted className="p-[22px]">Unsaved edits are not in the preview until you save.</Muted>
      </div>
    </div>
  );
}