'use client';

/* ================================================================
   In-app dialogs — NEW. Replaces every browser alert()/confirm()
   in the admin with a styled modal that matches the CMS.

   Usage:
     const dialog = useDialog();
     const ok = await dialog.confirm({ title, body, confirmLabel, danger });
     await dialog.alert({ title, body });

   Promise-based, so existing `if (!confirm(...)) return;` call sites
   become `if (!(await dialog.confirm({...}))) return;` — same flow,
   no restructuring. Mounted once in app/admin/layout.tsx.
   ================================================================ */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button, cx } from './ui';

export interface DialogOptions {
  title: string;
  /** Plain text; newlines become paragraphs. Or pass rich content in `content`. */
  body?: string;
  content?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
}

interface DialogApi {
  confirm: (opts: DialogOptions) => Promise<boolean>;
  alert: (opts: DialogOptions) => Promise<void>;
}

const DialogCtx = createContext<DialogApi>({
  // Fallbacks so a stray call outside the provider still works.
  confirm: async (o) => window.confirm(o.title + (o.body ? '\n\n' + o.body : '')),
  alert: async (o) => window.alert(o.title + (o.body ? '\n\n' + o.body : '')),
});

export const useDialog = () => useContext(DialogCtx);

type Pending = DialogOptions & { kind: 'confirm' | 'alert'; resolve: (v: boolean) => void };

export function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirmBtn = useRef<HTMLButtonElement>(null);

  const open = useCallback(
    (kind: 'confirm' | 'alert', opts: DialogOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...opts, kind, resolve })),
    [],
  );

  const confirm = useCallback((o: DialogOptions) => open('confirm', o), [open]);
  const alertFn = useCallback(async (o: DialogOptions) => { await open('alert', o); }, [open]);

  const close = useCallback((value: boolean) => {
    setPending((p) => {
      p?.resolve(value);
      return null;
    });
  }, []);

  /* Esc cancels; focus lands on the primary button so Enter confirms. */
  useEffect(() => {
    if (!pending) return;
    confirmBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, close]);

  return (
    <DialogCtx.Provider value={{ confirm, alert: alertFn }}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close(false); // click outside = cancel
          }}
        >
          <div
            role={pending.kind === 'confirm' ? 'alertdialog' : 'dialog'}
            aria-modal="true"
            aria-label={pending.title}
            className="w-full max-w-[420px] rounded-panel border border-edge bg-panel p-5
              shadow-[0_18px_50px_rgb(16_24_40/0.25)]"
          >
            <h3 className="text-[15px] font-semibold text-ink">{pending.title}</h3>

            {pending.body && (
              <div className="mt-2 text-[13px] leading-relaxed text-dim">
                {pending.body.split('\n').map((line, i) =>
                  line.trim() ? <p key={i} className="mb-1">{line}</p> : <div key={i} className="h-1.5" />,
                )}
              </div>
            )}
            {pending.content && <div className="mt-2 text-[13px]">{pending.content}</div>}

            <div className="mt-4 flex justify-end gap-2">
              {pending.kind === 'confirm' && (
                <Button size="sm" onClick={() => close(false)}>
                  {pending.cancelLabel || 'Cancel'}
                </Button>
              )}
              <button
                ref={confirmBtn}
                type="button"
                onClick={() => close(true)}
                className={cx(
                  'cursor-pointer rounded-panel px-3.5 py-[7px] text-xs font-semibold text-white',
                  'transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
                  pending.danger
                    ? 'bg-[#c2412f] hover:brightness-95'
                    : 'bg-ink hover:bg-ink-lift',
                )}
              >
                {pending.confirmLabel || (pending.kind === 'confirm' ? 'Confirm' : 'OK')}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogCtx.Provider>
  );
}