'use client';

import { Suspense, useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

/* ------------------------------------------------------------------
   Split screen. The brand panel uses the site's navy and gold rather
   than a stock indigo, so the portal reads as part of Hadya. The
   Microsoft button follows their branding guidance: full-colour
   four-square mark, "Sign in with Microsoft".
-------------------------------------------------------------------*/

const ERRORS: Record<string, string> = {
  AccessDenied:
    'This account does not have access to the CMS. Ask IT to assign you the Admin or Editor app role in Entra ID.',
  Configuration:
    'Sign-in is misconfigured on the server. Check the AZURE_AD_* variables and NEXTAUTH_SECRET.',
  OAuthCallback:
    'Microsoft rejected the sign-in. The redirect URI registered in Entra ID may not match this address.',
  Verification: 'That sign-in link has expired. Start again.',
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
          Build and publish pages for the Hadya Group website. Sign in with your work account to
          start editing.
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

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <>
      <h2 className="text-[27px] font-bold tracking-tight text-ink">Sign in</h2>
      <p className="mt-2.5 text-[13px] leading-relaxed text-dim">{children}</p>
    </>
  );
}

function SignInPanel() {
  const router = useRouter();
  const sp = useSearchParams();
  const { status } = useSession();
  const next = sp.get('callbackUrl') || sp.get('next') || '/admin/pages';
  const [busy, setBusy] = useState(false);

  const errParam = sp.get('error');
  const err = errParam ? ERRORS[errParam] || 'Sign-in failed. Try again.' : '';

  useEffect(() => {
    if (status === 'authenticated') router.replace(next);
  }, [status, next, router]);

  return (
    <Panel>
      <Heading>Use your Hadya Group work account.</Heading>

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
            <Heading>Loading sign-in options…</Heading>
          </Panel>
        }
      >
        <SignInPanel />
      </Suspense>
    </div>
  );
}
