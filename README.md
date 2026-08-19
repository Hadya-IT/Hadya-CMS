# Hadya — block-based CMS + website

A Next.js 15 site where every page is composed from a library of pre-built
sections. Editors add pages, add and reorder sections, upload images, change
colours, fonts, sizes, spacing and backgrounds, and pick animation presets —
without touching code and without being able to break the layout.

Sign-in is Microsoft Entra ID with app-role based access. Content lives in an
Oracle Autonomous Database. Website enquiries are captured and pushed into
Dynamics 365 as leads.

---

## Start here

**→ [SETUP.md](SETUP.md)** is the ordered runbook: config file, SSO, database,
Dynamics, and a troubleshooting table. Follow it top to bottom.

```bash
npm install
npm run setup     # creates .env.local and tells you what to fill in
npm run doctor    # checks the config makes sense, offline
npm run dev
```

- Site — <http://localhost:3000>
- Portal — <http://localhost:3000/admin>
- Status — <http://localhost:3000/admin/status> (what is wired up, and why not)

> **The one thing that catches everyone.** Next.js reads **`.env.local`**. It
> does not read `.env.example`, which is only a template. If SSO and the
> database both appear to be ignoring your settings, check which file they are
> in — and remember that changes need a `npm run dev` restart.

Supporting guides:

| Doc | Covers |
|---|---|
| [SETUP.md](SETUP.md) | The ordered setup runbook + troubleshooting table |
| [docs/ENTRA.md](docs/ENTRA.md) | App registration, redirect URIs, app roles, `AADSTS` codes |
| [docs/DYNAMICS365.md](docs/DYNAMICS365.md) | Dataverse leads, the application-user step, field mapping |
| [docs/FORMS.md](docs/FORMS.md) | Building forms, CRM mapping, spam defences |
| [docs/ARABIC.md](docs/ARABIC.md) | Arabic/RTL, the translation model, what is not covered |
| [docs/EMAIL.md](docs/EMAIL.md) | Graph `Mail.Send`, and scoping it to one mailbox |
| [UPDATING.md](UPDATING.md) | Applying a new version without losing content |
| [CHANGES-v3.md](CHANGES-v3.md) | What changed in the latest pass |

### Commands

| Command | Does |
|---|---|
| `npm run setup` | Creates `.env.local`, generates `NEXTAUTH_SECRET`, lists what is blank |
| `npm run doctor` | Offline check: config coherence, SSO shape, wallet, aliases |
| `npm run db:test` | Connects to Oracle for real and names the failure |
| `npm run db:seed` | Pushes `data/content.json` into the database |
| `npm run db:export` | Pulls the database back into `data/content.json` |
| `npm run dev` / `build` / `start` | The usual Next.js three |

---

## Every subsystem has two drivers

Nothing is hardcoded to one backend. Each picks its driver from environment
variables at runtime, so the app runs with zero infrastructure and you add
pieces one at a time.

| Subsystem | Production driver | Fallback | Chosen by |
|---|---|---|---|
| Content | Oracle Autonomous DB | `data/content.json` | `DB_USER` + `DB_CONNECT_STRING` |
| Media | OCI Object Storage | `public/uploads/` | `OCI_NAMESPACE` + `OCI_BUCKET` |
| Sign-in | Microsoft Entra ID | username + password | `AZURE_AD_*` |
| Leads | `cms_form_submission` → Dynamics 365 | `data/leads.json` | `DYNAMICS_ENABLED` |
| Notifications | Microsoft Graph `sendMail` | none — submissions still stored | `MAIL_FROM` |
| Images | `sharp` → WebP renditions | original served as-is | `sharp` installed |

Three consequences worth knowing:

- **Local login switches itself off** the moment SSO is configured, so a
  deployed app cannot be entered through a leftover local password. Override
  with `ENABLE_LOCAL_LOGIN=true` only if you have a reason.
- **A database outage does not take the public site down.** Reads fall back to
  the bundled `data/content.json` and log the error. Saves still fail, loudly.
- **A Dynamics outage never loses a lead.** Submissions are stored first and
  pushed second; failures are recorded and retryable from `/admin/leads`.

`/admin/status` reports each subsystem, names the exact environment variable
blocking it, and can run a live connection test — so diagnosing a deployment
does not require terminal access.

---

## Access control

Authentication is Entra ID. Authorisation comes from **Entra App Roles**, which
arrive in the id_token as a `roles` claim and are mapped in `src/lib/auth.ts`.

| Role | Can do | Entra app role value |
|---|---|---|
| `EDITOR` | Pages, sections, media, submissions | `Editor` |
| `ADMIN` | The above, plus site settings and revision restore | `Admin` |

Two things to be clear about:

**Enforcement is server-side.** `src/lib/rbac.ts` guards every route that reads
or writes. The hidden sidebar link and the middleware redirect are
conveniences, not the boundary — anyone can type a URL or use curl. If you add
an API route, call `requireEditor()` or `requireAdmin()` as its first line.

**Roles are baked into the session at sign-in.** Changing someone's role in
Entra does not affect their current session; they sign out and back in.
Sessions last 12 hours. `docs/ENTRA.md` explains where to hook in if you would
rather look roles up per request.

Set `REQUIRE_ENTRA_ROLE=true` in production, or anyone in an allowed email
domain gets `EDITOR` by default.

---

## Tables

| Table | Purpose |
|---|---|
| `cms_document` | The live site — one JSON document per tenant, with a version counter |
| `cms_document_history` | Previous versions, newest 50 kept. Replaces `data/backups/` |
| `cms_admin_audit` | Who signed in, saved, uploaded and deleted, and when |
| `cms_form_submission` | Website enquiries and their Dynamics 365 push status |

Saves use **optimistic locking**: the update only applies if the version you
loaded is still current. Two admins saving at once gets the second a `409` and
a message, instead of silently discarding the first one's work.

Connection uses oracledb **thin mode** — no Instant Client install — through a
single pool reused across hot reloads. `db/schema.sql` creates everything;
`db/002-form-submissions.sql` is the same submissions table on its own, for
databases created before it existed. `db/reset.sql` drops everything.

---

## What the editor can do

| | |
|---|---|
| **Pages** | Create, duplicate, delete, rename, set the URL slug, draft/publish, control menu placement and order |
| **Sections** | Add from a library of 15, reorder, duplicate, hide, delete, give each an admin-only nickname |
| **Content** | Every field of every section — text, HTML, images, repeatable lists (projects, stats, cards, FAQ rows) |
| **Design** | Theme preset, background (colour / gradient / image + darkening + parallax), heading / body / accent / border colours, heading and body font, heading and body size multipliers, line height, letter spacing, uppercase, padding above and below, gap, content width, corner radius |
| **Motion** | 8 animation presets, plus duration and delay |
| **Visibility** | Hide a section entirely, or hide it on mobile only |
| **SEO** | Per page title, meta description, share image, no-index |
| **Media** | Upload, browse, copy path, delete |
| **Forms** | Build forms without a developer — fields, types, validation, CRM mapping, recipients |
| **Submissions** | Read every website enquiry, see whether it reached Dynamics 365, retry failed pushes and notification emails |
| **Translation** | Arabic for every page, section field, form and the cookie banner |
| **SEO** | Redirects with wildcards; sitemap and robots generated automatically |
| **Status** | See which subsystems are configured and test the database and CRM connections |
| **Global** | Brand name, logos, favicon, all design tokens, header, footer links, intro splash |

### The deliberate limit

Editors control **colour, type, spacing and motion per section**. They do not
control layout *within* a section — that stays owned by the component.

This is the line between a block CMS and a visual page builder. Handing over
arbitrary layout control is what produces inconsistent, slow, broken-on-mobile
pages within a few months. If you later decide you want per-element overrides,
add them consciously rather than by drift.

---

## Pages that ship with it

The original single-page mockup has been split into separate routes:

```
/              Home        hero · legacy · sectors · works · news · careers
/about-us      About Us    banner · intro · stats · leadership · careers
/legacy        Legacy      banner · statement · stats · gallery
/portfolio     Portfolio   banner · all projects · contact
/sectors       Sectors     banner · four sectors · FAQ
/leadership    Leadership  banner · president
/news          News        banner · newsletters
/careers       Careers     banner · why us · apply
/contact-us    Contact     banner · address, map, form
```

All copy and all ten images come from the mockup.

---

## Grids

Every grid block takes **three** column counts — desktop, tablet, mobile — so a
4-across row can become 2-across on a tablet and 1-across on a phone without
touching CSS.

**There is no "2x4" setting.** Rows come from how many items you add:
2 columns + 4 cards = 2×2. 2 columns + 8 cards = 2×4. 4 columns + 16 cards = 4×4.

`productGrid` adds five card layouts:

| Layout | What it looks like |
|---|---|
| Text below image | Plain — image, then title and text underneath |
| Text below, in a box | Same, wrapped in a bordered card that lifts on hover |
| Text over image | Centred over a darkened image |
| Text over image, bottom | Sits at the bottom over a gradient — best for names and prices |
| Text over image, on hover | Image only until hover, then text fades in (shows permanently on touch devices) |

Per card: image, title, tag line, price/meta, description, link. The tag, body,
price and link label can each be switched off for the whole grid.

There is a **Grid demo** page at `/grid-demo` showing all five side by side. It
is set to no-index and is not in the menu — delete it when you're done.

---

## Section library

| Type | Group | What it is |
|---|---|---|
| `hero` | Hero & banners | Full-height opener, background image, footer captions |
| `imageBanner` | Hero & banners | Short interior-page banner |
| `richText` | Text | Eyebrow, heading, formatted body, optional two columns |
| `splitFeature` | Text | Statement + body + stats, angled image opposite |
| `statsBand` | Text | Row of numbers with labels |
| `accordion` | Text | Expandable Q&A rows |
| `cardGrid` | Grids & cards | Numbered image cards — sectors, services |
| `productGrid` | Grids & cards | Flexible card grid — 1–6 columns, text below or over the image |
| `workGrid` | Grids & cards | Staggered portfolio grid |
| `profile` | Grids & cards | Copy + portrait with name and role |
| `linkCards` | Grids & cards | Bordered cards linking out |
| `gallery` | Media | Image grid with captions |
| `ctaBand` | Conversion | Full-width call to action |
| `contact` | Conversion | Address, inquiries, map, enquiry form |
| `form` | Conversion | Any form built in Forms, with heading and intro |

### Adding a section type

Three steps, and the admin needs no changes — its forms are generated from
the registry.

1. Add a `BlockDef` to `src/blocks/registry.ts`
2. Add the component to `src/blocks/components.tsx`
3. Register it in the `RENDERERS` map at the bottom of that file

**Treat this as permanent API surface.** Once an editor uses a section on a
live page, renaming its fields needs a migration. Around a dozen is the right
number — resist adding more for a few months and see where people actually hit
walls.

---

## How it fits together

```
src/
├── app/
│   ├── (site)/[[...slug]]/page.tsx   slug -> page -> render its sections
│   ├── admin/                        pages · media · forms · leads · translate
│   │                                 analytics · seo · settings · status · guide
│   ├── sitemap.ts / robots.ts        generated from published pages
│   └── api/
│       ├── auth/[...nextauth]        Entra ID + local credentials
│       ├── content                   read/save the document, restore a revision
│       ├── media                     upload/delete images
│       ├── forms                     PUBLIC lead capture · admin list · retry
│       ├── health                    per-subsystem status, signed-in only
│       └── uploads/[...path]         serves images added after a build
├── blocks/
│   ├── registry.ts                   the section contract (schemas)
│   └── components.tsx                the section renderers
├── components/
│   ├── admin/                        provider · shell · fields · style panel
│   └── …                             header · footer · splash · reveal · contact form
├── lib/
│   ├── env.ts                        is each subsystem configured, and if not, why
│   ├── auth.ts                       Entra SSO + app-role mapping + local fallback
│   ├── rbac.ts                       server-side role guards (the real boundary)
│   ├── db.ts                         Oracle thin-mode pool, ping, audit
│   ├── store.ts                      content read/write, optimistic locking, revisions
│   ├── leads.ts                      store submission, then push to CRM
│   ├── dynamics.ts                   Dataverse client-credentials client
│   ├── storage.ts                    OCI Object Storage or local disk
│   ├── style.ts                      style envelope -> CSS custom properties
│   ├── i18n.ts                       locales, RTL, the translation overlay
│   ├── formdefs.ts                   form schema + server-side validation
│   ├── consent.ts                    consent cookie + Google Consent Mode
│   ├── mail.ts                       Graph sendMail + email templates
│   ├── images.ts                     WebP renditions on upload
│   ├── redirects.ts                  editor-managed redirect matching
│   └── types.ts                      data model
├── types/next-auth.d.ts              session.user.role typing
└── middleware.ts                     gate /admin, redirect non-admins off /settings

db/     schema.sql · 002-form-submissions.sql · 003-forms-i18n.sql · reset.sql
docs/   ENTRA.md · DYNAMICS365.md
scripts/ setup.mjs · doctor.mjs · test-db.mjs · seed-oracle.mjs · export-oracle.mjs
data/content.json                     the entire site content (file driver)
public/uploads/                       images (local media driver)
wallet/                               Oracle wallet — git-ignored, is a credential
oci/                                  OCI API signing key — git-ignored
```

### The style envelope

Every block carries the same style object. `envelopeToCss()` turns it into CSS
custom properties (`--sec-bg`, `--sec-heading`, `--sec-body-scale`, …) set
inline on the section element. Components read only those variables — never
hardcoded colours. That is why one style panel can restyle any section.

### Rendering

Pages are `force-dynamic`, so a save in the admin shows up on the next request.
No rebuild, no revalidation step.

---

## Before this goes live

The checklist with checkboxes is in [SETUP.md](SETUP.md#6-before-it-goes-live).
The reasoning behind the items that are easy to dismiss:

**Rotate every credential that has been in a chat, an email or a zip.** Wallet
files, `.pem` keys, client secrets and `.env.local` are credentials, not
configuration. An earlier version of this folder shipped a real client secret
inside `.env.example`, which `.gitignore` does not exclude — assume it is
public and issue a new one.

**Set `ADMIN_ALLOWED_DOMAINS` and `REQUIRE_ENTRA_ROLE=true`.** Without the
allowlist, every account in your Entra tenant — including guests — can edit the
website. Without the role requirement, everyone who gets in is an `EDITOR`.

**Turn off the local password.** `ENABLE_LOCAL_LOGIN=false`. It disables itself
once SSO is configured, but being explicit costs nothing.

**Configure Oracle.** The file store has no locking and, on most hosts,
`data/content.json` does not survive a restart or a redeploy.

**Configure OCI Object Storage.** `public/uploads/` has the same problem.

**Watch the client secret expiry date.** An expired Entra secret breaks
sign-in for everyone, with no warning and a misleading error.

Still genuinely missing, if you want them: an approval step before publish,
scheduled publishing, and per-brand scoping so a marketer only sees their own
site's pages. The data model has `tenant_id` throughout, so the multi-tenant
version is a routing and filtering job rather than a rewrite.

---

## Arabic / RTL

Built RTL-ready even though it ships English-only:

- Logical CSS properties throughout (`padding-inline`, `inset-inline-start`)
- Horizontal animations mirror under `[dir='rtl']`
- The 3D image tilt mirrors
- Arabic faces (Amiri, IBM Plex Sans Arabic) already loaded and selectable per
  section in the Design tab

To add Arabic properly you still need a locale segment in the route, a
translated copy of each page's content, and `dir` driven by locale. The
component library will not need rewriting — that was the point.

---

## Known limitations

- Revision history is stored and restorable via `POST /api/content`
  (Admin only), but has no UI yet — there is SQL at the bottom of
  `db/schema.sql` for doing it by hand
- On the file driver only, the last save still wins (no locking without a DB)
- Role changes in Entra need a sign-out/sign-in to take effect
- The `/api/forms` rate limit is per-instance and in memory; behind more than
  one instance, move it to the database or a WAF rule. Set
  `TRUSTED_PROXY_HOPS` to match your deployment
- Repeatable list items (projects, cards, FAQ rows) are not translatable —
  see docs/ARABIC.md for why and the workarounds
- The intro splash uses `sessionStorage`, so it shows once per browser session
- Preview shows saved state — use **Save & refresh** in the editor

---

## Resetting the database

`db/reset.sql` drops the CMS tables (new schema plus the four from the earlier
Hadya project) and purges the recycle bin. Export first — `npm run db:export` —
because there is no undo. Then run `db/schema.sql` and `npm run db:seed`.

A less destructive option: create a separate database user for the CMS and
point `DB_USER` at it. The old objects then sit outside its scope entirely and
no DROP is needed.
