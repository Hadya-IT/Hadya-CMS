# Changes — v3

Six features requested from marketing's plugin list, plus the two bugs from
the code review.

**Verified with:** `npx tsc --noEmit` (clean), `next build` (23 routes, up
from 15), and a live server smoke test of every feature — see
[Verification](#verification) for what was actually exercised.

```bash
npm install          # pulls in sharp
cp .env.example .env.local   # then fill in — see "New settings" below
npm run doctor
npm run dev
```

If you already have a database, run the migration once:

```bash
sqlplus $DB_USER/$DB_PASSWORD@$DB_CONNECT_STRING @db/003-forms-i18n.sql
```

It is safe to re-run — each change checks whether it has already been applied.
A fresh database from `db/schema.sql` already has everything.

---

## 1. Arabic / RTL

English stays canonical; Arabic is an overlay in `page.i18n.ar` holding only
the fields somebody translated, with everything else falling through to
English. A half-translated page renders rather than breaking.

- `/ar/about-us` style routing, stripped inside the existing catch-all — no
  new route segment, because `[locale]` would collide with `[[...slug]]`
- `dir="rtl"` / `lang="ar"` on the page wrapper, header language switch,
  hreflang alternates, `/ar/` URLs in the sitemap
- New **Translation** screen, with its field list generated from the block
  registry so new block types are translatable with no code change

**Not done: repeatable list items** (projects, cards, FAQ rows). Keying
translations by array index means reordering the English list silently
reattaches every Arabic string to the wrong item. Needs stable item IDs first.
The UI flags affected sections rather than pretending they are complete.
Details and workarounds in `docs/ARABIC.md`.

## 2. Form builder

**Forms** screen: build a form, place it anywhere with the new **Form**
section. Eight field types, per-field Arabic labels, CRM mapping, per-form
recipients, optional PDPL consent checkbox.

Validation runs against the **stored** definition, never the posted keys —
unknown keys are dropped. Without that it is a spam relay. Answers with no
fixed column go to `answers_json` and are appended to the Dynamics lead notes
rather than discarded.

Field machine names are generated once and then locked, because they are the
storage key; renaming would orphan historical submissions. Labels stay
editable.

## 3. Cookie consent (PDPL)

- Accept and Decline are the **same size** — a styled-down decline is the dark
  pattern regulators name explicitly
- Nothing pre-ticked; no dismiss-without-choosing
- **GTM does not load at all** until a choice exists, and Consent Mode v2
  defaults are pushed as denied first. No decision, no network request
- Reopen link for withdrawing consent later

Editable text (both languages) in **Settings → Cookie consent**. Note the
banner is about *tracking*; the form consent line is about *contact* — see
`docs/FORMS.md`.

## 4. Sitemap, robots, redirects

- `/sitemap.xml` generated per request from published pages, excluding drafts,
  no-index pages and `/grid-demo`, with hreflang alternates
- `/robots.txt` blocks the portal and API, and **disallows everything unless
  `SITE_URL` is set** — failing closed so a staging deployment cannot get
  indexed
- Editor-managed redirects in **SEO & redirects**, with `/old/*` → `/new/*`
  wildcards, loop detection, and a warning when a rule points at a live page

Redirects fire in the catch-all just before `notFound()`. Middleware runs on
the Edge runtime and cannot reach Oracle; `next.config` redirects need a
rebuild. The upside: a rule can never shadow live content, so a typo is inert.

## 5. Email notifications

Microsoft Graph `sendMail` via client credentials, reusing the Entra app —
same pattern as `dynamics.ts`. Internal notification with `Reply-To` set to
the enquirer, plus an optional confirmation to the submitter in their own
language.

Stored first, emailed second. Failures are logged and retryable from
**Submissions**; they never reach the visitor.

**`Mail.Send` as an application permission lets the app send as any mailbox in
the tenant.** `docs/EMAIL.md` has the Application Access Policy commands to
scope it to one — treat that as part of the setup, not optional hardening.

## 6. Image optimisation

WebP renditions at 480/960/1600 generated on upload, emitted as `srcset` and
as `image-set()` for the CSS background layers all eight image blocks use.
Never upscales. Strips EXIF, because phone photos carry GPS coordinates and a
public bucket is not the place for the photographer's home address.

Measured on your own assets:

| File | Original | 480w | 960w | 1600w |
|---|---|---|---|---|
| `hero.jpg` (1600×900) | 103 KB | 10 KB | 27 KB | 63 KB |
| `movenpick.jpg` (863×575) | 84 KB | 27 KB | — | — |

`sharp` is a lazy import and every failure degrades to "store the original" —
a broken native build on Windows should not break uploads. **System status**
reports which mode you are in.

Uploads are also now served `immutable` for a year instead of one hour;
filenames already carry a timestamp, so the URL never changes content.

---

## Bugs fixed

**Media upload no longer causes a false conflict.** Uploading an image inside
the page editor bumped the document version server-side while the editor kept
the old number, so the next save failed the optimistic lock with *"Someone
else saved changes while you were editing"* — when nobody had. `/api/media`
now returns the new version and the picker adopts it. Invisible on the file
driver, guaranteed on Oracle.

**Draft preview requires authentication.** `?preview=1` was ungated, so anyone
who guessed a slug could read unpublished pages. It now checks for a
signed-in EDITOR or ADMIN, and a previewed page is always `noindex`.

**Rate limiter hardened.** It took `X-Forwarded-For[0]`, which the client
controls — rotate the header and the limit never fires. It now counts back
from the right by `TRUSTED_PROXY_HOPS`. The old `hits.clear()` at 5,000 keys
also let an attacker spray fake IPs to reset everyone's counter; it now evicts
expired entries instead.

**SVG uploads removed.** An SVG is a script container served from your own
origin — stored XSS against any signed-in editor who opens it. Uploads now
also carry `X-Content-Type-Options: nosniff` and a sandbox CSP. The comment in
`api/media/route.ts` says exactly what to re-add if you need vector logos.

**`metadataBase` warning gone** — set from `SITE_URL`, which also makes OG
image paths absolute.

**`/grid-demo` is now a draft and no-index.** It was published, despite the
README saying to delete it before launch.

---

## New settings

Server-side, in `.env.local` (all optional — see `.env.example`):

| Variable | For |
|---|---|
| `SITE_URL` | Sitemap and robots. **Blank = robots disallows all crawling** |
| `MAIL_FROM` | The mailbox notifications send from. Blank = email off |
| `MAIL_TENANT_ID` / `MAIL_CLIENT_ID` / `MAIL_CLIENT_SECRET` | Optional; blank reuses `AZURE_AD_*` |
| `TRUSTED_PROXY_HOPS` | Proxies in front of the app. Default 1 |

In the portal: **Settings** gains Languages, Cookie consent and Form
notifications. New sidebar entries: **Forms**, **Translation**, **SEO &
redirects**.

`npm run doctor` checks all of the above offline, including whether `sharp`
actually loads — resolving the package is not enough, since the binary is
platform-specific.

---

## Verification

Beyond the build and typecheck, these were exercised against a running
server:

- Sitemap: 9 URLs, `/grid-demo` excluded, `/ar/` URLs appear when Arabic is on
- robots.txt: correct with `SITE_URL`; disallows all without it
- Consent banner renders; **zero** `googletagmanager` references before a
  choice is made
- `/grid-demo?preview=1` → 404 unauthenticated
- Redirects: `/old-about` → 308, `/news/2024/q3` → 307 `/insights/2024/q3`,
  and a rule pointing at the live `/about-us` correctly does **not** fire
- Arabic: `/ar/about-us` → 200 with `dir="rtl"`, translated title and heading
  used, untranslated blocks falling back to English, nav and switcher
  locale-aware
- Forms: valid submit stored; missing/invalid fields return per-field errors;
  **injected keys (`evil`, `isAdmin`) dropped and never stored**; honeypot
  returns 200 and stores nothing; unknown form ID → 404

Test data was reverted afterwards — `content.json` ships with Arabic off, no
redirects, and the default contact form.

---

## Still not done

- **Repeatable list items in Arabic** (above) — needs stable item IDs
- **Per-locale image alt text** — the field exists, no UI
- **The analytics dashboard is still sample data.** `getGa4Analytics()`
  throws. Marketing will open that screen and believe the numbers; connecting
  a real GA4 reader is a separate job
- **Revision history has no UI** — restore works via `POST /api/content`
- **Approval before publish, and scheduled publishing** — neither exists
- The consent reopen link is exported but not yet placed in the footer by
  default; drop `<ConsentReopenLink />` into `SiteFooter` where you want it
