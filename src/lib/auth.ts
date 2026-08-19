import 'server-only';
import type { NextAuthOptions } from 'next-auth';
import AzureADProvider from 'next-auth/providers/azure-ad';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getServerSession } from 'next-auth';
import { timingSafeEqual } from 'crypto';
import { ssoState } from './env';
import { audit } from './db';

/* ------------------------------------------------------------------
   Sign-in, and the role that comes with it.

   Two doors:
     SSO   - Microsoft Entra ID. Active whenever the three AZURE_AD_*
             variables are filled in. This is the production path.
     Local - username + password from .env.local. Switches itself off as
             soon as SSO is configured, so a deployed app cannot be
             entered through a leftover local account. Force it off with
             ENABLE_LOCAL_LOGIN=false.

   Authorisation comes from Entra App Roles, which arrive in the id_token
   as a "roles" claim. We read that claim, map it onto ADMIN / EDITOR and
   carry it on the session token. Nothing downstream trusts the browser
   for this - see lib/rbac.ts, which every mutating API route calls.
-------------------------------------------------------------------*/

export type CmsRole = 'ADMIN' | 'EDITOR';

export const ssoConfigured = ssoState().configured;

export const localLoginEnabled =
  process.env.ENABLE_LOCAL_LOGIN === 'true' ||
  (process.env.ENABLE_LOCAL_LOGIN !== 'false' && !ssoConfigured);

const csv = (v?: string) =>
  (v || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

/** Company email domains permitted into the portal. Empty = any domain. */
const allowedDomains = csv(process.env.ADMIN_ALLOWED_DOMAINS).map((d) => d.toLowerCase());

const adminRoleValues = (
  csv(process.env.ENTRA_ADMIN_ROLES).length ? csv(process.env.ENTRA_ADMIN_ROLES) : ['Admin']
).map((r) => r.toLowerCase());

const editorRoleValues = (
  csv(process.env.ENTRA_EDITOR_ROLES).length ? csv(process.env.ENTRA_EDITOR_ROLES) : ['Editor']
).map((r) => r.toLowerCase());

const requireEntraRole = process.env.REQUIRE_ENTRA_ROLE === 'true';
const defaultRole: CmsRole = process.env.DEFAULT_ROLE === 'ADMIN' ? 'ADMIN' : 'EDITOR';

/** Decodes a JWT payload without verifying it. Safe here: the token came
 *  straight from Microsoft over TLS inside the OAuth exchange, and we only
 *  read claims that we then re-sign into our own session cookie. */
function decodeJwtPayload(token?: string | null): Record<string, unknown> | null {
  if (!token) return null;
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function rolesFromToken(idToken?: string | null, profile?: unknown): string[] {
  const fromProfile = (profile as { roles?: unknown } | undefined)?.roles;
  if (Array.isArray(fromProfile)) return fromProfile.map(String);
  const claims = decodeJwtPayload(idToken);
  const r = claims?.roles;
  return Array.isArray(r) ? r.map(String) : [];
}

/** Maps Entra app role values onto a CMS role. Admin wins over Editor. */
export function mapEntraRoles(roles: string[]): CmsRole | null {
  const lower = roles.map((r) => r.toLowerCase());
  if (lower.some((r) => adminRoleValues.includes(r))) return 'ADMIN';
  if (lower.some((r) => editorRoleValues.includes(r))) return 'EDITOR';
  return null;
}

function domainAllowed(email?: string | null): boolean {
  if (allowedDomains.length === 0) return true;
  const e = (email || '').toLowerCase();
  return allowedDomains.some((d) => e.endsWith('@' + d));
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/* --------------------------- providers --------------------------- */

const providers: NextAuthOptions['providers'] = [];

if (ssoConfigured) {
  providers.push(
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID as string,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET as string,
      tenantId: process.env.AZURE_AD_TENANT_ID as string,
      // openid/profile/email is all the portal needs. App roles ride along
      // in the id_token automatically once assigned in Entra - they are not
      // a scope you request.
      authorization: { params: { scope: 'openid profile email' } },
    }),
  );
}

if (localLoginEnabled) {
  providers.push(
    CredentialsProvider({
      id: 'local',
      name: 'Username and password',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const u = process.env.ADMIN_USERNAME || 'admin';
        const p = process.env.ADMIN_PASSWORD || '';
        if (!p) return null; // no password configured -> door stays shut
        if (
          credentials &&
          safeEqual(credentials.username || '', u) &&
          safeEqual(credentials.password || '', p)
        ) {
          return { id: 'local-admin', name: 'Local Admin', email: u + '@local' };
        }
        return null;
      },
    }),
  );
}

/* -------------------------- auth options ------------------------- */

export const authOptions: NextAuthOptions = {
  providers,
  
  session: { strategy: 'jwt', maxAge: 60 * 60 * 12 },
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    async signIn({ user, account, profile }) {
      // The local door is already gated by the password itself.
      if (account?.provider === 'local') return true;

      if (!domainAllowed(user.email)) return false;

      if (requireEntraRole) {
        const role = mapEntraRoles(rolesFromToken(account?.id_token, profile));
        if (!role) return false; // surfaces as ?error=AccessDenied on /login
      }
      return true;
    },

    async jwt({ token, account, profile }) {
      // account/profile only arrive on the first call after sign-in, so the
      // role is resolved once and then carried on the token.
      if (account) {
        token.provider = account.provider;
        if (account.provider === 'local') {
          token.role = 'ADMIN';
          token.entraRoles = [];
        } else {
          const entraRoles = rolesFromToken(account.id_token, profile);
          token.entraRoles = entraRoles;
          token.role = mapEntraRoles(entraRoles) ?? defaultRole;
          const claims = decodeJwtPayload(account.id_token);
          if (claims?.oid) token.oid = String(claims.oid);
          if (!token.email && claims?.preferred_username) {
            token.email = String(claims.preferred_username);
          }
        }
      }
      if (profile) token.name = (profile as { name?: string }).name ?? token.name;
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.name = token.name ?? session.user.name;
        session.user.email = (token.email as string) ?? session.user.email;
        session.user.role = (token.role as CmsRole) ?? defaultRole;
        session.user.oid = (token.oid as string) ?? undefined;
      }
      session.provider = token.provider as string;
      session.entraRoles = (token.entraRoles as string[]) ?? [];
      return session;
    },
  },

  events: {
    async signIn({ user, account }) {
      // Best-effort audit row; never allowed to break the sign-in.
      audit('SIGN_IN', user.email || user.name, 'provider ' + (account?.provider ?? 'unknown'));
    },
  },
};

/* --------------------------- helpers ----------------------------- */

export type AdminIdentity = { actor: string; role: CmsRole; provider?: string };

/** The signed-in admin, or null. The single source of truth for API routes. */
export async function currentAdmin(): Promise<AdminIdentity | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return {
    actor: session.user.email || session.user.name || 'unknown',
    role: session.user.role || defaultRole,
    provider: session.provider,
  };
}
