#!/usr/bin/env node
// node scripts/run-sql.mjs db/004-workflow-roles.sql
import fs from 'fs';
import path from 'path';
import oracledb from 'oracledb';

for (const f of ['.env.local', '.env']) {
  const p = path.resolve(f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('Usage: node scripts/run-sql.mjs <path-to-sql-file>');
  process.exit(1);
}
if (!process.env.DB_USER || !process.env.DB_CONNECT_STRING) {
  console.error('DB_USER / DB_CONNECT_STRING missing — check .env.local');
  process.exit(1);
}

const walletDir = path.resolve(process.env.TNS_ADMIN || './wallet');

const statements = fs.readFileSync(file, 'utf8')
  .split('\n')
  .map((l) => { const i = l.indexOf('--'); return i === -1 ? l : l.slice(0, i); })
  .join('\n')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

const conn = await oracledb.getConnection({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING,
  configDir: walletDir,
  walletLocation: walletDir,
  walletPassword: process.env.DB_WALLET_PASSWORD,
});

console.log(`\nRunning ${file} — ${statements.length} statement(s)\n`);
let ok = 0, skip = 0, fail = 0;

for (const sql of statements) {
  const head = sql.split('\n')[0].replace(/\s+/g, ' ').slice(0, 70);
  try {
    await conn.execute(sql);
    console.log('  OK   ' + head); ok++;
  } catch (e) {
    if (String(e.message).includes('ORA-00955')) {
      console.log('  SKIP ' + head + '  (already exists)'); skip++;
    } else {
      console.log('  FAIL ' + head);
      console.log('       ' + e.message.split('\n')[0]); fail++;
    }
  }
}

await conn.commit();
await conn.close();
console.log(`\nDone: ${ok} ok, ${skip} skipped, ${fail} failed.`);
process.exit(fail ? 1 : 0);