import type { DefaultSession } from 'next-auth';
import type { CmsRole } from '@/lib/permissions';

/* The session and token shapes produced by the callbacks in lib/auth.ts.
   `role` is typed loosely as string on the wire: tokens minted before the
   v3 role rename still carry ADMIN / EDITOR, and lib/auth.ts upgrades
   them via upgradeLegacyRole() before anything trusts the value. */

declare module 'next-auth' {
  interface Session {
    provider?: string;
    entraRoles?: string[];
    user: {
      oid?: string;
      role?: CmsRole | 'ADMIN' | 'EDITOR';
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    oid?: string;
    provider?: string;
    role?: CmsRole | 'ADMIN' | 'EDITOR' | string;
    entraRoles?: string[];
  }
}
