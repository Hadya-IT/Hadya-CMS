# Changes in this pass

Two things to do before anything else:

1. **Rotate the secrets that were in the archive.** It shipped a live
   `AZURE_AD_CLIENT_SECRET` and `NEXTAUTH_SECRET` in `.env`, plus the Oracle
   mTLS wallet private keys in `wallet/` (`ewallet.p12`, `ewallet.pem`,
   `keystore.jks`, `cwallet.sso`). Assume all of them are compromised:
   regenerate the Entra client secret, generate a new `NEXTAUTH_SECRET`
   (`openssl rand -base64 32`), and re-download the DB wallet from OCI.
2. **Review the public site visually.** Its stylesheet was missing entirely
   (see below), so the design has been reconstructed rather than converted.

```bash
cp .env.example .env.local   # then fill in
npm install
npm run dev
```

Verified with `npx tsc --noEmit` (clean) and `next build` (15 routes, compiles
with no env file present).

---

## CSS → Tailwind

`src/app/admin/admin.css` (22 KB, ~200 rules) is **deleted**. There is no
stylesheet left in the project except `src/app/globals.css`, which now holds
only the Tailwind v4 `@theme` token block and a small base layer.

| Was | Now |
| --- | --- |
| `.ad`, `.ed`, `.lg` shells and their tokens | `@theme` tokens in `globals.css` + utilities in the components |
| `.btn`, `.inp`, `.fld`, `.pill`, `.chip`, `.card`, `.tog` … | typed primitives in `src/components/admin/ui.tsx` |
| `.sec`, `.wrap`, `.eyebrow`, `.h2`, `.stat`, `.b-*` … | primitives in `src/components/site/ui.tsx` + utilities in the blocks |
| `.rv--fade-up.is-in` and friends | utility class pairs in `Reveal.tsx` |

Anything used once is inline at its call site. Only genuinely repeated
elements became components, so a button still cannot drift from the other
buttons — but there is no stylesheet to keep in sync with the markup.

### Why the site variables were kept

The CMS's core feature is that one style panel restyles any block at runtime:
`envelopeToCss()` writes `--sec-heading-scale`, `--sec-gap`, `--sec-max`,
`--cols` and about a dozen others onto every `<section>` on each request.
Static utility classes cannot express that, so flattening them would have
broken the editor.

The site therefore uses Tailwind utilities **over** those variables. They are
registered once in `@theme`, so `text-h2` compiles to
`calc(clamp(1.85rem, 3.1vw, 2.7rem) * var(--sec-heading-scale, 1))` and
`max-w-sec` to `var(--sec-max)`. Editor control is intact; the CSS is Tailwind.

Three things genuinely need keyframes and are registered in `@theme` as
Tailwind animations (`animate-kenburns`, `animate-flow`,
`animate-scroll-hint`). The only element selectors left in the project are in
`@layer base`, scoped to `[data-rich]` / `[data-display]`: that is
editor-authored HTML arriving from the CMS as a trusted string, so there is no
markup to hang a utility on.

---

## The public site had no CSS

`globals.css` was 23 bytes — just `@import "tailwindcss";`. Every site class
(`.sec`, `.wrap`, `.nav`, `.b-hero`, `.b-split`, `.rv`, `.cform`, `.acc`,
`.splash`, `.foot`, ~150 in total) was undefined, so the live site was
rendering completely unstyled.

There was nothing to convert, so it has been written: all 14 block components,
plus the header, footer, splash, accordion and contact form. The direction
follows the cream / navy / gold serif identity implied by the design tokens
and the notes in the old admin stylesheet.

**This part is a reconstruction from the markup and token names, not a
recovered original.** Proportions, spacing and hover behaviour are judgement
calls. If you have a backup of the old stylesheet, diff against it.

---

## Bugs fixed

**Two auth configs were fighting, and RBAC was broken.** `lib/auth.ts` had the
complete implementation (SSO + local, `ADMIN`/`EDITOR` mapping, audit trail,
domain allowlist), but `api/auth/[...nextauth]/route.ts` redefined
`authOptions` inline with only Azure AD. NextAuth mounted the second one, so
the token carried `roles` while `currentAdmin()` read `role`. Consequences:

- nobody could ever hold `ADMIN` — the role always fell back to `DEFAULT_ROLE`
- the Settings nav item was hidden from every user
- `PUT /api/content` silently discarded **every** settings change
- `POST /api/content` (restore revision) always returned 403

Now consolidated on `lib/auth.ts`, with `middleware.ts` reading the same
claim.

**Sign-out 404'd.** `lib/auth.ts` and `AdminShell` pointed at `/admin/login`;
the page is at `/login`. Same for the auth error redirect.

**Dead CSS variable.** `.tbl` row hover, `.tbl__detail` and `.ad__role` all
referenced `--primary`, which was never declared — `color-mix()` failed and
those styles silently did nothing. Now on real tokens.

**Editor unusable below ~1200px.** The four-pane grid had fixed
`220px 262px minmax(320px,1fr) minmax(340px,1.15fr)` tracks with no fallback.
It now stacks below `xl`.

**Media upload errors were swallowed.** `MediaPicker` and the media library
used `alert()` or dropped failures; both now surface the server's message
inline.

---

## Removed

| Path | Why |
| --- | --- |
| `.next/`, `node_modules/` | build output |
| `.env`, `wallet/*`, `oci/*` | live secrets — rotate them |
| `src/app/admin/admin.css` | converted |
| `src/app/api/auth/modes/route.ts` | nothing called it |
| `src/components/admin/SessionProvider.tsx` | nested inside the root provider — two independent session fetches |

`.gitignore` now allowlists `wallet/.gitkeep` and `oci/.gitkeep` instead of
ignoring the whole directory, so the folders survive a clone.

---

## Accessibility and polish

Added throughout, since none of it was present: visible keyboard focus rings;
row tool buttons revealed on `focus-within` rather than hover only;
`aria-label` on icon-only buttons and unlabelled inputs; real `<form>` +
`type="submit"` on the contact form (it was a `<div>` with a click handler, so
Enter did nothing); `aria-expanded` / `aria-controls` on the accordion;
`motion-reduce:` on every animation; scroll lock while the mobile menu is
open; the splash overlay now unmounts instead of lingering as an invisible
layer over the page.

The login page was already Tailwind but used generic indigo against a
navy/gold brand, and read "Webiste management" and "your ticket panel".
Rewritten in brand colours with the duplicated fallback markup collapsed and
the copy fixed.

---

## One known regression

`lib/auth.ts` still supports a local username/password provider that disables
itself once SSO is configured, but the login page is SSO-only. With no
`AZURE_AD_*` set locally there is no way to sign in. This was already true
before this pass — the local sign-in form had been removed from the page while
the provider stayed in the config, and `/api/auth/modes` (which existed to
tell the page which doors were open) was left orphaned.

If you want local development sign-in back, the provider is still wired; it
needs a form on the login page plus a way to ask the server whether local
login is enabled.
