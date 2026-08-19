import 'server-only';
import { mailState } from './env';

/* ------------------------------------------------------------------
   Outbound email through Microsoft Graph.

   WHY GRAPH AND NOT SMTP. You are on Microsoft 365, and this app already
   holds an Entra app registration with a client secret. Graph reuses that
   credential, needs no mailbox password, no port 587 egress, and does not
   break when someone enables MFA on the sending account. It is the same
   client-credentials shape as lib/dynamics.ts — deliberately, so there is
   one pattern to understand rather than two.

   THE PERMISSION IS THE WHOLE SETUP. Graph needs the APPLICATION
   permission `Mail.Send` with admin consent granted, and then it can send
   as ANY mailbox in the tenant. That is broader than most people expect,
   so the recommended configuration is an Application Access Policy in
   Exchange Online scoping the app to the single shared mailbox in
   MAIL_FROM. docs/EMAIL.md has the two PowerShell commands.

   FAILURE IS NEVER FATAL. A notification is a side effect of capturing a
   lead, not part of it. Every function here returns a result object and
   never throws into the caller — losing an email is bad, losing the lead
   because the email failed is worse.
-------------------------------------------------------------------*/

const GRAPH = 'https://graph.microsoft.com/v1.0';

type TokenCache = { token: string; expiresAt: number };
let cache: TokenCache | null = null;

function creds() {
  return {
    from: (process.env.MAIL_FROM || '').trim(),
    clientId: (process.env.MAIL_CLIENT_ID || process.env.AZURE_AD_CLIENT_ID || '').trim(),
    clientSecret: (
      process.env.MAIL_CLIENT_SECRET ||
      process.env.AZURE_AD_CLIENT_SECRET ||
      ''
    ).trim(),
    tenantId: (process.env.MAIL_TENANT_ID || process.env.AZURE_AD_TENANT_ID || '').trim(),
  };
}

export function mailEnabled(): boolean {
  return mailState().configured;
}

async function getToken(): Promise<string> {
  if (cache && cache.expiresAt > Date.now() + 60_000) return cache.token;

  const { clientId, clientSecret, tenantId } = creds();
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope: 'https://graph.microsoft.com/.default',
    }),
    cache: 'no-store',
  });

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !json.access_token) {
    throw new Error(
      `Graph token request failed (${res.status}): ${
        json.error_description?.split('\n')[0] || json.error || 'no access_token returned'
      }`,
    );
  }

  cache = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cache.token;
}

export interface SendResult {
  ok: boolean;
  detail: string;
}

export interface MailMessage {
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
  cc?: string[];
}

const recipients = (list: string[]) =>
  list.filter(Boolean).map((address) => ({ emailAddress: { address } }));

/** Sends one message. Returns a result rather than throwing. */
export async function sendMail(msg: MailMessage): Promise<SendResult> {
  const state = mailState();
  if (!state.configured) return { ok: false, detail: state.detail };

  const to = msg.to.filter(Boolean);
  if (!to.length) return { ok: false, detail: 'No recipients configured.' };

  const { from } = creds();

  try {
    const token = await getToken();
    const res = await fetch(`${GRAPH}/users/${encodeURIComponent(from)}/sendMail`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        message: {
          subject: msg.subject.slice(0, 250),
          body: { contentType: 'HTML', content: msg.html },
          toRecipients: recipients(to),
          ccRecipients: msg.cc?.length ? recipients(msg.cc) : undefined,
          // Replying to the notification should reach the enquirer, not the
          // shared mailbox that sent it.
          replyTo: msg.replyTo ? recipients([msg.replyTo]) : undefined,
        },
        saveToSentItems: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      let detail = text.slice(0, 300);
      try {
        detail = (JSON.parse(text) as { error?: { message?: string } })?.error?.message || detail;
      } catch {
        /* keep the raw text */
      }
      // 403 here is almost always the Application Access Policy, not the
      // permission grant — say so, because the Graph message does not.
      if (res.status === 403) {
        detail +=
          ' (a 403 on sendMail usually means Mail.Send admin consent is missing, or an ' +
          'Application Access Policy excludes ' + from + ')';
      }
      return { ok: false, detail: `Graph ${res.status}: ${detail}` };
    }

    return { ok: true, detail: `Sent to ${to.join(', ')}` };
  } catch (e) {
    return { ok: false, detail: (e as Error).message.split('\n')[0] };
  }
}

/** Connectivity check for /admin/status — resolves the sending mailbox. */
export async function mailWhoAmI(): Promise<SendResult> {
  const state = mailState();
  if (!state.configured) return { ok: false, detail: state.detail };
  const { from } = creds();
  try {
    const token = await getToken();
    const res = await fetch(
      `${GRAPH}/users/${encodeURIComponent(from)}?$select=displayName,mail,userPrincipalName`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    );
    if (!res.ok) {
      const body = await res.text();
      return {
        ok: false,
        detail:
          res.status === 404
            ? `MAIL_FROM mailbox ${from} was not found in this tenant.`
            : `Graph ${res.status}: ${body.slice(0, 200)}`,
      };
    }
    const u = (await res.json()) as { displayName?: string; mail?: string };
    return { ok: true, detail: `Sending as ${u.displayName || from} <${u.mail || from}>` };
  } catch (e) {
    return { ok: false, detail: (e as Error).message.split('\n')[0] };
  }
}

/* --------------------------- templates --------------------------- */

const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const SHELL = (title: string, rows: string, footer: string) => `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
  background:#f6f5f1;padding:24px">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
    style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e3d9">
    <tr><td style="padding:20px 24px;background:#101a2c;color:#ffffff">
      <div style="font-size:15px;letter-spacing:.08em;text-transform:uppercase">${esc(title)}</div>
    </td></tr>
    <tr><td style="padding:8px 24px 20px">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
        style="font-size:14px;color:#2b2b2b">${rows}</table>
    </td></tr>
    <tr><td style="padding:14px 24px;border-top:1px solid #e7e3d9;font-size:12px;color:#7a7a7a">
      ${footer}
    </td></tr>
  </table>
</div>`;

const row = (label: string, value: unknown) =>
  value === undefined || value === null || value === ''
    ? ''
    : `<tr>
        <td style="padding:10px 0 2px;font-size:11px;text-transform:uppercase;
          letter-spacing:.08em;color:#8a8a8a">${esc(label)}</td>
      </tr>
      <tr>
        <td style="padding:0 0 8px;border-bottom:1px solid #f0ede5;
          white-space:pre-wrap">${esc(value)}</td>
      </tr>`;

export interface LeadNotification {
  formName: string;
  submissionId: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  subject?: string;
  message?: string;
  pageUrl?: string;
  /** Extra answers from a builder-defined form. */
  answers?: Record<string, unknown>;
  brandName: string;
  adminUrl?: string;
}

/** The internal "you have a new enquiry" email. */
export function leadNotificationEmail(n: LeadNotification): MailMessage {
  const extra = Object.entries(n.answers || {})
    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => row(k.replace(/[_-]+/g, ' '), Array.isArray(v) ? v.join(', ') : v))
    .join('');

  const rows =
    row('Name', n.name) +
    row('Email', n.email) +
    row('Phone', n.phone) +
    row('Company', n.company) +
    row('Subject', n.subject) +
    row('Message', n.message) +
    extra +
    row('Submitted from', n.pageUrl) +
    row('Reference', n.submissionId);

  const footer = n.adminUrl
    ? `Manage submissions in the <a href="${esc(n.adminUrl)}"
        style="color:#a8862f">${esc(n.brandName)} portal</a>.`
    : `Sent by the ${esc(n.brandName)} website.`;

  return {
    to: [],
    replyTo: n.email,
    subject: `${n.formName}: ${n.name || n.email || 'new submission'}`,
    html: SHELL(`New ${n.formName.toLowerCase()}`, rows, footer),
  };
}

/** The optional confirmation to the person who filled the form in. */
export function submitterConfirmationEmail(
  n: LeadNotification,
  locale: 'en' | 'ar' = 'en',
): MailMessage {
  const ar = locale === 'ar';
  const body = ar
    ? `<p style="margin:14px 0">شكرًا لتواصلك مع ${esc(n.brandName)}. لقد استلمنا رسالتك وسيتواصل معك فريقنا قريبًا.</p>`
    : `<p style="margin:14px 0">Thank you for contacting ${esc(
        n.brandName,
      )}. We have received your message and our team will be in touch shortly.</p>`;

  const quoted = n.message
    ? `<div style="margin:14px 0;padding:12px 14px;background:#f6f5f1;
        border-left:3px solid #a8862f;white-space:pre-wrap;font-size:13px;
        color:#555">${esc(n.message)}</div>`
    : '';

  return {
    to: n.email ? [n.email] : [],
    subject: ar
      ? `تأكيد استلام رسالتك — ${n.brandName}`
      : `We received your message — ${n.brandName}`,
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
      background:#f6f5f1;padding:24px" ${ar ? 'dir="rtl"' : ''}>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
        style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e7e3d9">
        <tr><td style="padding:20px 24px;background:#101a2c;color:#fff;
          font-size:15px;letter-spacing:.08em;text-transform:uppercase">
          ${esc(n.brandName)}</td></tr>
        <tr><td style="padding:6px 24px 22px;font-size:14px;color:#2b2b2b">
          ${body}${quoted}
          <p style="margin:14px 0 0;font-size:12px;color:#8a8a8a">
            ${ar ? 'رقم المرجع' : 'Reference'}: ${esc(n.submissionId)}
          </p>
        </td></tr>
      </table>
    </div>`,
  };
}
