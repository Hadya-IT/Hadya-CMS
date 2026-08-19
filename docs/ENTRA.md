# Microsoft Entra ID — SSO and roles

Everything here is done in the Azure / Entra portal. No code changes are
needed; the app reads it all from `.env.local`.

Two portal areas are involved and they are easy to confuse:

- **App registration** — the app's *identity*. Client ID, secrets, redirect
  URIs, and where app roles are **defined**.
- **Enterprise application** — the same app as it exists *in your tenant*.
  Where users are **assigned** to those roles.

A third area, *Roles and administrators*, is a trap. It manages who can
administer the Azure resource (built-in directory roles like "Cloud
Application Administrator"). It has nothing to do with your app's roles.

---

## 1. Register the application

entra.microsoft.com → **Microsoft Entra ID** → **App registrations** →
**+ New registration**.

| Field | Value |
|---|---|
| Name | `Hadya CMS` |
| Supported account types | *Accounts in this organizational directory only* |
| Redirect URI | Platform **Web**, `http://localhost:3000/api/auth/callback/azure-ad` |

From **Overview**, copy:

- **Application (client) ID** → `AZURE_AD_CLIENT_ID`
- **Directory (tenant) ID** → `AZURE_AD_TENANT_ID`

---

## 2. Redirect URIs

**Authentication** → *Web* → **Add URI**. Add one per environment:

```
http://localhost:3000/api/auth/callback/azure-ad
https://cms.hadya.com/api/auth/callback/azure-ad
```

The path is fixed by Auth.js: `/api/auth/callback/` + the provider id, and the
provider id for Entra in next-auth v4 is `azure-ad`. Scheme, host, port and
path must match character for character — `https` vs `http` and a trailing
slash are both mismatches.

`npm run doctor` prints the URI it expects based on your `NEXTAUTH_URL`. Paste
that rather than typing it.

Leave *Implicit grant* checkboxes unticked. This is a server-side
authorization-code flow; it does not need them.

---

## 3. Client secret

**Certificates & secrets** → **+ New client secret** → 12 or 24 months.

Copy the **Value** column immediately — it is shown once and never again. The
**Secret ID** next to it is *not* the secret; pasting it produces
`AADSTS7000215: Invalid client secret provided`. `npm run doctor` checks the
shape and warns you if you grabbed the wrong column.

→ `AZURE_AD_CLIENT_SECRET`

Note the expiry date somewhere you will actually see it. An expired secret
breaks sign-in for everyone with no warning.

---

## 4. Define the app roles

**App registrations → your app → App roles → + Create app role.**

Create two:

| Display name | Value | Allowed member types | Description |
|---|---|---|---|
| Admin | `Admin` | Users/Groups | Full access, including site settings |
| Editor | `Editor` | Users/Groups | Pages, sections, media and submissions |

The **Value** is what appears in the token, so keep it exact — no spaces. The
app matches it case-insensitively against `ENTRA_ADMIN_ROLES` and
`ENTRA_EDITOR_ROLES` in `.env.local`, so if your organisation already uses
different names (`CMS.Admin`, `WebEditor`) you can point at those instead of
renaming anything:

```
ENTRA_ADMIN_ROLES=CMS.Admin,Admin
ENTRA_EDITOR_ROLES=WebEditor,Editor
```

---

## 5. Assign people to the roles

Assignment happens on the **Enterprise application**, not the registration.

**Microsoft Entra ID → Enterprise applications → Hadya CMS → Users and groups
→ + Add user/group.** Pick the person (or a group), pick the role, **Assign**.

Then, so that unassigned staff cannot even authenticate:

**Properties → Assignment required? → Yes → Save.**

Finally, in `.env.local`:

```
REQUIRE_ENTRA_ROLE=true
```

Now the app refuses anyone without a recognised role, and Microsoft refuses
them one step earlier. Belt and braces, on purpose — the two checks fail in
different ways and you want both.

---

## 6. Restrict by email domain

```
ADMIN_ALLOWED_DOMAINS=hadya.com,hadyagroup.com
```

Checked in the `signIn` callback, after Microsoft has authenticated the person
but before a session is created. Leaving it empty allows any account in the
tenant, which includes guests.

---

## How the role actually reaches the app

Worth understanding, because it explains the one surprising behaviour:

1. The person signs in. Microsoft returns an **id_token** containing a `roles`
   claim — an array of the app-role values assigned to them. Roles are not a
   scope you request; they ride along automatically once assigned.
2. `src/lib/auth.ts` decodes the id_token, reads `roles`, and maps it onto
   `ADMIN` or `EDITOR`.
3. That role is written into **our own** session cookie (signed with
   `NEXTAUTH_SECRET`).
4. Every API route calls `requireEditor()` or `requireAdmin()` from
   `src/lib/rbac.ts`, which reads the role from the session server-side.

**The surprising behaviour:** because the role is baked in at step 3, changing
someone's role in Entra does not affect their current session. They must sign
out and back in. Sessions last 12 hours (`maxAge` in `lib/auth.ts`), so a role
change reaches everyone within half a day at worst.

If you would rather roles be looked up on every request — for example because
non-technical staff manage them in your own admin screen instead of the Azure
portal — the hook is `currentAdmin()` in `lib/auth.ts`: replace the token read
with a query against a `cms_admin_user` table keyed on the Entra object id
(`oid`, which is already carried on the session).

---

## Error codes you will meet

| Code / symptom | Meaning | Fix |
|---|---|---|
| `AADSTS50011` | Redirect URI in the request is not registered | Add the exact URI from `npm run doctor` |
| `AADSTS7000215` | Invalid client secret | You copied the Secret ID. Create a new secret, copy **Value** |
| `AADSTS700016` | Application not found in the directory | Wrong `AZURE_AD_CLIENT_ID`, or wrong tenant |
| `AADSTS50105` | User is not assigned to the app | Assign them in Enterprise applications → Users and groups |
| `AADSTS900023` | Tenant not found | Wrong `AZURE_AD_TENANT_ID` |
| next-auth `Configuration` error | Missing `NEXTAUTH_SECRET`, or a half-filled `AZURE_AD_*` set | `npm run doctor` |
| next-auth `AccessDenied` | Our own `signIn` callback refused: wrong email domain, or `REQUIRE_ENTRA_ROLE=true` with no role assigned | Check the allowlist and the role assignment |
| Signs in, then "This needs the Admin role" | Authenticated but only `EDITOR` | Assign `Admin`, then sign out and back in |

To see what Microsoft is actually sending, sign in and read the server console
— the `roles` array is what the mapping in `lib/auth.ts` receives. If it is
empty, the problem is on the Entra side (role not defined, or not assigned),
not in the code.
