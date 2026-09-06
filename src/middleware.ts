import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

/* A first gate only. It keeps anonymous users out of /admin, but it is
   not authorisation — the API routes call requireCapability() in
   lib/rbac.ts, which is where access is actually decided. */

const KNOWN_ROLES = [
  'MARKETING_ADMIN',
  'AGENCY_EDITOR',
  'CONTRIBUTOR',
  'APPROVER',
  'READ_ONLY',
  // Legacy tokens minted before the role rename — auth.ts upgrades
  // them at the API layer; the middleware just lets them through.
  'ADMIN',
  'EDITOR',
];

export default withAuth(
  function middleware(req) {
    const role = String(req.nextauth.token?.role || '');
    if (!KNOWN_ROLES.includes(role)) {
      return NextResponse.redirect(new URL('/login?error=AccessDenied', req.url));
    }
    return NextResponse.next();
  },
  {
    pages: { signIn: '/login', error: '/login' },
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  },
);

export const config = {
  matcher: ['/admin/:path*'],
};
