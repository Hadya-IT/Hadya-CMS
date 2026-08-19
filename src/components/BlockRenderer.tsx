import type { Block, FormDef, Locale, MediaItem, SiteSettings } from '@/lib/types';
import { RENDERERS } from '@/blocks/components';
import { envelopeToCss, envelopeClasses } from '@/lib/style';
import { Wrap } from '@/components/site/ui';

export default function BlockRenderer({
  block,
  settings,
  media,
  forms,
  locale = 'en',
}: {
  block: Block;
  settings: SiteSettings;
  /** Media library, so blocks can resolve responsive renditions for a URL. */
  media?: MediaItem[];
  forms?: FormDef[];
  locale?: Locale;
}) {
  if (block.style?.hidden) return null;
  const Cmp = RENDERERS[block.type];
  if (!Cmp) {
    /* Shown rather than swallowed: a page that silently drops a section is
       harder to debug than one that says which type is missing. */
    return (
      <section className="bg-app py-10 font-mono text-xs text-danger">
        <Wrap>
          Unknown block type: <code>{block.type}</code>
        </Wrap>
      </section>
    );
  }
  return (
    <section
      id={block.id}
      className={envelopeClasses(block.style)}
      style={envelopeToCss(block.style, settings)}
    >
      <Cmp block={block} settings={settings} media={media} forms={forms} locale={locale} />
    </section>
  );
}
