'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useAdmin } from './AdminProvider';
import { Button, Chip, cx } from './ui';

const NAV = [
  { href: '/admin/pages', label: 'Pages' },
  { href: '/admin/media', label: 'Media' },
  { href: '/admin/forms', label: 'Forms' },
  { href: '/admin/leads', label: 'Submissions' },
  { href: '/admin/translate', label: 'Translation' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/seo', label: 'SEO & redirects' },
  { href: '/admin/settings', label: 'Settings', adminOnly: true },
  { href: '/admin/status', label: 'System status' },
  { href: '/admin/guide', label: 'User guide' },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const { dirty, saving, save, error, loading, driver } = useAdmin();

  return (
    <div className="grid min-h-screen bg-app font-sans text-[13px] text-ink lg:grid-cols-[208px_1fr]">
      <aside
        className="flex flex-col gap-[22px] border-b border-edge bg-panel px-3.5 py-[18px]
          lg:border-b-0 lg:border-r lg:shadow-[1px_0_0_rgb(16_24_40/0.02)]"
      >
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="text-lg text-gold">◈</span>
          <div>
            <strong className="block text-[13px] tracking-[0.04em]">Hadya CMS</strong>
            <small className="text-[11px] text-dim">Block editor</small>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5">
          {NAV.filter((n) => !n.adminOnly || role === 'ADMIN').map((n) => {
            const on = path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={on ? 'page' : undefined}
                className={cx(
                  'rounded-panel px-[11px] py-[9px] no-underline transition-colors',
                  on ? 'bg-subtle text-gold' : 'text-dim hover:bg-subtle hover:text-ink',
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-2 text-xs lg:mt-auto">
          {driver && (
            <Chip tone={driver === 'oracle' ? 'ok' : 'neutral'} title="Where content is stored">
              {driver === 'oracle' ? 'Oracle DB' : 'Local file'}
            </Chip>
          )}
          {session?.user && (
            <span className="truncate text-[11px] text-dim" title={session.user.email || ''}>
              {session.user.name || session.user.email}
              {role && (
                <em className="ml-1.5 inline-block rounded not-italic bg-gold/15 px-1.5 py-px text-[10px] tracking-[0.06em] text-gold">
                  {role}
                </em>
              )}
            </span>
          )}
          <a
            href="/"
            target="_blank"
            rel="noopener"
            className="py-1 text-left text-dim no-underline hover:text-gold"
          >
            View site ↗
          </a>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="cursor-pointer py-1 text-left text-dim hover:text-gold"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header
          className="sticky top-0 z-20 flex min-h-[52px] flex-wrap items-center gap-3.5
            border-b border-edge bg-panel px-[18px] py-2"
        >
          <span className={cx('text-xs', dirty ? 'text-gold' : 'text-dim')}>
            {loading ? 'Loading…' : dirty ? 'Unsaved changes' : 'All changes saved'}
          </span>
          {error && <span className="text-xs text-danger">{error}</span>}
          <Button
            variant="primary"
            className="ml-auto"
            disabled={!dirty || saving}
            onClick={save}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </header>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
