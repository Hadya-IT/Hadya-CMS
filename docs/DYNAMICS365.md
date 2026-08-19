# Dynamics 365 — website leads into Dataverse

When a visitor submits a contact form, the submission is stored in your own
database and then created as a **lead** in Dynamics 365.

## First, the distinction that matters

Both of these involve Entra, and conflating them is the single most common way
to lose an afternoon on this integration.

| | SSO (`lib/auth.ts`) | Dynamics (`lib/dynamics.ts`) |
|---|---|---|
| Who is acting | a person, in a browser | this server, with no human present |
| OAuth flow | authorization code | **client credentials** |
| Credential | client secret + redirect URI | client secret only |
| Permissions live in | app roles you defined | a **security role** inside Dynamics |
| Extra portal step | register the redirect URI | create an **application user** |

A client-credentials token is perfectly valid the moment your app registration
exists — and Dataverse will still return **401** for every call until step 3
below is done. If you are seeing 401 with a token you know is good, it is
almost always step 3.

---

## 1. Find your environment URL

Power Platform admin center (admin.powerplatform.microsoft.com) →
**Environments** → your environment → **Environment URL**.

```
DYNAMICS_URL=https://yourorg.crm4.dynamics.com
```

No trailing slash. The region number varies (`crm4` is EMEA, `crm` is North
America, and so on) — copy what the portal shows rather than guessing.

---

## 2. Decide which app registration to use

**Reuse the SSO app** (simplest): leave `DYNAMICS_CLIENT_ID`,
`DYNAMICS_CLIENT_SECRET` and `DYNAMICS_TENANT_ID` blank and the client falls
back to the `AZURE_AD_*` values.

**Dedicated app** (recommended for production): register a second app, e.g.
`Hadya CMS — Dynamics`. No redirect URI needed — it never signs a human in.
Create a secret and set the three `DYNAMICS_*` variables. The benefit is
independent secrets and rotation schedules; rotating your SSO secret then
cannot silently break lead capture.

Either way, note the **client ID** — step 3 needs it.

---

## 3. Create the application user in Dynamics

This is the step that is easy to miss.

1. Power Platform admin center → **Environments** → your environment →
   **Settings**.
2. **Users + permissions** → **Application users** → **+ New app user**.
3. **+ Add an app**, search for your app registration's **client ID**, select
   it.
4. Choose a **Business unit** (the root one is fine).
5. **Security roles** → add a role that can create leads. `Salesperson` works
   out of the box. If your security team prefers least privilege, a custom role
   with **Create** and **Read** on the **Lead** entity is enough.
6. **Create**.

Verify from inside the portal: **/admin/status → Test connections**. It calls
Dataverse `WhoAmI` and shows the application user and organisation id it is
acting as. That call succeeding is proof steps 1–3 are all correct.

---

## 4. Switch it on

```
DYNAMICS_ENABLED=true
```

Restart `npm run dev`. Submit a test enquiry through a Contact form block, then
open **/admin/leads** — the row should show **In Dynamics** with the lead GUID
in the expanded detail.

---

## Field mapping

`src/lib/dynamics.ts`, `createLead()`:

| Form field | Dataverse column | Notes |
|---|---|---|
| Name | `firstname` / `lastname` | Split on the first space; a single word goes in both |
| Email | `emailaddress1` | Required, validated server-side |
| Phone | `telephone1` | |
| Company | `companyname` | |
| Subject | `subject` | Defaults to "Website enquiry from {name}" |
| Message | `description` | With the source page URL appended |
| — | `leadsourcecode` | Hard-coded to `4` (*Web*) |

To send a field that doesn't exist above — a custom column, a campaign
reference, an owner assignment — add it to the `payload` object in
`createLead()`. Dataverse column names are all lowercase; the logical name is
in **Settings → Tables → Lead → Columns**.

Custom columns carry your publisher prefix, e.g. `hy_sourcecampaign`. Getting
that prefix wrong produces a very clear error, which is the one nice thing
about Dataverse validation.

---

## Reliability, and why the order is what it is

`src/lib/leads.ts` does this, deliberately in this sequence:

1. Store the submission (Oracle `cms_form_submission`, or `data/leads.json` if
   the database is not configured).
2. Attempt the Dynamics push.
3. Record the outcome on the stored row: `sent`, `failed` (with the error), or
   `off`.
4. Return success to the visitor **regardless of step 2**.

So a Dynamics outage, an expired secret, or a security-role change costs you
nothing but a retry. Failed rows appear on `/admin/leads` with a **Retry**
button, and in SQL:

```sql
SELECT submission_id, email, crm_error, created_at
  FROM cms_form_submission
 WHERE crm_status = 'failed'
 ORDER BY created_at DESC;
```

The alternative — push first, store only on success — loses leads whenever the
CRM is unavailable, which is exactly when you can least afford it.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| `401 Unauthorized` on every call | No application user in Dynamics (step 3), or it has no security role |
| `403 Forbidden` | Application user exists but its security role cannot create leads |
| Token request fails, `AADSTS7000215` | Wrong client secret — copied the Secret ID instead of the Value |
| Token request fails, `AADSTS500011` | The resource in the scope doesn't match `DYNAMICS_URL`; check for a trailing slash or the wrong region |
| `404` on `/api/data/v9.2/leads` | `DYNAMICS_URL` is wrong, or points at a Power Apps maker URL rather than the environment URL |
| Leads arrive with a blank last name | Someone submitted a single-word name; expected — it is copied into both name fields |
| Status page says "Dynamics push is off" | `DYNAMICS_ENABLED` is not exactly `true` |

The access token is cached in memory until a minute before it expires, so a
burst of submissions makes one token request, not one per lead.
