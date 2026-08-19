'use client';
import { useState } from 'react';
import { HEADING, cx } from '@/components/site/ui';

export default function AccordionList({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mt-10 border-t border-sec-line">
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className="border-b border-sec-line">
            <h3>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                aria-controls={`acc-panel-${i}`}
                id={`acc-btn-${i}`}
                className={cx(
                  HEADING,
                  'flex w-full cursor-pointer items-start justify-between gap-6 py-6 text-left',
                  'text-h3 font-medium transition-colors hover:text-sec-accent',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sec-accent',
                )}
              >
                <span>{it.q}</span>
                <span
                  aria-hidden="true"
                  className={cx(
                    'mt-1 shrink-0 text-xl leading-none text-sec-accent transition-transform duration-300',
                    isOpen && 'rotate-45',
                  )}
                >
                  +
                </span>
              </button>
            </h3>
            <div
              id={`acc-panel-${i}`}
              role="region"
              aria-labelledby={`acc-btn-${i}`}
              hidden={!isOpen}
              data-rich
              className="max-w-[70ch] pb-7 text-body leading-sec text-sec-text"
              dangerouslySetInnerHTML={{ __html: it.a || '' }}
            />
          </div>
        );
      })}
    </div>
  );
}
