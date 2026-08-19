'use client';

import {
  createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode,
} from 'react';
import type { ContentDoc, Page, Block } from '@/lib/types';
import { BLOCK_MAP } from '@/blocks/registry';
import { DEFAULT_STYLE } from '@/lib/style';

interface Ctx {
  doc: ContentDoc | null;
  loading: boolean;
  dirty: boolean;
  saving: boolean;
  error: string;
  driver: string;
  update: (fn: (d: ContentDoc) => void) => void;
  save: () => Promise<void>;
  reload: () => Promise<void>;
  newBlock: (type: string) => Block;
  newPage: () => Page;
}

const AdminCtx = createContext<Ctx>(null as any);
export const useAdmin = () => useContext(AdminCtx);

function rid(p: string) {
  return `${p}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

export default function AdminProvider({ children }: { children: ReactNode }) {
  const [doc, setDoc] = useState<ContentDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [driver, setDriver] = useState('');
  const dirtyRef = useRef(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/content', { cache: 'no-store' });
      if (r.status === 401) throw new Error('Your session expired. Sign in again.');
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || 'Could not load content.');
      }
      const json = await r.json();
      setDriver(json._driver || '');
      setDoc(json);
      setDirty(false);
      dirtyRef.current = false;
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  /* warn before losing unsaved edits */
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  const update = useCallback((fn: (d: ContentDoc) => void) => {
    setDoc((prev) => {
      if (!prev) return prev;
      const next: ContentDoc = JSON.parse(JSON.stringify(prev));
      fn(next);
      return next;
    });
    setDirty(true);
    dirtyRef.current = true;
  }, []);

  const save = useCallback(async () => {
    if (!doc) return;
    setSaving(true);
    setError('');
    try {
      const r = await fetch('/api/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc),
      });
      const payload = await r.json();
      if (!r.ok) throw new Error(payload.error || 'Save failed.');
      setDoc((d) => (d ? { ...d, version: payload.version } : d));
      setDirty(false);
      dirtyRef.current = false;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }, [doc]);

  const newBlock = useCallback((type: string): Block => {
    const def = BLOCK_MAP[type];
    return {
      id: rid('blk'),
      type,
      label: '',
      style: { ...DEFAULT_STYLE, ...(def?.defaultStyle || {}) } as any,
      data: JSON.parse(JSON.stringify(def?.defaultData || {})),
    };
  }, []);

  const newPage = useCallback((): Page => ({
    id: rid('pg'),
    title: 'New page',
    slug: `new-page-${Math.random().toString(36).slice(2, 6)}`,
    navLabel: 'New page',
    showInNav: false,
    navOrder: 99,
    status: 'draft',
    seo: { title: '', description: '', ogImage: '', noIndex: false },
    style: { ...DEFAULT_STYLE } as any,
    blocks: [],
    updatedAt: new Date().toISOString(),
  }), []);

  return (
    <AdminCtx.Provider value={{ doc, loading, dirty, saving, error, driver, update, save, reload, newBlock, newPage }}>
      {children}
    </AdminCtx.Provider>
  );
}
