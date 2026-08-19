import { NextResponse } from 'next/server';
import { captureLead, listLeads, retryLead, notifyLead } from '@/lib/leads';
import { requireEditor } from '@/lib/rbac';
import { audit } from '@/lib/db';
import { readContent } from '@/lib/store';
import { findForm, mapToLead, validateSubmission } from '@/lib/formdefs';
import { isLocale } from '@/lib/i18n';
import type { Locale } from '@/lib/types';

export const dynamic = 'force-dynamic';

/* POST is the only public endpoint in the app, so it carries its own
   defences: a honeypot field, per-field length caps, and a per-IP rate
   limit.

   VALIDATION IS AGAINST THE STORED FORM DEFINITION, never against the keys
   the client posted. That is the whole security model of the form builder —
   otherwise any key could be submitted, stored and emailed, which is a spam
   relay. Unknown keys are dropped silently by validateSubmission().

   RATE LIMITING. Still in-memory, so still per-instance — but the key is no
   longer taken from X-Forwarded-For blindly. See clientIp() below. */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

/* Number of proxies in front of the app. X-Forwarded-For is appended to by
   each hop, so the LAST entries are the ones added by infrastructure you
   control and the earlier ones are attacker-supplied. Taking [0] — the old
   behaviour — lets anyone rotate the header and bypass the limit entirely.
   Set TRUSTED_PROXY_HOPS to match your deployment: 1 behind a single load
   balancer or CDN, 0 when the app is directly exposed. */
const HOPS = Math.max(0, Number(process.env.TRUSTED_PROXY_HOPS ?? '1') || 0);

function clientIp(req: Request): string {
  const xff = (req.headers.get('x-forwarded-for') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (HOPS > 0 && xff.length) {
    // Count back from the right by the number of hops we trust.
    const idx = Math.max(0, xff.length - HOPS);
    return xff[idx] || xff[xff.length - 1];
  }
  return req.headers.get('x-real-ip') || xff[xff.length - 1] || 'unknown';
}

function rateLimited(ip: string): boolean {
  const now = Date.now();

  /* Evict expired entries instead of clearing the whole map. The old
     `hits.clear()` at 5000 keys let an attacker spray fake IPs to reset
     everybody's counter, including their own. */
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      const live = times.filter((t) => now - t < WINDOW_MS);
      if (live.length) hits.set(key, live);
      else hits.delete(key);
    }
  }

  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

function originOf(req: Request): string | undefined {
  try {
    const url = new URL(req.url);
    return process.env.NEXTAUTH_URL?.trim() || `${url.protocol}//${url.host}`;
  } catch {
    return undefined;
  }
}

export async function POST(req: Request) {
  const ip = clientIp(req);

  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many submissions. Wait a minute and try again.' },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Could not read the form data.' }, { status: 400 });
  }

  // Honeypot: real people never fill a hidden field. Answer 200 so bots
  // cannot tell they were caught.
  if (typeof body.website === 'string' && body.website.trim()) {
    return NextResponse.json({ ok: true });
  }

  const doc = await readContent();
  const locale: Locale = isLocale(body.locale as string) ? (body.locale as Locale) : 'en';

  const form = findForm(doc.forms, typeof body.formId === 'string' ? body.formId : undefined);
  if (!form) {
    return NextResponse.json({ error: 'That form no longer exists.' }, { status: 404 });
  }

  const { ok, values, errors } = validateSubmission(form, body, locale);
  if (!ok) {
    // Field-level errors so the form can mark the specific inputs.
    return NextResponse.json(
      { error: 'Please check the highlighted fields.', fields: errors },
      { status: 400 },
    );
  }

  if (form.consentText && body.consent !== true) {
    return NextResponse.json(
      { error: 'Consent is required.', fields: { consent: 'Please agree in order to continue.' } },
      { status: 400 },
    );
  }

  const mapped = mapToLead(form, values);
  const pageUrl =
    (typeof body.pageUrl === 'string' && body.pageUrl.trim().slice(0, 400)) ||
    req.headers.get('referer') ||
    undefined;

  try {
    const lead = await captureLead({
      ...mapped,
      pageUrl,
      formId: form.id,
      formName: form.name,
      locale,
      crmPush: form.crmPush !== false,
    });

    /* Notification is deliberately awaited but its failure is swallowed
       inside notifyLead. Awaiting matters on serverless: a floating promise
       is killed when the response is returned, so a fire-and-forget send
       would simply never happen. */
    const mail = await notifyLead(lead, {
      settings: doc.settings,
      extraRecipients: form.notifyEmails,
      origin: originOf(req),
    });

    // The visitor's outcome does not depend on the CRM or on email.
    return NextResponse.json({
      ok: true,
      id: lead.id,
      crm: lead.crmStatus,
      mail: mail.status,
    });
  } catch (e) {
    console.error('lead capture failed:', e);
    return NextResponse.json(
      { error: 'We could not record your message. Please email us instead.' },
      { status: 500 },
    );
  }
}

export async function GET() {
  const guard = await requireEditor();
  if (!guard.ok) return guard.response;
  try {
    return NextResponse.json({ leads: await listLeads() });
  } catch (e) {
    console.error('lead list failed:', e);
    return NextResponse.json(
      { error: 'Could not read submissions. Run npm run db:test to check the database.' },
      { status: 500 },
    );
  }
}

/** Retry a failed Dynamics push, or re-send the notification email. */
export async function PATCH(req: Request) {
  const guard = await requireEditor();
  if (!guard.ok) return guard.response;

  const { id, action } = (await req.json().catch(() => ({}))) as {
    id?: string;
    action?: 'crm' | 'email';
  };
  if (!id) return NextResponse.json({ error: 'Missing submission id.' }, { status: 400 });

  if (action === 'email') {
    const leads = await listLeads(1000);
    const lead = leads.find((l) => l.id === id);
    if (!lead) return NextResponse.json({ error: 'Submission not found.' }, { status: 404 });
    const doc = await readContent();
    const form = findForm(doc.forms, lead.formId);
    const mail = await notifyLead(lead, {
      settings: doc.settings,
      extraRecipients: form?.notifyEmails,
      origin: originOf(req),
    });
    audit('LEAD_NOTIFY_RETRY', guard.admin.actor, `${id} -> ${mail.status}`);
    return NextResponse.json({ ok: mail.status === 'sent', mail });
  }

  const lead = await retryLead(id);
  if (!lead) return NextResponse.json({ error: 'Submission not found.' }, { status: 404 });

  audit('LEAD_RETRY', guard.admin.actor, `${id} -> ${lead.crmStatus}`);
  return NextResponse.json({ ok: lead.crmStatus === 'sent', lead });
}
