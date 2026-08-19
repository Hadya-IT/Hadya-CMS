'use client';

import { useMemo, useState } from 'react';
import { useAdmin } from '@/components/admin/AdminProvider';
import {
  Card,
  CardTitle,
  FieldShell,
  Input,
  Muted,
  PaneHeader,
  Select,
  SubHeading,
  Textarea,
  Toggle,
  cx,
} from '@/components/admin/ui';
import { BLOCK_MAP } from '@/blocks/registry';
import { LOCALES } from '@/lib/types';
import type { Block, FieldDef, Locale, Page, PageTranslation } from '@/lib/types';

/* ------------------------------------------------------------------
   The translation screen.

   WHY THIS IS SEPARATE from the page editor. The editor is already a
   four-pane layout at the edge of what fits on a laptop; adding a
   side-by-side language column would have made it unusable. More
   importantly, translating is a different job done by a different person at
   a different time — usually in one sitting, across every page.

   WHAT IT SHOWS. The English value, read-only, next to an Arabic input. The
   field list is generated from the block registry, so a new block type
   becomes translatable with no change here. Only text-bearing field types
   are included: numbers, colours, booleans and image pickers are not
   language-specific, and offering to translate a column count would be
   noise.

   BLANK MEANS NOT TRANSLATED. It falls through to English at render time,
   which is why there is no "copy English across" button — that would make
   untranslated content indistinguishable from deliberately identical
   content.
-------------------------------------------------------------------*/

/** Field types that hold language. */
const TEXTUAL = new Set(['text', 'textarea', 'html', 'url']);

/** Longer inputs deserve a textarea. */
const MULTILINE = new Set(['textarea', 'html']);

export default function TranslateAdmin() {
  const { doc, loading, update } = useAdmin();
  const [pageId, setPageId] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>('ar');
  const [onlyMissing, setOnlyMissing] = useState(false);

  if (loading || !doc) return <div className="p-[22px] text-dim">Loading…</div>;

  const localeOptions = LOCALES.filter((l) => l.code !== 'en');
  const enabled = doc.settings.locales?.enabled || ['en'];
  const active = doc.pages.find((p) => p.id === pageId) || doc.pages[0] || null;

  if (enabled.length < 2) {
    return (
      <div className="p-[22px]">
        <h2 className="mb-1 text-[17px] font-medium">Translation</h2>
        <Muted className="max-w-[62ch]">
          No second language is switched on yet. Go to <strong>Settings → Languages</strong>, enable
          Arabic, save, and this screen will list every translatable field.
        </Muted>
      </div>
    );
  }

  function setTranslation(page: Page, fn: (tr: PageTranslation) => void) {
    update((d) => {
      const target = d.pages.find((p) => p.id === page.id);
      if (!target) return;
      if (!target.i18n) target.i18n = {};
      if (!target.i18n[locale]) target.i18n[locale] = {};
      fn(target.i18n[locale] as PageTranslation);
    });
  }

  const stats = useMemo(() => {
    let total = 0;
    let done = 0;
    for (const page of doc.pages) {
      const tr = page.i18n?.[locale];
      for (const block of page.blocks) {
        const def = BLOCK_MAP[block.type];
        for (const f of def?.fields || []) {
          if (!TEXTUAL.has(f.type)) continue;
          if (!String(block.data?.[f.name] ?? '').trim()) continue;
          total++;
          if (String(tr?.blocks?.[block.id]?.[f.name] ?? '').trim()) done++;
        }
      }
    }
    return { total, done };
  }, [doc.pages, locale]);

  return (
    <div className="grid min-h-0 xl:grid-cols-[260px_1fr]">
      <aside className="border-b border-edge xl:border-b-0 xl:border-r">
        <PaneHeader title="Pages" />
        <div className="border-b border-edge p-2.5">
          <FieldShell label="Language">
            <Select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
              {localeOptions.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </Select>
          </FieldShell>
          <label className="flex items-center gap-2.5 text-[12px] text-dim">
            <Toggle label="Only untranslated" checked={onlyMissing} onChange={setOnlyMissing} />
            Only untranslated
          </label>
          <Muted className="mt-3">
            {stats.done} of {stats.total} fields translated across the site.
          </Muted>
        </div>
        <div className="flex flex-col gap-1 p-2.5">
          {doc.pages.map((p) => {
            const tr = p.i18n?.[locale];
            const translatedCount = Object.values(tr?.blocks || {}).reduce(
              (n, fields) => n + Object.values(fields).filter((v) => String(v).trim()).length,
              0,
            );
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPageId(p.id)}
                className={cx(
                  'rounded-panel px-3 py-2.5 text-left transition-colors',
                  active?.id === p.id
                    ? 'bg-subtle text-gold'
                    : 'text-dim hover:bg-subtle hover:text-ink',
                )}
              >
                <strong className="block text-[12.5px] font-medium">{p.title}</strong>
                <small className="text-[11px] text-dim">
                  /{p.slug} · {translatedCount || 'none'}
                  {translatedCount ? ' translated' : ''}
                </small>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="min-w-0 p-[22px]">
        {!active ? (
          <Muted>No pages yet.</Muted>
        ) : (
          <>
            <h2 className="mb-1 text-[17px] font-medium">
              {active.title} — {LOCALES.find((l) => l.code === locale)?.label}
            </h2>
            <Muted className="mb-5 max-w-[70ch]">
              Leave a field blank to keep the English text on that locale. Nothing here changes the
              English site.
            </Muted>

            {/* ------------------------------------------ page level */}
            <Card className="mb-5">
              <CardTitle>Page and SEO</CardTitle>
              <TranslationField
                label="Page title"
                english={active.title}
                value={active.i18n?.[locale]?.title || ''}
                onChange={(v) => setTranslation(active, (tr) => { tr.title = v; })}
                locale={locale}
              />
              <TranslationField
                label="Menu label"
                english={active.navLabel || active.title}
                value={active.i18n?.[locale]?.navLabel || ''}
                onChange={(v) => setTranslation(active, (tr) => { tr.navLabel = v; })}
                locale={locale}
              />
              <TranslationField
                label="SEO title"
                english={active.seo?.title || ''}
                value={active.i18n?.[locale]?.seo?.title || ''}
                onChange={(v) =>
                  setTranslation(active, (tr) => {
                    if (!tr.seo) tr.seo = {};
                    tr.seo.title = v;
                  })
                }
                locale={locale}
              />
              <TranslationField
                label="SEO description"
                english={active.seo?.description || ''}
                multiline
                value={active.i18n?.[locale]?.seo?.description || ''}
                onChange={(v) =>
                  setTranslation(active, (tr) => {
                    if (!tr.seo) tr.seo = {};
                    tr.seo.description = v;
                  })
                }
                locale={locale}
              />
            </Card>

            {/* --------------------------------------- block level */}
            {active.blocks.map((block, i) => (
              <BlockTranslations
                key={block.id}
                block={block}
                index={i}
                locale={locale}
                onlyMissing={onlyMissing}
                values={active.i18n?.[locale]?.blocks?.[block.id] || {}}
                onChange={(fieldName, v) =>
                  setTranslation(active, (tr) => {
                    if (!tr.blocks) tr.blocks = {};
                    if (!tr.blocks[block.id]) tr.blocks[block.id] = {};
                    tr.blocks[block.id][fieldName] = v;
                  })
                }
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------- one block's fields ------------------------- */

function BlockTranslations({
  block,
  index,
  locale,
  values,
  onlyMissing,
  onChange,
}: {
  block: Block;
  index: number;
  locale: Locale;
  values: Record<string, string>;
  onlyMissing: boolean;
  onChange: (fieldName: string, value: string) => void;
}) {
  const def = BLOCK_MAP[block.type];
  if (!def) return null;

  /* Only fields that actually contain English text are worth showing —
     an empty optional field has nothing to translate. */
  const fields = def.fields.filter((f: FieldDef) => {
    if (!TEXTUAL.has(f.type)) return false;
    if (!String(block.data?.[f.name] ?? '').trim()) return false;
    if (onlyMissing && String(values[f.name] ?? '').trim()) return false;
    return true;
  });

  /* Repeatable lists (projects, cards, FAQ rows) are not covered here.
     Translating array items needs a per-item editor, and doing it badly —
     e.g. by index — silently corrupts content when an editor reorders the
     list. Flagged rather than half-built. */
  const arrayFields = def.fields.filter((f: FieldDef) => f.type === 'array');

  if (!fields.length && !arrayFields.length) return null;

  return (
    <Card className="mb-4">
      <CardTitle>
        {index + 1}. {block.label || def.name}
      </CardTitle>

      {fields.map((f) => (
        <TranslationField
          key={f.name}
          label={f.label}
          english={String(block.data?.[f.name] ?? '')}
          multiline={MULTILINE.has(f.type)}
          html={f.type === 'html'}
          value={values[f.name] || ''}
          onChange={(v) => onChange(f.name, v)}
          locale={locale}
        />
      ))}

      {arrayFields.length > 0 && (
        <p className="mt-2 rounded-panel bg-subtle px-3 py-2.5 text-[11.5px] text-dim">
          This section also has a repeatable list ({arrayFields.map((f) => f.label).join(', ')}).
          List items are not translatable yet — see docs/ARABIC.md.
        </p>
      )}
    </Card>
  );
}

/* --------------------------- one field pair --------------------------- */

function TranslationField({
  label,
  english,
  value,
  onChange,
  locale,
  multiline,
  html,
}: {
  label: string;
  english: string;
  value: string;
  onChange: (v: string) => void;
  locale: Locale;
  multiline?: boolean;
  html?: boolean;
}) {
  const rtl = locale === 'ar';
  const translated = !!value.trim();

  return (
    <div className="mb-4 grid gap-2.5 md:grid-cols-2">
      <div className="min-w-0">
        <span className="mb-1.5 block text-[11px] uppercase tracking-[0.1em] text-dim">
          {label} — English
        </span>
        <div
          className="min-h-[38px] whitespace-pre-wrap rounded-panel border border-edge
            bg-subtle px-2.5 py-2 font-sans text-[12.5px] text-dim"
        >
          {english || <em>(empty)</em>}
        </div>
      </div>

      <FieldShell
        label={`${label} — ${locale.toUpperCase()}${translated ? '' : ' (not translated)'}`}
        help={html ? 'HTML is preserved — keep the <em> and <br> tags in place.' : undefined}
      >
        {multiline ? (
          <Textarea
            rows={3}
            dir={rtl ? 'rtl' : 'ltr'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <Input
            dir={rtl ? 'rtl' : 'ltr'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </FieldShell>
    </div>
  );
}
