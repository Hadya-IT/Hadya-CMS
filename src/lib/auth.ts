import 'server-only';
import type { NextAuthOptions } from 'next-auth';
import AzureADProvider from 'next-auth/providers/azure-ad';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getServerSession } from 'next-auth';
import { timingSafeEqual } from 'crypto';
import { ssoState } from './env';
import { audit, isDbConfigured, withConnection } from './db';
import { upgradeLegacyRole, type CmsRole } from './permissions';
import { countLocalUsers, findLocalUser, verifyPassword } from './local-users';

/* ------------------------------------------------------------------
   Sign-in, and the role that comes with it.

   Two doors, BOTH open at the same time:
     SSO   - Microsoft Entra ID (AZURE_AD_* variables). Staff path.
     Local - email + password stored in cms_local_user (Oracle),
             created by a Marketing Admin at /admin/users. For the
             agency and anyone without an Entra account.
             The .env ADMIN_USERNAME/ADMIN_PASSWORD pair is only a
             BOOTSTRAP: it works while cms_local_user is empty (or
             with no DB, i.e. local dev) and closes by itself once
             the first real local user exists.
             ENABLE_LOCAL_LOGIN=false shuts the whole local door.

   Authorisation is the same for both doors: cms_user_role (assigned
   at /admin/users) wins; Entra App Roles (Admin -> MARKETING_ADMIN,
   Editor -> AGENCY_EDITOR) are the SSO fallback; DEFAULT_ROLE is the
   last resort. The role is resolved at sign-in and carried on the
   session token, so a change applies at the next sign-in (max 12h).
-------------------------------------------------------------------*/

export type { CmsRole };

export const ssoConfigured = ssoState().configured;

export const localLoginEnabled =
  process.env.ENABLE_LOCAL_LOGIN !== 'false' &&
  (isDbConfigured() || !!process.env.ADMIN_PASSWORD);

const csv = (v?: string) =>
  (v || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

/** Company email domains permitted in through SSO. Empty = any domain. */
const allowedDomains = csv(process.env.ADMIN_ALLOWED_DOMAINS).map((d) => d.toLowerCase());

const adminRoleValues = (
  csv(process.env.ENTRA_ADMIN_ROLES).length ? csv(process.env.ENTRA_ADMIN_ROLES) : ['Admin']
).map((r) => r.toLowerCase());

const editorRoleValues = (
  csv(process.env.ENTRA_EDITOR_ROLES).length ? csv(process.env.ENTRA_EDITOR_ROLES) : ['Editor']
).map((r) => r.toLowerCase());

const requireEntraRole = process.env.REQUIRE_ENTRA_ROLE === 'true';
const defaultRole: CmsRole = upgradeLegacyRole(process.env.DEFAULT_ROLE || 'READ_ONLY');

/** CMS-assigned role for this email, or null if none was assigned. */
export async function dbRoleForEmail(email?: string | null): Promise<CmsRole | null> {
  if (!email || !isDbConfigured()) return null;
  try {
    const rows = await withConnection(async (conn) => {
      const r = await conn.execute<{ ROLE: string }>(
        `SELECT role FROM cms_user_role WHERE tenant_id = :t AND LOWER(email) = :e`,
        { t: process.env.CMS_TENANT_ID || 'hadya', e: email.toLowerCase() },
      );
      return r.rows ?? [];
    });
    if (!rows.length) return null;
    const row = rows[0] as any;
    return upgradeLegacyRole(row.ROLE ?? row[0]);
  } catch (e) {
    // A DB hiccup must not lock everyone out; fall back to Entra roles.
    console.error('cms_user_role lookup failed:', e);
    return null;
  }
}

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
  if (lower.some((r) => adminRoleValues.includes(r))) return 'MARKETING_ADMIN';
  if (lower.some((r) => editorRoleValues.includes(r))) return 'AGENCY_EDITOR';
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
      authorization: { params: { scope: 'openid profile email' } },
    }),
  );
}

if (localLoginEnabled) {
  providers.push(
    CredentialsProvider({
      id: 'local',
      name: 'Email and password',
      credentials: {
        username: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const givenUser = (credentials?.username || '').trim();
        const givenPass = credentials?.password || '';
        if (!givenUser || !givenPass) return null;

        /* 1) Real accounts: cms_local_user in Oracle. */
        if (isDbConfigured()) {
          const u = await findLocalUser(givenUser);
          if (u) {
            if (!u.active) return null; // disabled account
            if (!verifyPassword(givenPass, u.passwordHash)) return null;
            return { id: u.email, name: u.displayName || u.email, email: u.email };
          }
          /* 2) Bootstrap door: only while NO real local user exists. */
          if ((await countLocalUsers()) > 0) return null;
        }

        /* Bootstrap / no-DB dev door: .env pair. */
        const envUser = process.env.ADMIN_USERNAME || 'admin';
        const envPass = process.env.ADMIN_PASSWORD || '';
        if (!envPass) return null;
        if (safeEqual(givenUser, envUser) && safeEqual(givenPass, envPass)) {
          return { id: 'local-admin', name: 'Local Admin', email: envUser + '@local' };
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
      // The local door is gated by the password check in authorize().
      if (account?.provider === 'local') return true;

      if (!domainAllowed(user.email)) return false;

      if (requireEntraRole) {
        const assigned = await dbRoleForEmail(user.email);
        const role = assigned ?? mapEntraRoles(rolesFromToken(account?.id_token, profile));
        if (!role) return false; // surfaces as ?error=AccessDenied on /login
      }
      return true;
    },

    async jwt({ token, account, profile, user }) {
      // account only arrives on the first call after sign-in, so the role
      // is resolved once here and then carried on the token.
      if (account) {
        token.provider = account.provider;

        if (account.provider === 'local') {
          const email = user?.email || String(token.email || '');
          token.entraRoles = [];
          if (email.endsWith('@local')) {
            // .env bootstrap admin — exists to create the first real users.
            token.role = 'MARKETING_ADMIN';
          } else {
            // Real local users get exactly what /admin/users assigned them.
            token.role = (await dbRoleForEmail(email)) ?? 'READ_ONLY';
          }
        } else {
          const entraRoles = rolesFromToken(account.id_token, profile);
          token.entraRoles = entraRoles;
          const claims = decodeJwtPayload(account.id_token);
          if (claims?.oid) token.oid = String(claims.oid);
          if (!token.email && claims?.preferred_username) {
            token.email = String(claims.preferred_username);
          }
          // cms_user_role beats Entra beats DEFAULT_ROLE.
          const assigned = await dbRoleForEmail(String(token.email || ''));
          token.role = assigned ?? mapEntraRoles(entraRoles) ?? defaultRole;
        }
      }
      // Tokens minted before v3 carry ADMIN / EDITOR; upgrade in place.
      if (token.role) token.role = upgradeLegacyRole(String(token.role));
      if (profile) token.name = (profile as { name?: string }).name ?? token.name;
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.name = token.name ?? session.user.name;
        session.user.email = (token.email as string) ?? session.user.email;
        session.user.role = upgradeLegacyRole(String(token.role || '')) ?? defaultRole;
        session.user.oid = (token.oid as string) ?? undefined;
      }
      session.provider = token.provider as string;
      session.entraRoles = (token.entraRoles as string[]) ?? [];
      return session;
    },
  },

  events: {
    async signIn({ user, account }) {
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
    role: upgradeLegacyRole(String(session.user.role || '')),
    provider: session.provider,
  };
}
