'use client';

/* ================================================================
   /login — FULL REPLACEMENT (v2).

   Both doors on one screen:
     - "Sign in with Microsoft" when Entra SSO is configured
     - email + password when local login is enabled (accounts live
       in cms_local_user, created at /admin/users)
   Which buttons render is decided by /api/auth/providers, so the
   page never shows a door the server has not opened.
   ================================================================ */

import { Suspense, useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

const ERRORS: Record<string, string> = {
  AccessDenied:
    'This account does not have access to the CMS. Ask a Marketing Admin to assign you a role.',
  Configuration:
    'Sign-in is misconfigured on the server. Check the AZURE_AD_* variables and NEXTAUTH_SECRET.',
  OAuthCallback:
    'Microsoft rejected the sign-in. The redirect URI registered in Entra ID may not match this address.',
  Verification: 'That sign-in link has expired. Start again.',
  CredentialsSignin: 'Wrong email or password, or the account is disabled.',
};

function BrandPanel() {
  return (
    <aside
      className="relative hidden flex-col justify-between overflow-hidden
        bg-[linear-gradient(150deg,#16265c_0%,#0d1a4a_45%,#08123a_100%)]
        p-[clamp(2rem,4vw,3.5rem)] text-white lg:flex"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-35 -top-35 size-[420px] rounded-full
          bg-[radial-gradient(circle,rgb(193_160_106/0.30),transparent_68%)] blur-[28px]"
      />

      <div className="relative z-10 flex items-center gap-3">
        <span aria-hidden="true" className="text-[22px] leading-none text-[#c1a06a]">&#9672;</span>
        <span className="text-[15px] font-semibold uppercase tracking-[0.2em]">Hadya Group</span>
      </div>

      <div className="relative z-10 my-auto max-w-[30ch]">
        <h1 className="mb-5 text-[clamp(1.9rem,3.4vw,2.75rem)] font-bold leading-[1.1] tracking-tight">
          Content, in your hands
        </h1>
        <p className="text-[15px] leading-relaxed text-white/70">
          Build and publish pages for the Hadya Group website. Sign in with your work account or the
          login you were given.
        </p>
      </div>

      <p className="relative z-10 text-xs text-white/40">
        &copy; {new Date().getFullYear()} Hadya Group
      </p>
    </aside>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid place-items-center bg-white p-[clamp(1.75rem,5vw,4.5rem)]">
      <div className="w-full max-w-[380px]">{children}</div>
    </main>
  );
}

const FIELD =
  'mt-1.5 w-full rounded-[10px] border border-[#d7dae2] px-3.5 py-3 text-sm text-ink ' +
  'outline-none transition focus:border-gold focus:shadow-[0_0_0_3px_rgb(193_160_106/0.18)]';

function SignInPanel() {
  const router = useRouter();
  const sp = useSearchParams();
  const { status } = useSession();
  const next = sp.get('callbackUrl') || sp.get('next') || '/admin/pages';

  const [providers, setProviders] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localErr, setLocalErr] = useState('');

  const errParam = sp.get('error');
  const urlErr = errParam ? ERRORS[errParam] || 'Sign-in failed. Try again.' : '';
  const err = localErr || urlErr;

  useEffect(() => {
    if (status === 'authenticated') router.replace(next);
  }, [status, next, router]);

  useEffect(() => {
    fetch('/api/auth/providers')
      .then((r) => r.json())
      .then(setProviders)
      .catch(() => setProviders({}));
  }, []);

  const hasSso = !!providers?.['azure-ad'];
  const hasLocal = !!providers?.local;

  async function submitLocal(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLocalErr('');
    const res = await signIn('local', {
      username: email.trim(),
      password,
      redirect: false,
    });
    setBusy(false);
    if (res?.error) {
      setLocalErr(ERRORS.CredentialsSignin);
      return;
    }
    router.replace(next);
  }

  return (
    <Panel>
      <h2 className="text-[27px] font-bold tracking-tight text-ink">Sign in</h2>
      <p className="mt-2.5 text-[13px] leading-relaxed text-dim">
        {providers === null
          ? 'Loading sign-in options…'
          : hasSso && hasLocal
            ? 'Use your Hadya Group work account, or the email and password you were given.'
            : hasSso
              ? 'Use your Hadya Group work account.'
              : 'Use the email and password you were given.'}
      </p>

      {hasSso && (
        <button
          type="button"
          onClick={() => {
            setBusy(true);
            signIn('azure-ad', { callbackUrl: next });
          }}
          disabled={busy || status === 'loading'}
          className="mt-7 flex w-full cursor-pointer items-center justify-center gap-3 rounded-[10px]
            border border-ink bg-ink px-4 py-3.5 text-sm font-semibold text-white
            shadow-[0_2px_6px_rgb(16_24_40/0.12)] transition
            hover:bg-ink-lift hover:shadow-[0_4px_12px_rgb(16_24_40/0.18)]
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold
            active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
        >
          <svg className="size-[19px] flex-none" viewBox="0 0 23 23" aria-hidden="true">
            <path d="M0 0h11v11H0z" fill="#F25022" />
            <path d="M12 0h11v11H12z" fill="#7FBA00" />
            <path d="M0 12h11v11H0z" fill="#00A4EF" />
            <path d="M12 12h11v11H12z" fill="#FFB900" />
          </svg>
          {busy ? 'Redirecting to Microsoft…' : 'Sign in with Microsoft'}
        </button>
      )}

      {hasSso && hasLocal && (
        <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.14em] text-dim">
          <span className="h-px flex-1 bg-[#e3e6ec]" />
          or with email
          <span className="h-px flex-1 bg-[#e3e6ec]" />
        </div>
      )}

      {hasLocal && (
        <form onSubmit={submitLocal} className={hasSso ? '' : 'mt-7'}>
          <label className="block text-[12.5px] font-medium text-ink">
            Email
            <input
              type="text"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={FIELD}
              required
            />
          </label>
          <label className="mt-4 block text-[12.5px] font-medium text-ink">
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={FIELD}
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy || status === 'loading'}
            className="mt-5 w-full cursor-pointer rounded-[10px] border border-[#c1a06a]
              bg-[#c1a06a] px-4 py-3.5 text-sm font-semibold text-white transition
              hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2
              focus-visible:outline-gold active:scale-[0.99]
              disabled:cursor-not-allowed disabled:opacity-55"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      )}

      {providers !== null && !hasSso && !hasLocal && (
        <p className="mt-6 text-[13px] text-dim">
          No sign-in method is configured on the server.
        </p>
      )}

      {err && (
        <p
          role="alert"
          className="mt-5 rounded-[10px] border border-danger/35 bg-danger/5 px-3.5 py-3
            text-[12.5px] leading-relaxed text-danger-ink"
        >
          {err}
        </p>
      )}

      <p
        className="mt-5 rounded-[10px] border border-[#f0dfb4] bg-[#fdf8ec] px-3.5 py-3
          text-xs leading-relaxed text-[#6b5518]"
      >
        <strong className="font-semibold text-[#4a3a0f]">Authorised staff only.</strong> Sign-ins
        are recorded.
      </p>
    </Panel>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen font-sans text-ink lg:grid-cols-2">
      <BrandPanel />
      <Suspense
        fallback={
          <Panel>
            <h2 className="text-[27px] font-bold tracking-tight text-ink">Sign in</h2>
            <p className="mt-2.5 text-[13px] text-dim">Loading sign-in options…</p>
          </Panel>
        }
      >
        <SignInPanel />
      </Suspense>
    </div>
  );
}
