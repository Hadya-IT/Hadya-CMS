'use client';

import { useState } from 'react';
import type { FieldDef } from '@/lib/types';
import { useAdmin } from './AdminProvider';
import {
  Button,
  ButtonLabel,
  FieldShell,
  IconButton,
  Input,
  Muted,
  Select,
  Textarea,
  Toggle,
  cx,
} from './ui';

/* ------------------------------------------------------------------
   Forms are generated from the block registry. Adding a new section
   type never requires touching this file.
-------------------------------------------------------------------*/

export function MediaPicker({
  value, onChange, label,
}: { value?: string; onChange: (v: string) => void; label?: string }) {
  const { doc, update } = useAdmin();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function upload(file: File) {
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/media', { method: 'POST', body: fd });
      const item = await r.json();
      if (!r.ok) throw new Error(item.error || 'Upload failed.');

      /* The upload wrote to the document server-side, which bumped its
         version. Adopting that version here is essential: without it the
         editor holds a stale number and the NEXT save fails the optimistic
         lock with "someone else saved changes while you were editing" — when
         nobody had. Invisible on the file driver (no version check), fatal
         on Oracle. */
      const { version, optimised, note, ...media } = item as Record<string, any>;
      update((d) => {
        d.media.unshift(media as any);
        if (typeof version === 'number') d.version = version;
      });
      if (optimised === false && note) setError(`Stored, but not optimised — ${note}`);
      onChange(media.url);
      if (optimised !== false) setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FieldShell label={label}>
      <div className="flex gap-2.5">
        <div
          className="grid size-[60px] w-[74px] flex-none place-items-center rounded-panel border
            border-edge bg-app bg-cover bg-center text-[10px] text-dim"
          style={value ? { backgroundImage: `url("${value}")` } : undefined}
        >
          {!value && <span>No image</span>}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Input
            value={value || ''}
            placeholder="/uploads/…"
            onChange={(e) => onChange(e.target.value)}
          />
          <div className="flex flex-wrap gap-[5px]">
            <Button size="sm" onClick={() => setOpen(!open)}>
              {open ? 'Close' : 'Choose'}
            </Button>
            <ButtonLabel size="sm">
              {busy ? 'Uploading…' : 'Upload'}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
              />
            </ButtonLabel>
            {value && (
              <Button size="sm" variant="danger" onClick={() => onChange('')}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && <span className="mt-1.5 block text-[11px] text-danger">{error}</span>}

      {open && (
        <div
          className="mt-2 grid max-h-[210px] grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-[5px]
            overflow-y-auto rounded-panel border border-edge bg-app p-1.5"
        >
          {(doc?.media || []).map((m) => (
            <button
              key={m.id}
              type="button"
              className={cx(
                'aspect-square cursor-pointer rounded-[5px] border-2 bg-cover bg-center',
                value === m.url ? 'border-gold' : 'border-transparent hover:border-edge-strong',
              )}
              style={{ backgroundImage: `url("${m.url}")` }}
              title={m.name}
              aria-label={`Use ${m.name}`}
              onClick={() => { onChange(m.url); setOpen(false); }}
            />
          ))}
          {(doc?.media || []).length === 0 && (
            <Muted className="col-span-full">
              Nothing in the library yet. Upload an image to start.
            </Muted>
          )}
        </div>
      )}
    </FieldShell>
  );
}

export function Field({
  def, value, onChange,
}: { def: FieldDef; value: any; onChange: (v: any) => void }) {
  const id = `f_${def.name}`;

  if (def.type === 'image') return <MediaPicker label={def.label} value={value} onChange={onChange} />;

  if (def.type === 'array') {
    const rows: any[] = Array.isArray(value) ? value : [];
    const move = (i: number, dir: -1 | 1) => {
      const next = [...rows];
      const j = i + dir;
      if (j < 0 || j >= next.length) return;
      [next[i], next[j]] = [next[j], next[i]];
      onChange(next);
    };
    const blank = Object.fromEntries((def.fields || []).map((f) => [f.name, f.type === 'boolean' ? false : '']));
    return (
      <FieldShell label={def.label}>
        <div className="mb-2.5 flex flex-col gap-1.5">
          {rows.map((row, i) => (
            <details
              className="group rounded-panel border border-edge bg-panel"
              key={i}
              open={rows.length <= 3}
            >
              <summary
                className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2
                  [&::-webkit-details-marker]:hidden"
              >
                <span className="font-mono text-[10px] text-gold">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="flex-1 truncate text-xs">
                  {row.title || row.q || row.value || row.label || row.caption || `${def.itemLabel || 'Item'} ${i + 1}`}
                </span>
                <span className="flex gap-0.5">
                  <IconButton
                    onClick={(e) => { e.preventDefault(); move(i, -1); }}
                    title="Move up"
                    aria-label="Move up"
                  >↑</IconButton>
                  <IconButton
                    onClick={(e) => { e.preventDefault(); move(i, 1); }}
                    title="Move down"
                    aria-label="Move down"
                  >↓</IconButton>
                  <IconButton
                    danger
                    onClick={(e) => { e.preventDefault(); onChange(rows.filter((_, k) => k !== i)); }}
                    title="Delete"
                    aria-label="Delete"
                  >×</IconButton>
                </span>
              </summary>
              <div className="border-t border-edge px-2.5 pb-3 pt-1.5">
                {(def.fields || []).map((sub) => (
                  <Field
                    key={sub.name}
                    def={sub}
                    value={row[sub.name]}
                    onChange={(v) => {
                      const next = [...rows];
                      next[i] = { ...next[i], [sub.name]: v };
                      onChange(next);
                    }}
                  />
                ))}
              </div>
            </details>
          ))}
        </div>
        <Button
          size="sm"
          disabled={!!def.max && rows.length >= def.max}
          onClick={() => onChange([...rows, blank])}
        >
          + Add {def.itemLabel || 'item'}
        </Button>
        {def.max && <span className="ml-2 text-xs text-dim">{rows.length}/{def.max}</span>}
      </FieldShell>
    );
  }

  return (
    <FieldShell label={def.label} htmlFor={id} help={def.help}>
      {def.type === 'textarea' && (
        <Textarea id={id} value={value ?? ''} placeholder={def.placeholder}
          onChange={(e) => onChange(e.target.value)} />
      )}

      {def.type === 'html' && (
        <Textarea code id={id} value={value ?? ''} placeholder={def.placeholder}
          onChange={(e) => onChange(e.target.value)} />
      )}

      {def.type === 'select' && (
        <Select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          {(def.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      )}

      {def.type === 'boolean' && (
        <Toggle checked={!!value} label={def.label} onChange={onChange} />
      )}

      {def.type === 'number' && (
        <div className="flex items-center gap-2.5">
          <input
            type="range"
            className="flex-1 accent-gold"
            aria-label={def.label}
            min={def.min ?? 0}
            max={def.max ?? 100}
            step={def.step ?? 1}
            value={Number(value ?? def.min ?? 0)}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <Input
            className="w-[74px] flex-none"
            type="number"
            aria-label={`${def.label} value`}
            value={Number(value ?? 0)}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        </div>
      )}

      {def.type === 'color' && (
        <div className="flex items-center gap-2">
          <input
            type="color"
            className="h-8 w-[34px] cursor-pointer rounded-panel border border-edge bg-transparent p-0"
            aria-label={def.label}
            value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000'}
            onChange={(e) => onChange(e.target.value)}
          />
          <Input value={value ?? ''} placeholder="inherit"
            onChange={(e) => onChange(e.target.value)} />
          {value && <Button size="sm" onClick={() => onChange('')}>Clear</Button>}
        </div>
      )}

      {(def.type === 'text' || def.type === 'url') && (
        <Input id={id} value={value ?? ''} placeholder={def.placeholder}
          onChange={(e) => onChange(e.target.value)} />
      )}
    </FieldShell>
  );
}
