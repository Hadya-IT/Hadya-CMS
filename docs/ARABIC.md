# Arabic and right-to-left

The site can serve Arabic alongside English. English stays the canonical
content and Arabic is an **overlay** on top of it.

---

## The model, and why it is this one

`page.i18n.ar` stores only the fields somebody actually translated. Anything
missing falls through to the English value when the page renders.

That choice has three consequences worth understanding before you rely on it:

- **A half-translated page still works.** An untranslated section renders in
  English rather than disappearing or showing an empty box. You can publish
  Arabic incrementally instead of waiting for a complete pass.
- **There is one document, not two.** Adding Arabic does not duplicate the
  page structure or the media library, so restructuring a page in English
  does not orphan its Arabic version — the translations are keyed to block
  IDs, which survive reordering.
- **A section cannot exist in Arabic only.** If you ever need genuinely
  different pages per language — a campaign that runs only in Arabic — that
  is a second `pages` array, not an extension of this. Say so before someone
  builds it the wrong way.

Blank means *not translated*, which is why there is no "copy English across"
button: it would make untranslated content indistinguishable from content
deliberately left the same.

---

## Routing

The default locale is unprefixed and every other locale is a path prefix:

```
/about-us        English
/ar/about-us     Arabic
```

The prefix is stripped inside the existing `[[...slug]]` catch-all by
`splitLocale()`. There is deliberately **no `[locale]` route segment** — that
would collide with the optional catch-all that already matches every path.

`dir="rtl"` and `lang="ar"` are set on the page wrapper rather than on
`<html>`, because the root layout is shared with the admin portal, which is
always left-to-right. Every logical CSS property in the site resolves against
the nearest `dir`, so this is the correct scope.

**The one caveat:** browser chrome that reads `dir` from `<html>` — mainly
which side the scrollbar sits on — stays LTR. Nobody has ever noticed this on
a site that is otherwise correct, but you should know it before someone
reports it as a bug.

---

## Turning it on

1. **Settings → Languages →** enable Arabic, save
2. **Translation** in the sidebar: pick a page, fill in the Arabic column
3. The header language switch appears automatically once a second language is
   on

The translation screen shows the English value read-only beside an Arabic
input, and lists fields generated from the block registry — so a new block
type becomes translatable with no code change. Use **Only untranslated** to
work through what is left.

---

## What is translatable

| | |
|---|---|
| ✅ | Page title, menu label, SEO title and description |
| ✅ | Every text, paragraph, HTML and URL field on every section |
| ✅ | Form labels, buttons, thank-you messages, consent lines |
| ✅ | Cookie banner heading and body |
| ✅ | Brand tagline, header CTA, footer copy (Settings → i18n) |
| ✅ | Interface strings — "Sending…", validation messages — built in |
| ❌ | **Repeatable list items** — projects, cards, FAQ rows, stats |
| ❌ | Image alt text per locale (the field exists, no UI yet) |

### The list-item gap

This is the real limitation and it is worth being direct about it. Sections
with repeatable lists — `workGrid` projects, `cardGrid` sectors, `accordion`
Q&A rows, `statsBand` figures — cannot have their items translated yet.

It was left out rather than half-built because the obvious implementation
keys translations by array index, and then reordering the list in English
silently reattaches every Arabic string to the wrong item. Fixing it properly
means giving list items stable IDs first, which is a migration on existing
content.

Until then, the workaround is one of:

- Duplicate the page, translate the duplicate's lists in place, and set the
  Arabic page's slug to `ar/…` by hand
- Keep list-heavy sections in English on Arabic pages
- Ask for the item-ID migration as a follow-up

The translation screen tells you which sections are affected rather than
pretending they are complete.

---

## Typography

Two Arabic faces are loaded and selectable per section in the Design tab:

- **Amiri** — serif, for headings. Pairs with the English serif identity.
- **IBM Plex Sans Arabic** — sans, for body copy.

Arabic text runs roughly 15–25% shorter than the same English content but
needs more line height, because the script has deeper descenders. The default
`--sec-leading` of 1.6 is usually too tight for Arabic body copy — 1.8 reads
better. Set it per section in the Design tab.

**Get a native reader to review it before launch.** Mechanically correct
Arabic typography still looks wrong to someone who reads it daily, and the
things they will catch — a heading broken at the wrong point, a number that
should be Eastern Arabic numerals, a serif face that reads as dated — are not
things this codebase can check for you.

---

## What still needs doing for a full Arabic launch

- Translate the content (the mechanism is ready; the words are not)
- Fix list-item translation, or accept the workaround above
- Review Arabic line heights per section
- Native-reader review of the copy and the typography
- Decide whether Arabic should be the default locale on `.sa` domains — it is
  a one-line change in `enabledLocales` ordering, but a real editorial
  decision
