# Updating without losing your content

Your site content lives in **two** places, and neither is source code:

    data/content.json      every page, section and setting you have edited
    data/leads.json        website enquiries (only when the DB is not configured)
    public/uploads/        every image you have uploaded

Everything else is code and is safe to overwrite.

## To apply a new version

1. Rename your current folder to `hadya-cms-old`
2. Unzip the new one as `hadya-cms`
3. Copy your content across:

```bash
cp hadya-cms-old/.env.local          hadya-cms/.env.local
cp -r hadya-cms-old/wallet/.         hadya-cms/wallet/
cp hadya-cms-old/data/content.json   hadya-cms/data/content.json
cp -r hadya-cms-old/public/uploads/. hadya-cms/public/uploads/
```

Once Oracle is configured, `content.json` and `leads.json` are only a fallback —
your real content lives in `cms_document` and your enquiries in
`cms_form_submission`, and a new version cannot touch either. That is the main
reason to finish the database setup.

4. `cd hadya-cms && npm install && npm run dev`

Skipping step 3 resets the site to the shipped demo content and loses any
pages you have made.

## If you skipped step 3 by accident

`data/backups/` in the old folder holds the last 20 saves. Copy the newest
one over `data/content.json` and restart.

---

## Version 2 adds a third thing to preserve

    .env.local             your secrets — never in the zip, never in git
    wallet/                Oracle wallet files
    oci/                   OCI API signing key

The zip ships empty `wallet/` and `oci/` folders with README files. Put your
own credentials in and they stay out of source control via `.gitignore`.

**Never put real values in `.env.example`.** It is not git-ignored, and the app
does not read it — only `.env.local`. Run `npm run setup` on a new copy to
create `.env.local`, then paste your values in.

## Version 3 adds

    cms_form_submission    new table - run db/002-form-submissions.sql on an
                           existing database (schema.sql already has it)

New environment variables, all optional except the roles ones if you want them:
`ENTRA_ADMIN_ROLES`, `ENTRA_EDITOR_ROLES`, `REQUIRE_ENTRA_ROLE`, `DEFAULT_ROLE`,
`DYNAMICS_URL`, `DYNAMICS_ENABLED`, `DYNAMICS_CLIENT_ID`,
`DYNAMICS_CLIENT_SECRET`, `DYNAMICS_TENANT_ID`. `npm run setup` on a fresh copy
prints the full template; copy the missing lines into your existing
`.env.local`.
