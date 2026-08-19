#!/usr/bin/env node
/**
 * Connection diagnostic. Run this BEFORE db:seed — it tells you which of the
 * six things that usually go wrong has gone wrong.
 *
 *   npm run db:test
 */
import fs from 'fs';
import path from 'path';
import oracledb from 'oracledb';

/* ---- load .env.local ---- */
for (const f of ['.env.local', '.env']) {
  const p = path.resolve(f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const warn = (m) => console.log(`  \x1b[33m!\x1b[0m ${m}`);

console.log('\nHadya CMS — Oracle connection check\n');

/* ---- 1. env ---- */
console.log('Environment');
let fatal = false;
for (const k of ['DB_USER', 'DB_PASSWORD', 'DB_CONNECT_STRING']) {
  if (process.env[k]) ok(`${k} is set`);
  else { bad(`${k} is MISSING`); fatal = true; }
}
const walletDir = path.resolve(process.env.TNS_ADMIN || './wallet');
ok(`TNS_ADMIN resolves to ${walletDir}`);

/* ---- 2. wallet files ---- */
console.log('\nWallet');
if (!fs.existsSync(walletDir)) {
  bad(`${walletDir} does not exist — unzip the wallet there`);
  fatal = true;
} else {
  for (const f of ['tnsnames.ora', 'sqlnet.ora', 'ewallet.pem']) {
    const p = path.join(walletDir, f);
    if (fs.existsSync(p)) ok(`${f} present`);
    else { bad(`${f} MISSING — thin mode needs it`); fatal = true; }
  }

  /* ---- 3. encrypted PEM needs a wallet password ---- */
  const pem = path.join(walletDir, 'ewallet.pem');
  if (fs.existsSync(pem)) {
    const encrypted = fs.readFileSync(pem, 'utf8').includes('ENCRYPTED PRIVATE KEY');
    if (encrypted && !process.env.DB_WALLET_PASSWORD) {
      bad('ewallet.pem is ENCRYPTED but DB_WALLET_PASSWORD is not set');
      console.log('      This is the most common cause of NJS-505 / DPY-6003.');
      console.log('      Use the password you typed when downloading the wallet.');
      fatal = true;
    } else if (encrypted) {
      ok('ewallet.pem is encrypted and DB_WALLET_PASSWORD is set');
    } else {
      ok('ewallet.pem is unencrypted — no wallet password needed');
    }
  }

  /* ---- 4. alias actually exists ---- */
  const tns = path.join(walletDir, 'tnsnames.ora');
  if (fs.existsSync(tns) && process.env.DB_CONNECT_STRING) {
    const body = fs.readFileSync(tns, 'utf8');
    const aliases = [...body.matchAll(/^([a-zA-Z0-9_]+)\s*=/gm)].map((m) => m[1].toLowerCase());
    const want = process.env.DB_CONNECT_STRING.toLowerCase();
    if (aliases.includes(want)) ok(`alias "${want}" found in tnsnames.ora`);
    else {
      bad(`alias "${want}" is NOT in tnsnames.ora`);
      console.log(`      Available: ${aliases.join(', ')}`);
      fatal = true;
    }
  }
}

if (fatal) {
  console.log('\nFix the items above, then run this again.\n');
  process.exit(1);
}

/* ---- 5. connect ---- */
console.log('\nConnection');
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsString = [oracledb.CLOB];

let pool, conn;
try {
  pool = await oracledb.createPool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
    configDir: walletDir,
    walletLocation: walletDir,
    walletPassword: process.env.DB_WALLET_PASSWORD,
    poolMin: 0, poolMax: 2,
  });
  conn = await pool.getConnection();
  ok('connected');

  const v = await conn.execute(`SELECT banner_full FROM v$version`);
  ok(String(v.rows[0].BANNER_FULL).split('\n')[0]);
  const u = await conn.execute(`SELECT USER u, SYS_CONTEXT('USERENV','DB_NAME') d FROM dual`);
  ok(`signed in as ${u.rows[0].U} on ${u.rows[0].D}`);

  /* ---- 6. schema ---- */
  console.log('\nSchema');
  const t = await conn.execute(
    `SELECT table_name FROM user_tables
      WHERE table_name IN ('CMS_DOCUMENT','CMS_DOCUMENT_HISTORY','CMS_ADMIN_AUDIT','CMS_FORM_SUBMISSION')`,
  );
  const found = t.rows.map((r) => r.TABLE_NAME);
  for (const name of ['CMS_DOCUMENT', 'CMS_DOCUMENT_HISTORY', 'CMS_ADMIN_AUDIT', 'CMS_FORM_SUBMISSION']) {
    if (found.includes(name)) ok(name);
    else warn(`${name} missing — run db/schema.sql (or db/002-form-submissions.sql)`);
  }

  if (found.includes('CMS_DOCUMENT')) {
    const d = await conn.execute(
      `SELECT tenant_id, version, updated_at, updated_by FROM cms_document`,
    );
    if (!d.rows.length) warn('no live document yet — run: npm run db:seed');
    else for (const r of d.rows) {
      ok(`document "${r.TENANT_ID}" at version ${r.VERSION}, last saved by ${r.UPDATED_BY || 'unknown'}`);
    }
  }

  console.log('\nAll good.\n');
} catch (e) {
  bad(e.message.split('\n')[0]);
  const m = String(e.message);
  console.log('');
  if (m.includes('ORA-01017')) {
    console.log('  ORA-01017 — wrong DB_USER or DB_PASSWORD.');
  } else if (m.includes('ORA-28000')) {
    console.log('  ORA-28000 — the account is locked. Unlock it in Database Actions.');
  } else if (m.includes('ORA-12506') || m.includes('ORA-12514')) {
    console.log('  The service alias is unknown or the database is stopped.');
    console.log('  Check the ADB is running, and try the _tp alias.');
  } else if (m.includes('NJS-505') || m.includes('DPY-6003') || m.includes('handshake')) {
    console.log('  TLS handshake failed. Almost always DB_WALLET_PASSWORD missing/wrong,');
    console.log('  or the wallet does not belong to this database.');
  } else if (m.includes('NJS-520') || m.includes('tnsnames')) {
    console.log('  tnsnames.ora was not found. Check TNS_ADMIN points at the wallet folder.');
  } else if (m.includes('ETIMEDOUT') || m.includes('ECONNREFUSED') || m.includes('ENOTFOUND')) {
    console.log('  Network blocked. Outbound TCP 1522 must be open, and if the ADB has');
    console.log('  an ACL or is private-endpoint-only, your IP must be allowed.');
  } else {
    console.log('  Full error:\n');
    console.log(e);
  }
  console.log('');
  process.exitCode = 1;
} finally {
  if (conn) await conn.close();
  if (pool) await pool.close(0);
}
