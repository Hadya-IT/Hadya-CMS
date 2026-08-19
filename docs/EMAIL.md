# Form notification email

Sends an email when somebody submits a website form, through **Microsoft
Graph** using the Entra app registration this app already has.

Submissions are stored whether or not email works. Nothing here can lose a
lead — if Graph is down or misconfigured, the submission is still in the
database and visible under **Submissions**, and you can re-send the
notification from there.

---

## Why Graph rather than SMTP

You are on Microsoft 365, and this app already holds a client secret for
sign-in. Graph reuses that credential, so there is no mailbox password to
store, no port 587 to open, and nothing breaks when somebody enables MFA on
the sending account. It is also the same client-credentials pattern as
`lib/dynamics.ts` — deliberately, so there is one shape to understand rather
than two.

---

## 1. Grant the permission

In **Entra admin center → App registrations →** your app **→ API
permissions**:

1. **Add a permission → Microsoft Graph → Application permissions**
2. Search `Mail.Send`, tick it, **Add permissions**
3. Click **Grant admin consent for \<tenant\>**

Confirm the row reads **Application** (not Delegated) and shows a green
tick. Without the consent step every call returns 403 with a message that
does not mention consent.

> **Read this before you move on.** `Mail.Send` as an *application*
> permission lets the app send as **any mailbox in the tenant** — including
> the CEO's. That is how Graph works, and it is why step 2 is not optional.

---

## 2. Scope it to one mailbox

An **Application Access Policy** restricts the app to a single mailbox.
Create a shared mailbox (e.g. `website@hadya.com.sa`), then in **Exchange
Online PowerShell**:

```powershell
Connect-ExchangeOnline

# Group holding the mailboxes the app may send as
New-DistributionGroup -Name "WebsiteMailSenders" -Type Security `
  -Members website@hadya.com.sa

New-ApplicationAccessPolicy `
  -AppId "<your AZURE_AD_CLIENT_ID>" `
  -PolicyScopeGroupId "WebsiteMailSenders@hadya.com.sa" `
  -AccessRight RestrictAccess `
  -Description "Website CMS may only send as the website mailbox"
```

Verify:

```powershell
Test-ApplicationAccessPolicy -Identity website@hadya.com.sa -AppId "<client-id>"
# AccessCheckResult : Granted

Test-ApplicationAccessPolicy -Identity ceo@hadya.com.sa -AppId "<client-id>"
# AccessCheckResult : Denied      <- this is the result you want
```

Policy changes take up to 30 minutes to propagate. A 403 immediately after
creating one usually means it has not applied yet, not that it is wrong.

---

## 3. Configure the app

In `.env.local`:

```bash
MAIL_FROM=website@hadya.com.sa

# Optional. Blank = reuse the AZURE_AD_* credentials, which is the normal case.
MAIL_TENANT_ID=
MAIL_CLIENT_ID=
MAIL_CLIENT_SECRET=
```

Then `npm run doctor` (offline check) and restart. **Admin → System status**
runs a live check and reports the mailbox it resolves.

---

## 4. Choose the recipients

Two levels, and they add together:

| Where | Applies to |
|---|---|
| **Settings → Form notifications** | Every form |
| **Forms →** a form **→ Where submissions go** | That form only |

So `info@` site-wide plus `careers@` on the careers form means a careers
submission reaches both.

**Also confirm to the person who submitted** sends the enquirer a copy of
their own message, in the language they were browsing in. Off by default —
turn it on only once the sending mailbox is a real monitored address, because
replies will go there.

---

## What the emails look like

**Internal notification** — every field they filled, the page they submitted
from, the reference ID, and a link to the submission in the portal. The
`Reply-To` is set to the enquirer, so replying reaches them rather than the
shared mailbox.

**Submitter confirmation** — a short acknowledgement quoting their message,
with the reference ID. Arabic version is right-to-left.

Both are plain table-based HTML with inline styles, because that is what
survives Outlook.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| `Graph 403` on send | `Mail.Send` consent missing, or an Application Access Policy excludes `MAIL_FROM`. The app appends this hint to the error. |
| `Graph 404` on the status check | The `MAIL_FROM` mailbox does not exist in the tenant. Shared mailboxes work; distribution lists do not. |
| `invalid_client` | The client secret expired. They expire silently and break sign-in too. |
| Status says configured, no email arrives | Check **Settings → Form notifications** is switched on and has recipients. Configured means "could send", not "will send". |
| Emails land in Junk | Add the sending host to SPF, or send from a mailbox on an already-authenticated domain. Graph does not bypass your own SPF/DKIM. |

Every failure is logged to the server console with the Graph message
attached, and recorded against the submission so you can retry it from
**Submissions** without the visitor resubmitting.
