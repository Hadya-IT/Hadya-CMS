'use client';

import { useState } from 'react';
import { useAdmin } from '@/components/admin/AdminProvider';
import { ButtonLabel, ErrorNote, IconButton, Muted } from '@/components/admin/ui';

export default function MediaLibrary() {
  const { doc, loading, reload } = useAdmin();
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

  async function remove(id: string, name: string) {
    if (!confirm(`Delete ${name}? Any section still using it will show a broken image.`)) return;
    const r = await fetch('/api/media', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error || 'Could not delete that image.');
    }
    reload();
  }

  if (loading || !doc) return <div className="p-[22px] text-dim">Loading…</div>;

  return (
    <div className="p-[22px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="mb-1 text-[17px] font-medium">Media library</h2>
          <Muted>Images available to every section. Uploads land in /uploads.</Muted>
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

      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3.5">
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
                <IconButton
                  className="w-auto px-2"
                  onClick={() => navigator.clipboard.writeText(m.url)}
                  title={m.url}
                >
                  Copy path
                </IconButton>
                <IconButton
                  danger
                  className="w-auto px-2"
                  onClick={() => remove(m.id, m.name)}
                >
                  Delete
                </IconButton>
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
