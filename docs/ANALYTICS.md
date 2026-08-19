# Analytics

## The current state, stated plainly

The Analytics screen shows **fabricated numbers**. Nothing on it is a measurement
of your website. It exists so the screen can be designed and agreed before the
real connection is built.

Three safeguards keep that from being forgotten:

- a red banner at the top of the page
- a diagonal `SAMPLE DATA` watermark behind the content, so a screenshot cannot
  lose the warning
- `isSample: true` on every API payload, which the UI is required to honour

Do not use these figures for reporting, budget decisions, or anything a client
or the board will see.

## What is actually real

The **collection** side is real and works today:

| Piece | Status |
| --- | --- |
| GTM container loads on the public site | ✅ once an ID is set |
| `dataLayer` initialised before the container | ✅ |
| Events pushed for real visitor actions | ✅ |
| Analytics screen reads those events | ❌ needs a GA4 reader |

So installing GTM starts gathering data immediately. The dashboard keeps showing
sample figures until step 3 below is done. Collection and reporting are separate
jobs and it is worth being clear which one is finished.

## Step 1 — install GTM

1. Create a container at tagmanager.google.com for your domain
2. Copy the ID (`GTM-XXXXXXX`)
3. Paste it into **Settings → Analytics → GTM container ID**, save
4. Load the public site and confirm the container fires in GTM Preview

With no ID set, no third-party script loads at all.

## Step 2 — build triggers on the events the site already pushes

| Event | Fires when |
| --- | --- |
| `form_start` | First keystroke in the contact form |
| `form_submit` | Submission succeeds — carries `crm` status |
| `cta_click` | Any element tagged `data-track="cta_click"` |
| `tel_click` | A `tel:` link is clicked |
| `email_click` | A `mailto:` link is clicked |
| `file_download` | A link to pdf/doc/xls/ppt/zip is clicked |
| `scroll_90` | Visitor reaches 90% of the page, once per page |

`form_start` against `form_submit` is the most useful pair you get for free: a
wide gap means people are trying to contact you and the form itself is stopping
them.

To tag a new element, add `data-track="cta_click"` in the block component. One
delegated listener handles the whole page — no per-link wiring.

## Step 3 — connect GA4 for real reporting

Not implemented. `src/lib/analytics.ts` has the seam:

```ts
async function getGa4Analytics(): Promise<AnalyticsPayload> { ... }
```

1. `npm i @google-analytics/data`
2. Service account in GCP, granted Viewer on the GA4 property
3. `GA4_PROPERTY_ID` and `GOOGLE_APPLICATION_CREDENTIALS` in `.env.local`
4. Implement `runReport()` calls returning the existing `AnalyticsPayload` shape
5. Set `ANALYTICS_MODE=ga4`

Ad figures — impressions, CPC, spend, campaign names — do **not** come from GA4.
They need the Google Ads API, which is a separate credential and a separate
approval process. Until that exists, the campaign table stays sample-only even
after GA4 is connected. Plan for it as its own piece of work.

Setting `ANALYTICS_MODE=ga4` before the reader exists throws an error rather than
falling back to sample data. That is deliberate: a dashboard that quietly serves
invented numbers when the real source is down is worse than one that breaks.

## Do not

Do not edit `src/lib/analytics-sample.ts` to make the numbers look more
plausible. Sample data that is convincing is sample data that ends up in a
board deck.
