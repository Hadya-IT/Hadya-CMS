'use client';

/* ================================================================
   /admin/media — FULL REPLACEMENT (v2).

   Change vs v1: Delete now goes through the usage check. If the file
   is still referenced, the server answers 409 with the list of pages;
   the user sees exactly where it is used and must confirm a second
   time to force-delete. Files that no longer exist on disk delete
   cleanly (the record is the thing being removed).
   ================================================================ */

import { useState } from 'react';
import { useAdmin } from '@/components/admin/AdminProvider';
import { useDialog } from '@/components/admin/Dialog';
import { ButtonLabel, ErrorNote, IconButton, Muted } from '@/components/admin/ui';

export default function MediaLibrary() {
  const { doc, loading, reload } = useAdmin();
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError('');
    const failed: string[] = [];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/media', { method: 'POST', body: fd });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        failed.push(`${file.name}: ${j.error || 'upload failed'}`);
      }
    }
    setBusy(false);
    if (failed.length) setError(failed.join(' · '));
    reload();
  }

  async function callDelete(id: string, force: boolean) {
    const r = await fetch('/api/media', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, force }),
    });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, j };
  }

  async function whereUsed(url: string, name: string) {
    const r = await fetch('/api/media/usage?url=' + encodeURIComponent(url), { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error || 'Could not check usage.'); return; }
    const places = [
      ...(j.pages || []).map((p: any) => `• ${p.title} (${p.where})`),
      ...(j.settings ? ['• site settings (logo/favicon?)'] : []),
      ...(j.forms ? ['• a form'] : []),
    ].join('\n');
    await dialog.alert({
      title: j.inUse ? `${name} is used in:` : `${name} is not used anywhere`,
      body: j.inUse ? places : 'Safe to delete — no page, setting, or form references it.',
      confirmLabel: 'Close',
    });
  }

  async function remove(id: string, name: string) {
    const sure = await dialog.confirm({
      title: `Delete ${name}?`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!sure) return;
    setError('');

    let res = await callDelete(id, false);

    // 409 in-use: show WHERE it is used, then offer a deliberate override.
    if (res.status === 409 && res.j?.error === 'in-use') {
      const u = res.j.usage || {};
      const places = [
        ...(u.pages || []).map((p: any) => `• ${p.title} (${p.where})`),
        ...(u.inShared ? ['• a shared component'] : []),
        ...(u.inSettings ? ['• site settings (logo/favicon?)'] : []),
      ].join('\n');
      const go = await dialog.confirm({
        title: 'This image is still in use',
        body: `"${name}" is being used in:\n${places}\nDeleting it will leave broken images there.`,
        confirmLabel: 'Delete anyway',
        danger: true,
      });
      if (!go) return;
      res = await callDelete(id, true);
    }

    if (!res.ok) setError(res.j?.error || 'Could not delete that image.');
    reload();
  }

  if (loading || !doc) return <div className="p-[22px] text-dim">Loading…</div>;

  return (
    <div className="p-[22px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="mb-1 text-[17px] font-medium">Media library</h2>
          <Muted>Images available to every section. Deleting checks where a file is used first.</Muted>
        </div>
        <ButtonLabel variant="primary">
          {busy ? 'Uploading…' : 'Upload images'}
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => upload(e.target.files)}
          />
        </ButtonLabel>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
        {doc.media.map((m) => (
          <figure
            key={m.id}
            className="overflow-hidden rounded-panel border border-edge bg-panel"
          >
            <div
              className="aspect-[4/3] bg-subtle bg-cover bg-center"
              style={{ backgroundImage: `url("${m.url}")` }}
              role="img"
              aria-label={m.alt || m.name}
            />
            <figcaption className="px-[11px] py-[9px]">
              <strong className="block truncate text-xs font-medium" title={m.name}>
                {m.name}
              </strong>
              <small className="text-[11px] text-dim">{(m.size / 1024).toFixed(0)} KB</small>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(m.url)}
                  title={m.url}
                  className="cursor-pointer whitespace-nowrap rounded-panel border border-[#d99a2b]
      bg-[#f5a623] px-2 py-1 text-[11px] font-semibold text-white
      transition hover:brightness-95"
                >
                  Copy path
                </button>
                <button
                  type="button"
                  onClick={() => whereUsed(m.url, m.name)}
                  title="Where is this image used?"
                  className="cursor-pointer whitespace-nowrap rounded-panel border border-[#2e9e44]
      bg-[#3cb85a] px-2 py-1 text-[11px] font-semibold text-white
      transition hover:brightness-95"
                >
                  Where it is Used?
                </button>
                <button
                  type="button"
                  onClick={() => remove(m.id, m.name)}
                  className="cursor-pointer whitespace-nowrap rounded-panel border border-[#7a1f1f]
      bg-[#9e2b25] px-2 py-1 text-[11px] font-semibold text-white
      transition hover:brightness-95"
                >
                  Delete
                </button>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>

      {doc.media.length === 0 && (
        <div className="mt-4 rounded-panel border border-edge bg-panel p-8 text-center">
          <strong className="mb-1.5 block">No images yet.</strong>
          <Muted>Upload one to use it as a background or inside a card.</Muted>
        </div>
      )}
    </div>
  );
}