import 'server-only';
import fs from 'fs';
import path from 'path';
import { isDbConfigured, withConnection } from './db';
import { createLead, dynamicsEnabled, type LeadInput } from './dynamics';
import { mailEnabled, sendMail, leadNotificationEmail, submitterConfirmationEmail } from './mail';
import type { Locale, SiteSettings } from './types';

/* ------------------------------------------------------------------
   Website form submissions.

   Order of operations matters here. The visitor's submission is stored
   FIRST and always — locally if the database is not configured. Only then
   do we try to push it to Dynamics. A CRM outage must never lose a lead or
   show the visitor an error, so the push failure is recorded on the row
   and can be retried, rather than bubbling up.
-------------------------------------------------------------------*/

const FILE = path.join(process.cwd(), 'data', 'leads.json');
const TENANT = () => process.env.CMS_TENANT_ID || 'hadya';

export type Lead = LeadInput & {
  id: string;
  createdAt: string;
  crmId?: string | null;
  crmStatus: 'pending' | 'sent' | 'failed' | 'off';
  crmError?: string | null;
  /** Which editor-defined form produced this, and its answers that had no
   *  fixed column. Absent on submissions predating the form builder. */
  formId?: string;
  formName?: string;
  answers?: Record<string, string | boolean>;
  locale?: Locale;
  /** Outcome of the notification email, for the admin list. */
  mailStatus?: 'sent' | 'failed' | 'off';
  mailError?: string | null;
};

function rid() {
  return `ld_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/* ------------------------------ file ------------------------------ */

function readFileLeads(): Lead[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8')) as Lead[];
  } catch {
    return [];
  }
}

function writeFileLeads(rows: Lead[]): void {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(rows.slice(0, 2000), null, 2), 'utf8');
}

/* ----------------------------- oracle ----------------------------- */

async function insertOracleLead(lead: Lead): Promise<void> {
  await withConnection(async (conn) => {
    await conn.execute(
      `INSERT INTO cms_form_submission
         (submission_id, tenant_id, full_name, email, phone, company,
          subject, message, page_url, crm_id, crm_status, crm_error,
          form_id, form_name, answers_json, locale)
       VALUES (:id, :t, :name, :email, :phone, :company,
               :subject, :message, :page, :crmId, :crmStatus, :crmError,
               :formId, :formName, :answers, :locale)`,
      {
        id: lead.id,
        t: TENANT(),
        name: lead.name,
        email: lead.email,
        phone: lead.phone || null,
        company: lead.company || null,
        subject: lead.subject || null,
        message: lead.message || null,
        page: lead.pageUrl || null,
        crmId: lead.crmId || null,
        crmStatus: lead.crmStatus,
        crmError: lead.crmError ? lead.crmError.slice(0, 500) : null,
        formId: lead.formId || null,
        formName: lead.formName || null,
        answers:
          lead.answers && Object.keys(lead.answers).length
            ? JSON.stringify(lead.answers)
            : null,
        locale: lead.locale || 'en',
      },
      { autoCommit: true },
    );
  });
}

async function updateOracleCrm(
  id: string,
  crmId: string | null,
  status: Lead['crmStatus'],
  error?: string | null,
): Promise<void> {
  await withConnection(async (conn) => {
    await conn.execute(
      `UPDATE cms_form_submission
          SET crm_id = :crmId, crm_status = :st, crm_error = :err
        WHERE submission_id = :id`,
      { crmId, st: status, err: error ? error.slice(0, 500) : null, id },
      { autoCommit: true },
    );
  });
}

/* ----------------------------- CRM shape --------------------------- */

/* Dynamics has fixed lead attributes, but a builder-defined form can ask
   anything. Unmapped answers are appended to the description rather than
   dropped — a lead that reaches the CRM missing half its content is worse
   than one with a slightly verbose note. */
function crmPayload(lead: Lead): LeadInput {
  const extras = Object.entries(lead.answers || {})
    .filter(([, v]) => v !== '' && v !== false && v !== null && v !== undefined)
    .map(([k, v]) => `${k.replace(/[_-]+/g, ' ')}: ${v === true ? 'Yes' : v}`);

  const message = [lead.message, extras.length ? extras.join('\n') : null]
    .filter(Boolean)
    .join('\n\n');

  return {
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    subject: lead.subject || lead.formName,
    company: lead.company,
    message: message || undefined,
    pageUrl: lead.pageUrl,
  };
}

/* --------------------------- notification -------------------------- */

function parseAnswers(raw: string | null): Record<string, string | boolean> | undefined {
  if (!raw) return undefined;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : undefined;
  } catch {
    return undefined;
  }
}

export interface NotifyOptions {
  settings: SiteSettings;
  /** Per-form recipients, merged with the site-wide list. */
  extraRecipients?: string[];
  /** Absolute origin, for the "open in portal" link. */
  origin?: string;
  confirmToSubmitter?: boolean;
}

/**
 * Emails the internal recipients, and optionally the submitter. Runs AFTER
 * the submission is stored and never throws: the visitor already has their
 * confirmation, and an SMTP problem must not turn into a 500 that makes
 * them submit again.
 */
export async function notifyLead(
  lead: Lead,
  opts: NotifyOptions,
): Promise<{ status: Lead['mailStatus']; error?: string }> {
  const cfg = opts.settings.notifications;
  if (!cfg?.enabled) return { status: 'off' };
  if (!mailEnabled()) return { status: 'off', error: 'Graph mail is not configured.' };

  const to = Array.from(
    new Set([...(cfg.leadRecipients || []), ...(opts.extraRecipients || [])].filter(Boolean)),
  );
  if (!to.length) return { status: 'off', error: 'No recipients configured.' };

  const payload = {
    formName: lead.formName || 'Website enquiry',
    submissionId: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    subject: lead.subject,
    message: lead.message,
    pageUrl: lead.pageUrl,
    answers: lead.answers,
    brandName: opts.settings.brandName || 'Hadya',
    adminUrl: opts.origin ? `${opts.origin}/admin/leads` : undefined,
  };

  const internal = leadNotificationEmail(payload);
  const result = await sendMail({ ...internal, to });

  // The submitter confirmation is best-effort on top of best-effort: if the
  // internal notification worked we still report success, because that is
  // the one somebody is waiting on.
  const wantsConfirm = opts.confirmToSubmitter ?? cfg.confirmToSubmitter;
  if (wantsConfirm && lead.email) {
    const confirm = submitterConfirmationEmail(payload, lead.locale === 'ar' ? 'ar' : 'en');
    const r = await sendMail(confirm);
    if (!r.ok) console.error('submitter confirmation failed:', r.detail);
  }

  if (!result.ok) console.error('lead notification failed:', result.detail);
  return result.ok ? { status: 'sent' } : { status: 'failed', error: result.detail };
}

/* ------------------------------ public ---------------------------- */

/** Stores a submission, then tries the CRM. Never throws for CRM failures. */
export type CaptureInput = LeadInput & {
  formId?: string;
  formName?: string;
  answers?: Record<string, string | boolean>;
  locale?: Locale;
  /** Push to Dynamics. Defaults to true; a form can opt out. */
  crmPush?: boolean;
};

export async function captureLead(input: CaptureInput): Promise<Lead> {
  const { crmPush = true, ...rest } = input;
  const pushToCrm = crmPush && dynamicsEnabled();

  const lead: Lead = {
    ...rest,
    id: rid(),
    createdAt: new Date().toISOString(),
    crmId: null,
    crmStatus: pushToCrm ? 'pending' : 'off',
    crmError: null,
  };

  const useDb = isDbConfigured();
  if (useDb) {
    await insertOracleLead(lead);
  } else {
    writeFileLeads([lead, ...readFileLeads()]);
  }

  if (pushToCrm) {
    try {
      lead.crmId = await createLead(crmPayload(lead));
      lead.crmStatus = 'sent';
    } catch (e) {
      lead.crmStatus = 'failed';
      lead.crmError = (e as Error).message;
      console.error('Dynamics lead push failed (lead is stored, retry later):', lead.crmError);
    }

    if (useDb) {
      await updateOracleCrm(lead.id, lead.crmId, lead.crmStatus, lead.crmError).catch((e) =>
        console.error('lead CRM status update failed:', (e as Error).message),
      );
    } else {
      const rows = readFileLeads();
      const i = rows.findIndex((r) => r.id === lead.id);
      if (i >= 0) rows[i] = lead;
      writeFileLeads(rows);
    }
  }

  return lead;
}

export async function listLeads(limit = 200): Promise<Lead[]> {
  if (!isDbConfigured()) return readFileLeads().slice(0, limit);

  return withConnection(async (conn) => {
    const r = await conn.execute<{
      SUBMISSION_ID: string;
      FULL_NAME: string;
      EMAIL: string;
      PHONE: string | null;
      COMPANY: string | null;
      SUBJECT: string | null;
      MESSAGE: string | null;
      PAGE_URL: string | null;
      CRM_ID: string | null;
      CRM_STATUS: string;
      CRM_ERROR: string | null;
      CREATED_AT: Date;
      FORM_ID: string | null;
      FORM_NAME: string | null;
      ANSWERS_JSON: string | null;
      LOCALE: string | null;
    }>(
      `SELECT submission_id, full_name, email, phone, company, subject,
              message, page_url, crm_id, crm_status, crm_error, created_at,
              form_id, form_name, answers_json, locale
         FROM cms_form_submission
        WHERE tenant_id = :t
        ORDER BY created_at DESC
        FETCH FIRST :n ROWS ONLY`,
      { t: TENANT(), n: limit },
    );

    return (r.rows ?? []).map((row) => ({
      id: row.SUBMISSION_ID,
      name: row.FULL_NAME,
      email: row.EMAIL,
      phone: row.PHONE || undefined,
      company: row.COMPANY || undefined,
      subject: row.SUBJECT || undefined,
      message: row.MESSAGE || undefined,
      pageUrl: row.PAGE_URL || undefined,
      crmId: row.CRM_ID,
      crmStatus: (row.CRM_STATUS as Lead['crmStatus']) || 'off',
      crmError: row.CRM_ERROR,
      createdAt: new Date(row.CREATED_AT).toISOString(),
      formId: row.FORM_ID || undefined,
      formName: row.FORM_NAME || undefined,
      answers: parseAnswers(row.ANSWERS_JSON),
      locale: (row.LOCALE as Locale) || 'en',
    }));
  });
}

/** Retries the Dynamics push for one stored lead. */
export async function retryLead(id: string): Promise<Lead | null> {
  const rows = await listLeads(1000);
  const lead = rows.find((r) => r.id === id);
  if (!lead) return null;
  if (!dynamicsEnabled()) {
    lead.crmStatus = 'off';
    return lead;
  }

  try {
    lead.crmId = await createLead(crmPayload(lead));
    lead.crmStatus = 'sent';
    lead.crmError = null;
  } catch (e) {
    lead.crmStatus = 'failed';
    lead.crmError = (e as Error).message;
  }

  if (isDbConfigured()) {
    await updateOracleCrm(lead.id, lead.crmId ?? null, lead.crmStatus, lead.crmError);
  } else {
    const all = readFileLeads();
    const i = all.findIndex((r) => r.id === id);
    if (i >= 0) {
      all[i] = lead;
      writeFileLeads(all);
    }
  }
  return lead;
}
