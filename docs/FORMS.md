# Forms

Marketing can build a form without a developer, place it on any page, and see
the submissions — with each one optionally emailed and pushed to Dynamics as a
lead.

---

## Building one

**Forms** in the sidebar → **+ New**. Every form has:

- **Fields** — add, reorder, delete; set type, required, half-width
- **Button label** and **thank-you message**, each with an Arabic variant
- **Consent line** — leave blank for no checkbox; when filled, ticking it is
  required to submit
- **Recipients** — extra addresses on top of the site-wide list
- **Create a lead in Dynamics** — turn off for forms that are not sales
  enquiries

### Field types

| Type | Notes |
|---|---|
| Single line | General text |
| Paragraph | Multi-line |
| Email | Validated on both sides |
| Phone | Free text — deliberately not format-validated, because international numbers defeat every regex |
| Number | Digits and decimal point |
| Date | Native date picker |
| Dropdown | One option per line. A submitted value not on the list is **rejected**, so a tampered `<select>` fails |
| Checkbox | Marking it required makes ticking it mandatory |

---

## One thing that is permanent

Each field has a **machine name** generated once from its label — shown in
grey next to it. The label stays freely editable. The machine name does not
change, because it is the key answers are stored under. Renaming it would
orphan every historical submission.

If you genuinely need a different machine name, delete the field and add a new
one, and accept that old submissions keep the old key.

These names are reserved and rejected: `formId`, `website`, `pageUrl`,
`locale`, `consent`.

---

## Putting it on a page

**Pages →** your page **→ add section → Form** (under Conversion), then paste
the form ID shown at the top of the Forms screen.

The existing **Contact** section still carries its own enquiry form. Use the
Form section when you want a form without the address panel — a careers
application, an RFP request, a newsletter sign-up.

---

## Where submissions go

Three places, independently:

1. **Always stored** — visible under **Submissions**, kept in the database
2. **Emailed** — if **Settings → Form notifications** is on and email is
   configured (see `docs/EMAIL.md`)
3. **Dynamics 365** — if the form has CRM push on and Dynamics is configured
   (see `docs/DYNAMICS365.md`)

The order matters and is deliberate: **stored first, then emailed, then
pushed**. A CRM outage or a mail failure can never lose a submission or show
the visitor an error, and both are retryable from **Submissions**.

### Mapping to Dynamics

Dynamics leads have fixed attributes, so each field can be mapped to one:
Name, Email, Phone, Company, Subject, or Message. Anything left **Not
mapped** still reaches the CRM — it is appended to the lead's notes rather
than dropped.

A form with no mappings at all still produces a usable lead: conventional
field names (`name`, `email`, `phone`, `company`, `message`) are recognised
automatically.

---

## Spam and abuse defences

| Defence | What it does |
|---|---|
| Honeypot | A hidden field. Anything that fills it gets a `200` and is silently discarded, so bots cannot tell they were caught |
| Rate limit | 5 submissions per minute per IP |
| Length caps | Per field, with a hard per-type ceiling regardless of what the definition says |
| Schema validation | Only fields in the **stored** definition are accepted. Unknown keys are dropped |

That last row is the important one. Validation runs against the form as saved
in the CMS, never against the keys the browser posted — otherwise anyone could
POST arbitrary data and have it stored and emailed, which is a spam relay with
extra steps.

**The rate limit is per-instance and in memory.** Behind more than one
instance, each has its own counter. Set `TRUSTED_PROXY_HOPS` to match your
deployment (1 behind a single load balancer or CDN, 0 if directly exposed) or
the limit reads the wrong IP from `X-Forwarded-For` and can be bypassed by
rotating the header. For anything serious, move the limit to a WAF rule.

---

## Consent, and the difference from cookies

The **consent line** on a form is not the cookie banner. They cover different
things:

- **Cookie banner** — permission to *track* the visitor
- **Form consent line** — permission to *contact* them, and to process what
  they submitted

Under PDPL you want the second one on any form whose submissions feed
marketing rather than answering a direct question. Wording is a question for
whoever owns your privacy notice, not for this document.

---

## Reading submissions

**Submissions** lists everything newest first, with the form it came from,
whether it reached Dynamics, and any error. Answers with no fixed column are
shown alongside the standard fields. Failed CRM pushes and failed
notifications can both be retried from there.
