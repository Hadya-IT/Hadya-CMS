'use client';
import { useState } from 'react';
import { track } from '@/lib/track';
import { HEADING, Label, cx } from '@/components/site/ui';

/* Posts to /api/forms, which stores the submission and (when configured)
   creates a lead in Dynamics 365. The visitor's confirmation does not
   depend on the CRM - see lib/leads.ts for why. */

type Status = 'idle' | 'sending' | 'sent' | 'error';

const FIELD =
  'w-full border border-sec-line bg-transparent px-4 py-3.5 text-body text-sec-heading ' +
  'placeholder:text-sec-text/60 transition-colors ' +
  'focus:border-sec-accent focus:outline-none';

export default function ContactForm({
  label,
  button,
  email,
}: {
  label?: string;
  button?: string;
  /** Kept for backwards compatibility: shown as a fallback if posting fails. */
  email?: string;
}) {
  const [f, setF] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    subject: '',
    message: '',
    website: '', // honeypot
  });
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  const [started, setStarted] = useState(false);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // form_start fires once, on the first keystroke. Comparing it to
    // form_submit is what tells you whether the form itself is the problem.
    if (!started) { setStarted(true); track('form_start'); }
    setF({ ...f, [k]: e.target.value });
  };

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setError('');
    try {
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...f,
          pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Something went wrong. Please try again.');
      setStatus('sent');
      track('form_submit', { form: 'contact', crm: json.crmStatus || 'unknown' });
      setF({ name: '', email: '', phone: '', company: '', subject: '', message: '', website: '' });
    } catch (e) {
      setStatus('error');
      setError((e as Error).message);
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
        <strong className={cx(HEADING, 'block text-h3')}>
          Thank you — your message has been received.
        </strong>
        <p className="mt-2.5 text-body text-sec-text">Our team will be in touch shortly.</p>
        <button type="button" className={submitClasses} onClick={() => setStatus('idle')}>
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={send} className="mt-12 flex flex-col gap-4">
      {label && <Label>{label}</Label>}

      <div className="grid gap-4 md:grid-cols-2">
        <input className={FIELD} placeholder="Your name" aria-label="Your name" required
          value={f.name} onChange={set('name')} autoComplete="name" />
        <input className={FIELD} placeholder="Your email" aria-label="Your email" type="email" required
          value={f.email} onChange={set('email')} autoComplete="email" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <input className={FIELD} placeholder="Your phone" aria-label="Your phone"
          value={f.phone} onChange={set('phone')} autoComplete="tel" />
        <input className={FIELD} placeholder="Company (optional)" aria-label="Company"
          value={f.company} onChange={set('company')} autoComplete="organization" />
      </div>
      <input className={FIELD} placeholder="Subject" aria-label="Subject"
        value={f.subject} onChange={set('subject')} />
      <textarea className={cx(FIELD, 'min-h-[160px] resize-y leading-sec')} placeholder="Your message"
        aria-label="Your message" value={f.message} onChange={set('message')} />

      {/* Honeypot - hidden from people, irresistible to bots. */}
      <input
        className="sr-only"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        placeholder="Website"
        value={f.website}
        onChange={set('website')}
      />

      <button type="submit" className={cx(submitClasses, 'self-start')} disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : button || 'Send message'}
      </button>

      {status === 'error' && (
        <p role="alert" className="text-body text-[#c0392b]">
          {error}
          {email && (
            <>
              {' '}
              You can also email us at{' '}
              <a className="underline underline-offset-2" href={`mailto:${email}`}>{email}</a>.
            </>
          )}
        </p>
      )}
    </form>
  );
}
