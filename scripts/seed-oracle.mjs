#!/usr/bin/env node
/**
 * Push data/content.json into Oracle as the live document.
 *
 *   npm run db:seed             # refuses if a document already exists
 *   npm run db:seed -- --force  # overwrites it (previous version is kept in history)
 *
 * Reads .env.local. Run db/schema.sql first.
 */
import fs from 'fs';
import path from 'path';
import oracledb from 'oracledb';

for (const f of ['.env.local', '.env']) {
  const p = path.resolve(f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const TENANT = process.env.CMS_TENANT_ID || 'hadya';
const DOC_ID = 'live';
const force = process.argv.includes('--force');

if (!process.env.DB_USER || !process.env.DB_CONNECT_STRING) {
  console.error('DB_USER / DB_CONNECT_STRING are not set. Nothing to do.');
  process.exit(1);
}

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsString = [oracledb.CLOB];
const walletDir = path.resolve(process.env.TNS_ADMIN || './wallet');

const doc = JSON.parse(fs.readFileSync(path.resolve('data/content.json'), 'utf8'));

const pool = await oracledb.createPool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING,
  configDir: walletDir,
  walletLocation: walletDir,
  walletPassword: process.env.DB_WALLET_PASSWORD,
  poolMin: 0, poolMax: 2,
});
const conn = await pool.getConnection();

try {
  const existing = await conn.execute(
    `SELECT version FROM cms_document WHERE tenant_id = :t AND doc_id = :d`,
    { t: TENANT, d: DOC_ID },
  );

  if (existing.rows.length && !force) {
    console.error(
      `A document already exists at version ${existing.rows[0].VERSION}.\n` +
      `Re-run with --force to overwrite it. The current version is copied to history first.`,
    );
    process.exit(2);
  }

  if (existing.rows.length) {
    await conn.execute(
      `INSERT INTO cms_document_history (tenant_id, doc_id, version, doc_json, saved_by)
       SELECT tenant_id, doc_id, version, doc_json, updated_by FROM cms_document
        WHERE tenant_id = :t AND doc_id = :d`,
      { t: TENANT, d: DOC_ID },
    );
    const v = Number(existing.rows[0].VERSION) + 1;
    await conn.execute(
      `UPDATE cms_document SET doc_json = :j, version = :v,
              updated_at = SYSTIMESTAMP, updated_by = 'script:seed'
        WHERE tenant_id = :t AND doc_id = :d`,
      { j: JSON.stringify({ ...doc, version: v }), v, t: TENANT, d: DOC_ID },
    );
    await conn.commit();
    console.log(`Overwrote the live document. Now at version ${v}.`);
  } else {
    await conn.execute(
      `INSERT INTO cms_document (tenant_id, doc_id, doc_json, version, updated_by)
       VALUES (:t, :d, :j, 1, 'script:seed')`,
      { t: TENANT, d: DOC_ID, j: JSON.stringify({ ...doc, version: 1 }) },
      { autoCommit: true },
    );
    console.log(`Seeded ${doc.pages.length} pages into ${TENANT}/${DOC_ID} at version 1.`);
  }
} finally {
  await conn.close();
  await pool.close(0);
}
