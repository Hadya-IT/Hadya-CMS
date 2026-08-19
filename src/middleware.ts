import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

/* A first gate only. It keeps anonymous and non-CMS users out of /admin,
   but it is not authorisation — the API routes call requireRole() in
   lib/rbac.ts, which is where access is actually decided. */

export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role;
    if (role !== 'ADMIN' && role !== 'EDITOR') {
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
