import type { DefaultSession } from 'next-auth';

/* The session and token shapes produced by the callbacks in lib/auth.ts.
   `role` is the CMS role that rbac.ts enforces; `entraRoles` is the raw
   app-role claim it was derived from, kept for the status page. */

declare module 'next-auth' {
  interface Session {
    provider?: string;
    entraRoles?: string[];
    user: {
      oid?: string;
      role?: 'ADMIN' | 'EDITOR';
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    oid?: string;
    provider?: string;
    role?: 'ADMIN' | 'EDITOR';
    entraRoles?: string[];
  }
}
