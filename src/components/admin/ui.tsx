import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

/* ------------------------------------------------------------------
   Admin primitives.

   These replace what used to be component classes in admin.css (.btn,
   .inp, .fld, .pill, .card …). The utilities live here, in one place per
   element, so a button still cannot drift from the other buttons — but
   there is no stylesheet to keep in sync with the markup any more.

   Anything used once stays inline at its call site. Only genuinely
   repeated elements earn a component here.
-------------------------------------------------------------------*/

export const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

/* ----------------------------------------------------------- button */

type ButtonVariant = 'default' | 'primary' | 'danger';

const BUTTON_BASE =
  'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-panel border ' +
  'font-sans shadow-[0_1px_1px_rgb(16_24_40/0.04)] transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ' +
  'disabled:cursor-not-allowed disabled:opacity-45';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  default:
    'border-edge bg-panel text-ink hover:border-edge-strong hover:bg-subtle ' +
    'disabled:hover:border-edge disabled:hover:bg-panel',
  primary:
    'border-gold bg-gold font-semibold text-white hover:brightness-110 ' +
    'disabled:hover:brightness-100',
  danger:
    'border-edge bg-panel text-danger hover:border-danger hover:bg-subtle ' +
    'disabled:hover:border-edge disabled:hover:bg-panel',
};

export function Button({
  variant = 'default',
  size = 'md',
  block,
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  block?: boolean;
}) {
  return (
    <button
      type={type}
      className={cx(
        BUTTON_BASE,
        BUTTON_VARIANT[variant],
        size === 'sm' ? 'px-2.5 py-[5px] text-[11.5px]' : 'px-3.5 py-2 text-xs',
        block && 'w-full',
        className,
      )}
      {...rest}
    />
  );
}

/** A <label> styled as a button, for the file-input pattern where the
 *  control has to be a label to open the picker. */
export function ButtonLabel({
  variant = 'default',
  size = 'md',
  className,
  children,
}: {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  className?: string;
  children: ReactNode;
}) {
  return (
    <label
      className={cx(
        BUTTON_BASE,
        BUTTON_VARIANT[variant],
        size === 'sm' ? 'px-2.5 py-[5px] text-[11.5px]' : 'px-3.5 py-2 text-xs',
        'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-gold',
        className,
      )}
    >
      {children}
    </label>
  );
}

/** The 22px square icon buttons in the page / section / array list rows. */
export function IconButton({
  danger,
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button
      type={type}
      className={cx(
        'size-[22px] cursor-pointer rounded-[5px] border border-edge bg-panel',
        'text-xs leading-none text-dim transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold',
        danger ? 'hover:border-danger hover:text-danger' : 'hover:text-ink',
        className,
      )}
      {...rest}
    />
  );
}

/* ------------------------------------------------------------ inputs */

const CONTROL =
  'w-full rounded-panel border border-edge bg-panel px-2.5 py-2 font-sans text-[12.5px] text-ink ' +
  'placeholder:text-dim/70 focus:border-gold focus:outline-none focus:ring-[3px] focus:ring-gold/15';

export function Input({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(CONTROL, className)} {...rest} />;
}

export function Textarea({
  code,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { code?: boolean }) {
  return (
    <textarea
      className={cx(
        CONTROL,
        'min-h-[76px] resize-y leading-normal',
        code && 'font-mono text-[11.5px]',
        className,
      )}
      {...rest}
    />
  );
}

/** Native select, custom chevron. `appearance-none` plus a positioned
 *  glyph beats the two-gradient background trick it replaces — it scales
 *  with font size and needs no magic pixel offsets. */
export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block">
      <select className={cx(CONTROL, 'cursor-pointer appearance-none pr-8', className)} {...rest}>
        {children}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[9px] text-dim"
      >
        ▼
      </span>
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className="relative h-[21px] w-[38px] rounded-full border border-edge bg-subtle
          transition-colors duration-200
          after:absolute after:left-[3px] after:top-[3px] after:size-[13px] after:rounded-full
          after:bg-[#aeb6c2] after:transition-transform after:duration-200 after:content-['']
          peer-checked:border-gold peer-checked:bg-gold/15
          peer-checked:after:translate-x-[17px] peer-checked:after:bg-gold
          peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold"
      />
    </label>
  );
}

/* ------------------------------------------------------------- field */

export function FieldShell({
  label,
  htmlFor,
  help,
  className,
  children,
}: {
  label?: string;
  htmlFor?: string;
  help?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx('mb-3.5 min-w-0', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="mb-1.5 block text-[11px] uppercase tracking-[0.1em] text-dim"
        >
          {label}
        </label>
      )}
      {children}
      {help && <span className="mt-[5px] block text-[11px] text-dim">{help}</span>}
    </div>
  );
}

/** Two controls side by side, collapsing on narrow inspector panes. */
export function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-3 [&>*]:min-w-0 [&>*]:flex-1">{children}</div>;
}

/* ------------------------------------------------------ text & chrome */

export function Muted({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cx('text-xs text-dim', className)}>{children}</p>;
}

export function SubHeading({ children }: { children: ReactNode }) {
  return (
    <h4 className="mb-2.5 mt-5 text-[11px] uppercase tracking-[0.12em] text-gold">{children}</h4>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={cx(
        'mt-4 rounded-panel border border-edge bg-panel p-4 shadow-[0_1px_2px_rgb(16_24_40/0.04)]',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3.5 text-[11px] uppercase tracking-[0.13em] text-gold">{children}</h3>
  );
}

const PILL_BASE =
  'inline-block rounded-full px-[7px] py-0.5 text-[9.5px] uppercase tracking-[0.1em]';

export function Pill({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: 'neutral' | 'ok' | 'danger';
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        PILL_BASE,
        tone === 'ok' && 'bg-ok/12 text-ok',
        tone === 'danger' && 'bg-danger/12 text-danger',
        tone === 'neutral' && 'bg-subtle text-dim',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Chip({
  tone = 'neutral',
  title,
  children,
}: {
  tone?: 'neutral' | 'ok';
  title?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={cx(
        'inline-block self-start rounded-full border px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.08em]',
        tone === 'ok' ? 'border-ok/35 bg-ok/12 text-ok' : 'border-edge bg-subtle text-dim',
      )}
    >
      {children}
    </span>
  );
}

/** Sticky column header inside the editor panes and page bodies. */
export function PaneHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="sticky top-0 z-5 flex items-center justify-between gap-2.5 bg-inherit px-3.5 pb-2.5 pt-3.5">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">{title}</h2>
      {children}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="my-3 rounded-panel border border-danger/35 bg-danger/5 px-3 py-2.5 text-xs leading-relaxed text-danger-ink">
      {children}
    </div>
  );
}
