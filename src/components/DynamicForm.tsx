'use client';

import { useMemo, useState } from 'react';
import { track } from '@/lib/track';
import { HEADING, Label, cx } from '@/components/site/ui';
import {
  consentText as consentTextFor,
  fieldLabel,
  submitLabel as submitLabelFor,
  successMessage as successMessageFor,
} from '@/lib/formdefs';
import { t } from '@/lib/i18n';
import type { FormDef, FormFieldDef, Locale } from '@/lib/types';

/* ------------------------------------------------------------------
   Renders whatever form an editor built.

   The server is the authority on validation (lib/formdefs.validateSubmission,
   called from /api/forms). What happens here is only so the visitor does not
   have to round-trip to learn they missed a field — every check below is
   repeated server-side against the STORED definition.

   Field errors come back from the API keyed by field name, which is why the
   error state is a map rather than a single string: a ten-field form that
   only says "something was wrong" is a form people abandon.
-------------------------------------------------------------------*/

type Status = 'idle' | 'sending' | 'sent' | 'error';

const FIELD =
  'w-full border border-sec-line bg-transparent px-4 py-3.5 text-body text-sec-heading ' +
  'placeholder:text-sec-text/60 transition-colors ' +
  'focus:border-sec-accent focus:outline-none';

const FIELD_ERROR = 'border-[#c0392b] focus:border-[#c0392b]';

export default function DynamicForm({
  form,
  locale = 'en',
  /** Shown as a fallback contact route if posting fails. */
  fallbackEmail,
  label,
}: {
  form: FormDef;
  locale?: Locale;
  fallbackEmail?: string;
  label?: string;
}) {
  const blank = useMemo(() => {
    const v: Record<string, string | boolean> = {};
    for (const f of form.fields) v[f.name] = f.type === 'checkbox' ? false : '';
    return v;
  }, [form.fields]);

  const [values, setValues] = useState<Record<string, string | boolean>>(blank);
  const [honeypot, setHoneypot] = useState('');
  const [consented, setConsented] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [started, setStarted] = useState(false);

  const consentLine = consentTextFor(form, locale);
  const ar = locale === 'ar';

  function set(field: FormFieldDef, value: string | boolean) {
    if (!started) {
      setStarted(true);
      track('form_start', { form: form.name });
    }
    setValues((prev) => ({ ...prev, [field.name]: value }));
    // Clear the error as soon as they start fixing it.
    if (errors[field.name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field.name];
        return next;
      });
    }
  }

  function clientValidate(): Record<string, string> {
    const found: Record<string, string> = {};
    for (const f of form.fields) {
      const v = values[f.name];
      if (f.type === 'checkbox') {
        if (f.required && v !== true) found[f.name] = t(locale, 'required');
        continue;
      }
      const text = typeof v === 'string' ? v.trim() : '';
      if (f.required && !text) {
        found[f.name] = t(locale, 'required');
        continue;
      }
      if (f.type === 'email' && text && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text)) {
        found[f.name] = t(locale, 'invalidEmail');
      }
    }
    return found;
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    const found = clientValidate();
    if (consentLine && !consented) {
      found.consent = ar ? 'يجب الموافقة للمتابعة.' : 'Please agree in order to continue.';
    }
    if (Object.keys(found).length) {
      setErrors(found);
      setStatus('error');
      // Move focus to the first problem so keyboard and screen-reader users
      // are not left guessing where it is.
      const first = form.fields.find((f) => found[f.name]);
      if (first) document.getElementById(`f-${form.id}-${first.name}`)?.focus();
      return;
    }

    setStatus('sending');
    setErrors({});

    try {
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formId: form.id,
          locale,
          website: honeypot,
          consent: consented,
          pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
          ...values,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (json.fields && typeof json.fields === 'object') {
          setErrors(json.fields as Record<string, string>);
          setStatus('error');
          return;
        }
        throw new Error(json.error || t(locale, 'genericError'));
      }

      setStatus('sent');
      track('form_submit', { form: form.name, crm: json.crm || 'unknown' });
      setValues(blank);
      setConsented(false);
    } catch (err) {
      setStatus('error');
      setFormError((err as Error).message);
    }
  }

  const submitClasses =
    'mt-2 cursor-pointer border border-sec-accent bg-sec-accent px-8 py-3.5 ' +
    'text-eyebrow uppercase tracking-[0.18em] text-sec transition-colors ' +
    'hover:bg-transparent hover:text-sec-accent ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sec-accent ' +
    'disabled:cursor-not-allowed disabled:opacity-60';

  if (status === 'sent') {
    return (
      <div className="mt-12 border border-sec-line p-10 text-center">
        <strong className={cx(HEADING, 'block text-h3')}>{successMessageFor(form, locale)}</strong>
        <p className="mt-2.5 text-body text-sec-text">{t(locale, 'sentSub')}</p>
        <button type="button" className={submitClasses} onClick={() => setStatus('idle')}>
          {t(locale, 'sendAnother')}
        </button>
      </div>
    );
  }

  /* Half-width fields are paired into rows so the grid stays predictable
     without the editor having to think about layout. */
  const rows: FormFieldDef[][] = [];
  let pending: FormFieldDef | null = null;
  for (const f of form.fields) {
    if (f.half) {
      if (pending) {
        rows.push([pending, f]);
        pending = null;
      } else {
        pending = f;
      }
    } else {
      if (pending) {
        rows.push([pending]);
        pending = null;
      }
      rows.push([f]);
    }
  }
  if (pending) rows.push([pending]);

  return (
    <form onSubmit={send} className="mt-12 flex flex-col gap-4" noValidate>
      {label && <Label>{label}</Label>}

      {rows.map((row, i) => (
        <div key={i} className={row.length > 1 ? 'grid gap-4 md:grid-cols-2' : undefined}>
          {row.map((f) => (
            <Field
              key={f.id}
              form={form}
              field={f}
              locale={locale}
              value={values[f.name]}
              error={errors[f.name]}
              onChange={(v) => set(f, v)}
            />
          ))}
        </div>
      ))}

      {/* Honeypot — hidden from people, irresistible to bots. */}
      <input
        className="sr-only"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        placeholder="Website"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
      />

      {consentLine && (
        <div>
          <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-sec-text">
            <input
              type="checkbox"
              id={`f-${form.id}-consent`}
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
              className="mt-1 accent-sec-accent"
              aria-invalid={!!errors.consent}
            />
            <span>{consentLine}</span>
          </label>
          {errors.consent && (
            <p role="alert" className="mt-1 text-[12.5px] text-[#c0392b]">
              {errors.consent}
            </p>
          )}
        </div>
      )}

      <button
        type="submit"
        className={cx(submitClasses, 'self-start')}
        disabled={status === 'sending'}
      >
        {status === 'sending' ? t(locale, 'sending') : submitLabelFor(form, locale)}
      </button>

      {status === 'error' && formError && (
        <p role="alert" className="text-body text-[#c0392b]">
          {formError}
          {fallbackEmail && (
            <>
              {' '}
              {ar ? 'يمكنك أيضًا مراسلتنا على' : 'You can also email us at'}{' '}
              <a className="underline underline-offset-2" href={`mailto:${fallbackEmail}`}>
                {fallbackEmail}
              </a>
              .
            </>
          )}
        </p>
      )}
    </form>
  );
}

/* ----------------------------- one field ----------------------------- */

function Field({
  form,
  field,
  locale,
  value,
  error,
  onChange,
}: {
  form: FormDef;
  field: FormFieldDef;
  locale: Locale;
  value: string | boolean | undefined;
  error?: string;
  onChange: (v: string | boolean) => void;
}) {
  const id = `f-${form.id}-${field.name}`;
  const label = fieldLabel(field, locale);
  const placeholder = field.placeholder || label;
  const describedBy = error ? `${id}-error` : undefined;
  const cls = cx(FIELD, error && FIELD_ERROR);

  const common = {
    id,
    'aria-label': label,
    'aria-invalid': !!error,
    'aria-describedby': describedBy,
    'aria-required': field.required || undefined,
  };

  return (
    <div className="min-w-0">
      {field.type === 'checkbox' ? (
        <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-sec-text">
          <input
            {...common}
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-1 accent-sec-accent"
          />
          <span>
            {label}
            {!field.required && (
              <em className="ml-1 not-italic text-sec-text/60">({t(locale, 'optional')})</em>
            )}
          </span>
        </label>
      ) : field.type === 'textarea' ? (
        <textarea
          {...common}
          className={cx(cls, 'min-h-[160px] resize-y leading-sec')}
          placeholder={placeholder}
          maxLength={field.maxLength}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === 'select' ? (
        <select
          {...common}
          className={cx(cls, 'cursor-pointer')}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{placeholder}</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...common}
          type={
            field.type === 'email'
              ? 'email'
              : field.type === 'tel'
                ? 'tel'
                : field.type === 'number'
                  ? 'number'
                  : field.type === 'date'
                    ? 'date'
                    : 'text'
          }
          className={cls}
          placeholder={placeholder}
          maxLength={field.maxLength}
          autoComplete={
            field.type === 'email'
              ? 'email'
              : field.type === 'tel'
                ? 'tel'
                : field.name === 'name'
                  ? 'name'
                  : field.name === 'company'
                    ? 'organization'
                    : undefined
          }
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-[12.5px] text-[#c0392b]">
          {error}
        </p>
      )}
    </div>
  );
}
