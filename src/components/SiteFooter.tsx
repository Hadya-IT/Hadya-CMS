import Link from 'next/link';
import type { SiteSettings } from '@/lib/types';

export default function SiteFooter({ settings }: { settings: SiteSettings }) {
  return (
    <footer className="border-t border-brand-line bg-brand-navy text-white/60">
      <div
        className="mx-auto flex max-w-site flex-col items-center gap-6 px-6 py-14
          md:flex-row md:justify-between md:px-10"
      >
        {settings.footer.showBrand && (
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            {settings.logoLight && <img src={settings.logoLight} alt="" className="h-7 w-auto" />}
            <span className="font-serif text-sm uppercase tracking-[0.18em] text-white">
              {settings.brandName}
            </span>
          </Link>
        )}

        <span
          data-rich
          className="text-center text-xs leading-relaxed md:text-left"
          dangerouslySetInnerHTML={{ __html: settings.footer.copy || '' }}
        />

        <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2">
          {(settings.footer.links || []).map((l) => (
            <a
              key={l.id}
              href={l.href}
              target={l.external ? '_blank' : undefined}
              rel={l.external ? 'noopener' : undefined}
              className="text-eyebrow uppercase tracking-[0.16em] no-underline
                transition-colors hover:text-brand-gold-soft"
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
