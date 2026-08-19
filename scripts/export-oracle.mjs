#!/usr/bin/env node
/**
 * Pull the live document out of Oracle into data/content.json.
 * Useful for backups, and for moving production content into local dev.
 *
 *   npm run db:export
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

if (!process.env.DB_USER || !process.env.DB_CONNECT_STRING) {
  console.error('DB_USER / DB_CONNECT_STRING are not set.');
  process.exit(1);
}

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsString = [oracledb.CLOB];
const walletDir = path.resolve(process.env.TNS_ADMIN || './wallet');

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
  const r = await conn.execute(
    `SELECT doc_json, version, updated_at, updated_by FROM cms_document
      WHERE tenant_id = :t AND doc_id = 'live'`,
    { t: process.env.CMS_TENANT_ID || 'hadya' },
  );
  if (!r.rows.length) { console.error('No live document found.'); process.exit(2); }

  const row = r.rows[0];
  const out = path.resolve('data/content.json');
  fs.writeFileSync(out, JSON.stringify(JSON.parse(row.DOC_JSON), null, 2), 'utf8');
  console.log(`Wrote version ${row.VERSION} to ${out}`);
  console.log(`Last saved ${row.UPDATED_AT} by ${row.UPDATED_BY || 'unknown'}`);
} finally {
  await conn.close();
  await pool.close(0);
}
