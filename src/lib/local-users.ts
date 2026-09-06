import 'server-only';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { isDbConfigured, withConnection } from './db';

/* ------------------------------------------------------------------
   DB-backed password accounts, living NEXT TO Entra SSO.

   - Credentials in cms_local_user, scrypt-hashed (Node built-in — no
     new dependency, memory-hard, fine at this scale).
   - Authorisation stays in cms_user_role for both doors: a local user
     and an SSO user with the same email are the same person to the
     permission system.
   - The .env ADMIN_USERNAME/ADMIN_PASSWORD pair survives ONLY as a
     bootstrap: it works while cms_local_user is empty (or when no DB
     is configured, i.e. local dev). The moment the first real local
     user exists, the env door closes by itself.
-------------------------------------------------------------------*/

const TENANT = () => process.env.CMS_TENANT_ID || 'hadya';
const SCRYPT_N = 16384;

export const MIN_PASSWORD_LENGTH = 10;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, 64, { N: SCRYPT_N });
  return `scrypt$${SCRYPT_N}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false;
  const [, nStr, saltB64, hashB64] = parts;
  try {
    const expected = Buffer.from(hashB64, 'base64');
    const actual = scryptSync(plain, Buffer.from(saltB64, 'base64'), expected.length, {
      N: Number(nStr) || SCRYPT_N,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export type LocalUser = {
  email: string;
  displayName: string | null;
  active: boolean;
  createdBy: string | null;
  createdAt: string | null;
};

export async function findLocalUser(
  email: string,
): Promise<{ email: string; displayName: string | null; passwordHash: string; active: boolean } | null> {
  if (!isDbConfigured()) return null;
  const rows = await withConnection(async (conn) => {
    const r = await conn.execute<{ EMAIL: string; DISPLAY_NAME: string | null; PASSWORD_HASH: string; ACTIVE: string }>(
      `SELECT email, display_name, password_hash, active
         FROM cms_local_user WHERE tenant_id = :t AND LOWER(email) = :e`,
      { t: TENANT(), e: email.toLowerCase() },
    );
    return r.rows ?? [];
  });
  if (!rows.length) return null;
  const u = rows[0] as any;
  return {
    email: u.EMAIL ?? u[0],
    displayName: u.DISPLAY_NAME ?? u[1] ?? null,
    passwordHash: u.PASSWORD_HASH ?? u[2],
    active: (u.ACTIVE ?? u[3]) === 'Y',
  };
}

export async function countLocalUsers(): Promise<number> {
  if (!isDbConfigured()) return 0;
  const rows = await withConnection(async (conn) => {
    const r = await conn.execute<{ N: number }>(
      `SELECT COUNT(*) AS n FROM cms_local_user WHERE tenant_id = :t`,
      { t: TENANT() },
    );
    return r.rows ?? [];
  });
  const row = rows[0] as any;
  return Number(row?.N ?? row?.[0] ?? 0);
}

export async function listLocalUsers(): Promise<LocalUser[]> {
  if (!isDbConfigured()) return [];
  const rows = await withConnection(async (conn) => {
    const r = await conn.execute(
      `SELECT email, display_name, active, created_by, created_at
         FROM cms_local_user WHERE tenant_id = :t ORDER BY email`,
      { t: TENANT() },
    );
    return r.rows ?? [];
  });
  return (rows as any[]).map((u) => ({
    email: u.EMAIL ?? u[0],
    displayName: u.DISPLAY_NAME ?? u[1] ?? null,
    active: (u.ACTIVE ?? u[2]) === 'Y',
    createdBy: u.CREATED_BY ?? u[3] ?? null,
    createdAt: u.CREATED_AT ? String(u.CREATED_AT) : null,
  }));
}

export async function upsertLocalUser(
  email: string,
  passwordHash: string,
  displayName: string | null,
  actor: string,
): Promise<void> {
  await withConnection(async (conn) => {
    await conn.execute(
      `MERGE INTO cms_local_user t
        USING (SELECT :t AS tenant_id, :e AS email FROM dual) s
           ON (t.tenant_id = s.tenant_id AND t.email = s.email)
       WHEN MATCHED THEN UPDATE SET
            password_hash = :h, display_name = :n, active = 'Y', updated_at = SYSTIMESTAMP
       WHEN NOT MATCHED THEN INSERT (tenant_id, email, display_name, password_hash, created_by)
            VALUES (s.tenant_id, s.email, :n, :h, :b)`,
      { t: TENANT(), e: email.toLowerCase(), h: passwordHash, n: displayName, b: actor },
      { autoCommit: true },
    );
  });
}

export async function setLocalUserActive(email: string, active: boolean): Promise<void> {
  await withConnection(async (conn) => {
    await conn.execute(
      `UPDATE cms_local_user SET active = :a, updated_at = SYSTIMESTAMP
        WHERE tenant_id = :t AND LOWER(email) = :e`,
      { t: TENANT(), e: email.toLowerCase(), a: active ? 'Y' : 'N' },
      { autoCommit: true },
    );
  });
}

export async function deleteLocalUser(email: string): Promise<void> {
  await withConnection(async (conn) => {
    await conn.execute(
      `DELETE FROM cms_local_user WHERE tenant_id = :t AND LOWER(email) = :e`,
      { t: TENANT(), e: email.toLowerCase() },
      { autoCommit: true },
    );
  });
}
