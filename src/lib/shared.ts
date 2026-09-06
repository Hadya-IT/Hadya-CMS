import type { Block, SharedBlock } from './types';

/* ------------------------------------------------------------------
   Reusable components: a page block of type 'shared' is a pointer
   ({ data: { refId } }) into doc.sharedBlocks. Expansion happens at
   render time — public site AND editor preview — so a shared block
   edited once changes everywhere immediately, published pages
   included. Snapshots therefore store the REFERENCE, not a copy.

   The instance keeps its own id (anchors stay stable) and its own
   `hidden` flag, so one page can hide a shared section without
   hiding it everywhere. Everything else comes from the shared
   definition.
-------------------------------------------------------------------*/

export const SHARED_TYPE = 'shared';

export function expandShared(
  blocks: Block[],
  shared: SharedBlock[] | undefined,
): Block[] {
  if (!blocks.some((b) => b.type === SHARED_TYPE)) return blocks;
  const byId = new Map((shared ?? []).map((s) => [s.id, s]));

  return blocks.map((b) => {
    if (b.type !== SHARED_TYPE) return b;
    const ref = byId.get(String(b.data?.refId || ''));
    if (!ref) {
      // Dangling reference (shared block deleted): render nothing rather
      // than an "Unknown block type" error on the public site.
      return { ...b, style: { ...b.style, hidden: true } };
    }
    return {
      ...ref.block,
      id: b.id,
      label: b.label || ref.name,
      style: { ...ref.block.style, hidden: b.style?.hidden ?? ref.block.style?.hidden },
    };
  });
}

/** Page ids (with titles) that reference a given shared block —
 *  checked before deleting one, same idea as media usage. */
export function sharedUsage(
  pages: { id: string; title: string; blocks: Block[]; lastPublished?: { blocks: Block[] } }[],
  sharedId: string,
): { pageId: string; title: string }[] {
  const hits: { pageId: string; title: string }[] = [];
  for (const p of pages) {
    const inDraft = p.blocks.some((b) => b.type === SHARED_TYPE && b.data?.refId === sharedId);
    const inLive = (p.lastPublished?.blocks ?? []).some(
      (b) => b.type === SHARED_TYPE && b.data?.refId === sharedId,
    );
    if (inDraft || inLive) hits.push({ pageId: p.id, title: p.title });
  }
  return hits;
}
