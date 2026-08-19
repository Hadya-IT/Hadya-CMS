import type { FormDef, FormFieldDef, Locale } from './types';

/* ------------------------------------------------------------------
   Form definitions and submission validation.

   THE RULE THAT MATTERS: the browser's `required` attribute and the
   client-side checks in DynamicForm are conveniences. This module is the
   real validation, it runs in the API route, and it validates against the
   STORED definition — never against a field list posted by the client.
   Otherwise anyone could POST arbitrary keys and have them stored and
   emailed, which is a spam relay with extra steps.

   Kept free of `server-only` because DynamicForm needs the same field
   metadata to render labels and input types. Nothing here touches Node.
-------------------------------------------------------------------*/

export const CONTACT_FORM_ID = 'contact';

/** The form every site starts with; also the fallback for a `form` block
 *  whose chosen form was deleted. Field names match the original hardcoded
 *  contact form so historical submissions stay comparable. */
export const DEFAULT_CONTACT_FORM: FormDef = {
  id: CONTACT_FORM_ID,
  name: 'Contact enquiry',
  submitLabel: 'Send message',
  submitLabelAr: 'إرسال الرسالة',
  successMessage: 'Thank you — your message has been received.',
  successMessageAr: 'شكرًا لك — تم استلام رسالتك.',
  crmPush: true,
  consentText: '',
  fields: [
    { id: 'f_name', name: 'name', label: 'Your name', labelAr: 'الاسم', type: 'text', required: true, half: true, maxLength: 120, crmField: 'firstname' },
    { id: 'f_email', name: 'email', label: 'Your email', labelAr: 'البريد الإلكتروني', type: 'email', required: true, half: true, maxLength: 160, crmField: 'emailaddress1' },
    { id: 'f_phone', name: 'phone', label: 'Your phone', labelAr: 'رقم الهاتف', type: 'tel', half: true, maxLength: 40, crmField: 'telephone1' },
    { id: 'f_company', name: 'company', label: 'Company', labelAr: 'الشركة', type: 'text', half: true, maxLength: 120, crmField: 'companyname' },
    { id: 'f_subject', name: 'subject', label: 'Subject', labelAr: 'الموضوع', type: 'text', maxLength: 200, crmField: 'subject' },
    { id: 'f_message', name: 'message', label: 'Your message', labelAr: 'رسالتك', type: 'textarea', required: true, maxLength: 4000, crmField: 'description' },
  ],
};

/** Reserved names: used by the transport itself, so a field cannot claim them. */
export const RESERVED_FIELD_NAMES = ['formId', 'website', 'pageUrl', 'locale', 'consent'];

export function listForms(forms: FormDef[] | undefined): FormDef[] {
  if (!forms?.length) return [DEFAULT_CONTACT_FORM];
  return forms;
}

export function findForm(forms: FormDef[] | undefined, id: string | undefined): FormDef | null {
  const all = listForms(forms);
  if (!id) return all[0] ?? null;
  return all.find((f) => f.id === id) ?? null;
}

/** Label in the requested locale, falling back to English. */
export function fieldLabel(field: FormFieldDef, locale: Locale): string {
  if (locale === 'ar' && field.labelAr?.trim()) return field.labelAr;
  return field.label;
}

export function submitLabel(form: FormDef, locale: Locale): string {
  if (locale === 'ar' && form.submitLabelAr?.trim()) return form.submitLabelAr;
  return form.submitLabel || 'Send';
}

export function successMessage(form: FormDef, locale: Locale): string {
  if (locale === 'ar' && form.successMessageAr?.trim()) return form.successMessageAr;
  return form.successMessage || 'Thank you — your message has been received.';
}

export function consentText(form: FormDef, locale: Locale): string {
  if (locale === 'ar' && form.consentTextAr?.trim()) return form.consentTextAr;
  return form.consentText || '';
}

/* --------------------------- validation --------------------------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Per-type hard ceilings, so a definition with a silly maxLength cannot
 *  let a 5 MB "phone number" into the database. */
const TYPE_CEILING: Record<FormFieldDef['type'], number> = {
  text: 500,
  email: 160,
  tel: 40,
  textarea: 5000,
  number: 40,
  select: 200,
  checkbox: 10,
  date: 40,
};

export interface ValidationResult {
  ok: boolean;
  /** Cleaned values, keyed by field name. Only known fields survive. */
  values: Record<string, string | boolean>;
  /** Field name -> message. */
  errors: Record<string, string>;
}

export function validateSubmission(
  form: FormDef,
  raw: Record<string, unknown>,
  locale: Locale = 'en',
): ValidationResult {
  const values: Record<string, string | boolean> = {};
  const errors: Record<string, string> = {};

  const requiredMsg = locale === 'ar' ? 'هذا الحقل مطلوب.' : 'This field is required.';
  const emailMsg = locale === 'ar' ? 'أدخل بريدًا إلكترونيًا صحيحًا.' : 'Enter a valid email address.';
  const numberMsg = locale === 'ar' ? 'أدخل رقمًا صحيحًا.' : 'Enter a valid number.';
  const choiceMsg = locale === 'ar' ? 'اختر أحد الخيارات.' : 'Choose one of the listed options.';

  for (const field of form.fields) {
    const input = raw[field.name];
    const cap = Math.min(field.maxLength ?? TYPE_CEILING[field.type], TYPE_CEILING[field.type]);

    if (field.type === 'checkbox') {
      const on = input === true || input === 'true' || input === 'on' || input === '1';
      if (field.required && !on) errors[field.name] = requiredMsg;
      values[field.name] = on;
      continue;
    }

    const text = typeof input === 'string' ? input.trim().slice(0, cap) : '';

    if (!text) {
      if (field.required) errors[field.name] = requiredMsg;
      // An empty optional field is simply not stored.
      continue;
    }

    if (field.type === 'email' && !EMAIL_RE.test(text)) {
      errors[field.name] = emailMsg;
      continue;
    }
    if (field.type === 'number' && !/^-?\d+(\.\d+)?$/.test(text)) {
      errors[field.name] = numberMsg;
      continue;
    }
    if (field.type === 'select' && field.options?.length && !field.options.includes(text)) {
      // Reject values that were not offered — a tampered <select>.
      errors[field.name] = choiceMsg;
      continue;
    }

    values[field.name] = text;
  }

  return { ok: Object.keys(errors).length === 0, values, errors };
}

/* ------------------------- lead field mapping ------------------------- */

export interface MappedLead {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  subject?: string;
  message?: string;
  /** Everything that had no CRM mapping, preserved for storage and email. */
  answers: Record<string, string | boolean>;
}

/**
 * Projects validated answers onto the fixed lead shape the CRM and the
 * submissions table already understand. Unmapped answers are kept in
 * `answers` rather than discarded — they still reach the notification email
 * and the stored JSON, and get appended to the Dynamics description.
 */
export function mapToLead(form: FormDef, values: Record<string, string | boolean>): MappedLead {
  const byCrm = (target: string): string | undefined => {
    const field = form.fields.find((f) => f.crmField === target);
    if (!field) return undefined;
    const v = values[field.name];
    return typeof v === 'string' && v ? v : undefined;
  };

  const mappedNames = new Set(form.fields.filter((f) => f.crmField).map((f) => f.name));
  const answers: Record<string, string | boolean> = {};
  for (const [k, v] of Object.entries(values)) {
    if (!mappedNames.has(k)) answers[k] = v;
  }

  // Fall back to conventional names so a form built without CRM mappings
  // still produces a usable lead.
  const pick = (crm: string, ...names: string[]): string | undefined => {
    const viaCrm = byCrm(crm);
    if (viaCrm) return viaCrm;
    for (const n of names) {
      const v = values[n];
      if (typeof v === 'string' && v) return v;
    }
    return undefined;
  };

  return {
    name: pick('firstname', 'name', 'fullName', 'full_name') || 'Website visitor',
    email: pick('emailaddress1', 'email') || '',
    phone: pick('telephone1', 'phone', 'mobile'),
    company: pick('companyname', 'company', 'organisation', 'organization'),
    subject: pick('subject', 'subject', 'topic'),
    message: pick('description', 'message', 'enquiry', 'details'),
    answers,
  };
}

/** Slug-safe machine name for a new field. */
export function toFieldName(label: string, taken: string[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'field';
  let name = base;
  let n = 2;
  while (taken.includes(name) || RESERVED_FIELD_NAMES.includes(name)) {
    name = `${base}_${n++}`;
  }
  return name;
}
