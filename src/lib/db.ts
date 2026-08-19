import 'server-only';
import oracledb from 'oracledb';
import { dbState, walletDir } from './env';

/* ------------------------------------------------------------------
   Oracle Autonomous Database - thin-mode mTLS through the downloaded
   wallet. Thin mode needs no Oracle Instant Client: it reads
   tnsnames.ora / sqlnet.ora from configDir and ewallet.pem from
   walletLocation, so the whole wallet folder ships with the app (and
   never reaches source control - see .gitignore).

   One pool for the process, reused across dev hot-reloads. Without that,
   every file save leaks a pool and you eventually exhaust the database's
   session limit.
-------------------------------------------------------------------*/

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsString = [oracledb.CLOB]; // CLOBs arrive as strings, not streams

declare global {
  // eslint-disable-next-line no-var
  var _hadyaOraclePool: oracledb.Pool | undefined;
}

/** True when the database is fully configured. When false the app falls
 *  back to data/content.json rather than failing. */
export function isDbConfigured(): boolean {
  return dbState().configured;
}

/** Why the database is not being used, in one sentence. */
export function dbStatusDetail(): string {
  return dbState().detail;
}

export async function getPool(): Promise<oracledb.Pool> {
  if (global._hadyaOraclePool) return global._hadyaOraclePool;

  const state = dbState();
  if (!state.configured) {
    // Fail with the actual reason instead of an Oracle error code that
    // sends you looking in the wrong place.
    throw new Error('Database not configured: ' + state.detail);
  }

  const dir = walletDir();
  global._hadyaOraclePool = await oracledb.createPool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
    configDir: dir,
    walletLocation: dir,
    walletPassword: process.env.DB_WALLET_PASSWORD,
    poolMin: 0,
    poolMax: 10,
    poolIncrement: 1,
    poolTimeout: 60,
    queueTimeout: 15000, // do not let a stalled DB hang the request forever
  });
  return global._hadyaOraclePool;
}

export async function withConnection<T>(
  fn: (conn: oracledb.Connection) => Promise<T>,
): Promise<T> {
  const conn = await (await getPool()).getConnection();
  try {
    return await fn(conn);
  } finally {
    await conn.close();
  }
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: oracledb.BindParameters = {},
): Promise<T[]> {
  return withConnection(async (conn) => {
    const r = await conn.execute<T>(sql, params);
    return (r.rows as T[]) ?? [];
  });
}

/** Round-trip test used by /api/health and the diagnostics page. */
export async function dbPing(): Promise<{
  ok: boolean;
  detail: string;
  tables?: string[];
}> {
  const state = dbState();
  if (!state.configured) return { ok: false, detail: state.detail };
  try {
    return await withConnection(async (conn) => {
      const u = await conn.execute<{ U: string; D: string }>(
        `SELECT USER u, SYS_CONTEXT('USERENV','DB_NAME') d FROM dual`,
      );
      const t = await conn.execute<{ TABLE_NAME: string }>(
        `SELECT table_name FROM user_tables
          WHERE table_name IN ('CMS_DOCUMENT','CMS_DOCUMENT_HISTORY',
                               'CMS_ADMIN_AUDIT','CMS_FORM_SUBMISSION')`,
      );
      return {
        ok: true,
        detail: `Connected as ${u.rows?.[0]?.U} on ${u.rows?.[0]?.D}`,
        tables: (t.rows ?? []).map((r) => r.TABLE_NAME),
      };
    });
  } catch (e) {
    return { ok: false, detail: (e as Error).message.split('\n')[0] };
  }
}

/** Fire-and-forget audit row. Never allowed to break the caller. */
export async function audit(
  action: string,
  actor?: string | null,
  detail?: string,
): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    await withConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO cms_admin_audit (tenant_id, actor, action, detail)
         VALUES (:t, :a, :ac, :d)`,
        {
          t: process.env.CMS_TENANT_ID || 'hadya',
          a: actor || null,
          ac: action,
          d: detail ? detail.slice(0, 1000) : null,
        },
        { autoCommit: true },
      );
    });
  } catch (e) {
    console.error('audit write failed (ignored):', (e as Error).message);
  }
}

/** Called on shutdown; also useful from scripts. */
export async function closePool(): Promise<void> {
  if (!global._hadyaOraclePool) return;
  await global._hadyaOraclePool.close(5);
  global._hadyaOraclePool = undefined;
}
