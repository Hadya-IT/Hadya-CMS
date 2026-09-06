'use client';

/* ================================================================
   /admin/shared — NEW. Manage reusable components.

   A shared component is one block (any type from the registry) with
   a name. Pages insert a lightweight reference to it; editing the
   component here updates every page that uses it — LIVE pages
   included, immediately, with no review step. That is why the
   content API only accepts sharedBlocks changes from publish-capable
   roles (Approver / Marketing Admin); everyone else can look but the
   save silently keeps the stored definitions.
   ================================================================ */

import { useMemo, useState } from 'react';
import { useAdmin } from '@/components/admin/AdminProvider';
import { useDialog } from '@/components/admin/Dialog';
import { Field } from '@/components/admin/Fields';
import StylePanel from '@/components/admin/StylePanel';
import { Button, Card, ErrorNote, Input, Muted, PaneHeader, Pill, Select, SubHeading, cx } from '@/components/admin/ui';
import { BLOCKS, BLOCK_MAP } from '@/blocks/registry';
import { SHARED_TYPE } from '@/lib/shared';

const CAN_EDIT = new Set(['APPROVER', 'MARKETING_ADMIN']);

export default function SharedComponents() {
  const { doc, loading, update, save, dirty, saving, error, newBlock } = useAdmin();
  const dialog = useDialog();
  const [selId, setSelId] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState(BLOCKS[0]?.type || '');
  const [tab, setTab] = useState<'content' | 'style'>('content');

  const shared = doc?.sharedBlocks ?? [];
  const sel = useMemo(() => shared.find((s) => s.id === selId), [shared, selId]);
  const def = sel ? BLOCK_MAP[sel.block.type] : null;
  const editable = CAN_EDIT.has(String((doc as any)?._role || ''));

  /** Pages referencing a shared id, drafts and published snapshots both. */
  function usage(id: string) {
    return (doc?.pages ?? []).filter((p) => {
      const inDraft = p.blocks.some((b) => b.type === SHARED_TYPE && b.data?.refId === id);
      const inLive = (p.lastPublished?.blocks ?? []).some(
        (b: any) => b.type === SHARED_TYPE && b.data?.refId === id,
      );
      return inDraft || inLive;
    });
  }

  if (loading || !doc) return <div className="p-[22px] text-dim">Loading…</div>;

  const create = () => {
    if (!newName.trim() || !newType) return;
    const block = newBlock(newType);
    const id = `sh_${Math.random().toString(36).slice(2, 9)}`;
    update((d) => {
      if (!Array.isArray(d.sharedBlocks)) d.sharedBlocks = [];
      d.sharedBlocks.push({ id, name: newName.trim(), block });
    });
    setNewName('');
    setSelId(id);
    setTab('content');
  };

  const remove = async (id: string) => {
    const used = usage(id);
    const name = shared.find((s) => s.id === id)?.name;
    const sure = await dialog.confirm(
      used.length
        ? {
            title: `"${name}" is still in use`,
            body: `Used on: ${used.map((p) => p.title).join(', ')}.\nThose sections will disappear from the pages.`,
            confirmLabel: 'Delete anyway',
            danger: true,
          }
        : { title: `Delete "${name}"?`, confirmLabel: 'Delete', danger: true },
    );
    if (!sure) return;
    update((d) => { d.sharedBlocks = (d.sharedBlocks ?? []).filter((s) => s.id !== id); });
    if (selId === id) setSelId('');
  };

  const setData = (k: string, v: any) =>
    update((d) => {
      const s = d.sharedBlocks?.find((x) => x.id === selId);
      if (s) s.block.data[k] = v;
    });
  const setStyle = (v: any) =>
    update((d) => {
      const s = d.sharedBlocks?.find((x) => x.id === selId);
      if (s) s.block.style = v;
    });
  const rename = (v: string) =>
    update((d) => {
      const s = d.sharedBlocks?.find((x) => x.id === selId);
      if (s) s.name = v;
    });

  return (
    <div className="grid grid-cols-1 xl:h-[calc(100vh-52px)] xl:grid-cols-[300px_minmax(360px,1fr)]">
      {/* ------------- left: list + create ------------- */}
      <div className="min-w-0 border-b border-edge bg-panel xl:overflow-y-auto xl:border-b-0 xl:border-r">
        <PaneHeader title="Shared components" />
        <div className="px-3 pb-3">
          <Muted className="mb-3 block text-[12px]">
            One place to edit common CTAs, contact strips, banners. Every page using a
            component updates the moment it is saved — live pages included.
          </Muted>
          {!editable && (
            <Muted className="mb-3 block text-[12px]">
              Your role can view these but not change them — edits here go live without
              review, so they need a publish-capable role.
            </Muted>
          )}
          {editable && (
            <Card className="mb-3">
              <Input placeholder="Name — e.g. Contact CTA" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <div className="mt-2 flex gap-2">
                <Select value={newType} onChange={(e) => setNewType(e.target.value)}>
                  {BLOCKS.map((b) => <option key={b.type} value={b.type}>{b.name}</option>)}
                </Select>
                <Button size="sm" disabled={!newName.trim()} onClick={create}>Create</Button>
              </div>
            </Card>
          )}

          <ul className="list-none">
            {shared.map((s) => {
              const used = usage(s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => { setSelId(s.id); setTab('content'); }}
                    className={cx(
                      'mb-0.5 block w-full cursor-pointer rounded-panel border px-2.5 py-[9px] text-left',
                      s.id === selId ? 'border-gold/40 bg-subtle' : 'border-transparent hover:bg-subtle/60',
                    )}
                  >
                    <span className="block text-[12.5px] font-medium">{s.name}</span>
                    <span className="text-[11px] text-dim">
                      {BLOCK_MAP[s.block.type]?.name || s.block.type}
                    </span>
                    <Pill tone={used.length ? 'ok' : 'neutral'} className="ml-2">
                      {used.length ? `used on ${used.length} page${used.length > 1 ? 's' : ''}` : 'unused'}
                    </Pill>
                  </button>
                </li>
              );
            })}
            {shared.length === 0 && <Muted>No shared components yet.</Muted>}
          </ul>
        </div>
      </div>

      {/* ------------- right: editor ------------- */}
      <div className="min-w-0 bg-app xl:overflow-y-auto">
        {!sel ? (
          <Muted className="block p-[22px]">Pick a component to edit it.</Muted>
        ) : (
          <div className="px-4 pb-16 pt-4">
            {error && <ErrorNote>{error}</ErrorNote>}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="min-w-[220px] flex-1">
                <Input value={sel.name} disabled={!editable} onChange={(e) => rename(e.target.value)} />
              </div>
              {editable && (
                <>
                  <Button size="sm" variant="primary" disabled={!dirty || saving} onClick={() => save()}>
                    {saving ? 'Saving…' : dirty ? 'Save (goes live)' : 'Saved'}
                  </Button>
                  <Button size="sm" onClick={() => remove(sel.id)}>Delete</Button>
                </>
              )}
            </div>
            <SubHeading>Used on</SubHeading>
            <Muted className="mb-3 block">
              {usage(sel.id).map((p) => p.title).join(', ') || 'No page uses this yet — insert it from “+ Add section” in the page editor.'}
            </Muted>

            <div className="mb-3 flex gap-0.5 border-b border-edge">
              {(['content', 'style'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cx(
                    'cursor-pointer border-b-2 px-3 py-2 text-xs capitalize transition-colors',
                    tab === t ? 'border-gold text-gold' : 'border-transparent text-dim hover:text-ink',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            <fieldset disabled={!editable} className="min-w-0 border-0 p-0">
              {tab === 'content' && def && def.fields.map((f) => (
                <Field key={f.name} def={f} value={sel.block.data[f.name]} onChange={(v) => setData(f.name, v)} />
              ))}
              {tab === 'style' && <StylePanel style={sel.block.style} onChange={setStyle} />}
            </fieldset>
          </div>
        )}
      </div>
    </div>
  );
}