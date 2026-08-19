#!/usr/bin/env node
/**
 * npm run setup
 *
 * Creates .env.local from .env.example (Next.js reads .env.local — it never
 * reads .env.example), generates NEXTAUTH_SECRET, and then tells you which
 * values are still blank and where in the Azure / OCI portals to find them.
 *
 * Safe to re-run: an existing .env.local is never overwritten, only reported on.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, '.env.local');
const TEMPLATE = path.join(ROOT, '.env.example');

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

console.log('\nHadya CMS — environment setup\n');

if (!fs.existsSync(TEMPLATE)) {
  console.log(red(`  .env.example is missing from ${ROOT}`));
  console.log('  Are you running this from inside the project folder?\n');
  process.exit(1);
}

let created = false;
if (fs.existsSync(TARGET)) {
  console.log(`  ${yellow('!')} .env.local already exists — leaving it alone.`);
} else {
  let body = fs.readFileSync(TEMPLATE, 'utf8');
  const secret = crypto.randomBytes(32).toString('base64');
  body = body.replace(/^NEXTAUTH_SECRET=.*$/m, `NEXTAUTH_SECRET=${secret}`);
  fs.writeFileSync(TARGET, body, 'utf8');
  created = true;
  console.log(`  ${green('✓')} created .env.local`);
  console.log(`  ${green('✓')} generated NEXTAUTH_SECRET`);
}

/* ---- what is still blank? ---- */
const env = {};
for (const line of fs.readFileSync(TARGET, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const GROUPS = [
  {
    title: 'Microsoft Entra ID sign-in',
    keys: ['AZURE_AD_CLIENT_ID', 'AZURE_AD_TENANT_ID', 'AZURE_AD_CLIENT_SECRET'],
    where: [
      'entra.microsoft.com > App registrations > your app',
      '  Overview           -> Application (client) ID, Directory (tenant) ID',
      '  Certificates & secrets > New client secret -> copy the VALUE column',
      '',
      `  Register this Redirect URI (platform: Web):`,
      `    ${(env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')}/api/auth/callback/azure-ad`,
    ],
  },
  {
    title: 'Oracle Autonomous Database',
    keys: ['DB_USER', 'DB_PASSWORD', 'DB_CONNECT_STRING', 'DB_WALLET_PASSWORD'],
    where: [
      'DB_USER / DB_PASSWORD  -> the schema user you created in Database Actions',
      'DB_CONNECT_STRING      -> an alias from wallet/tnsnames.ora (use the _tp one)',
      'DB_WALLET_PASSWORD     -> the password from the OCI "Download wallet" dialog',
      dim('                          (this is NOT the same as DB_PASSWORD)'),
    ],
  },
  {
    title: 'Dynamics 365 lead push (optional)',
    keys: ['DYNAMICS_URL'],
    where: [
      'Power Platform admin center > Environments > your environment > Environment URL',
      'Then set DYNAMICS_ENABLED=true. See docs/DYNAMICS365.md — the app also',
      'needs an Application User inside Dynamics or every call returns 401.',
    ],
  },
];

let blanks = 0;
for (const g of GROUPS) {
  const empty = g.keys.filter((k) => !env[k]);
  if (!empty.length) {
    console.log(`\n  ${green('✓')} ${g.title} — all set`);
    continue;
  }
  blanks += empty.length;
  console.log(`\n  ${yellow('!')} ${g.title} — still blank: ${empty.join(', ')}`);
  for (const line of g.where) console.log(`      ${line}`);
}

/* ---- wallet sanity ---- */
const walletDir = path.resolve(env.TNS_ADMIN || './wallet');
console.log('');
if (!fs.existsSync(walletDir)) {
  console.log(`  ${yellow('!')} No wallet folder at ${walletDir}`);
  console.log('      Download the wallet from OCI and unzip it there (files directly inside,');
  console.log('      not in a nested subfolder).');
} else {
  const pem = path.join(walletDir, 'ewallet.pem');
  if (fs.existsSync(pem)) {
    const encrypted = fs.readFileSync(pem, 'utf8').includes('ENCRYPTED PRIVATE KEY');
    if (encrypted && !env.DB_WALLET_PASSWORD) {
      console.log(`  ${red('✗')} wallet/ewallet.pem is encrypted and DB_WALLET_PASSWORD is blank.`);
      console.log('      Without it every connection fails with NJS-505 "bad decrypt".');
    } else if (encrypted) {
      console.log(`  ${green('✓')} encrypted wallet with a wallet password set`);
    } else {
      console.log(`  ${green('✓')} unencrypted wallet — no wallet password needed`);
    }
  }
}

console.log('\nNext steps');
console.log('  1. Open .env.local and fill in the blanks above.');
if (blanks) console.log('  2. npm run doctor        (checks SSO + database config offline)');
else console.log('  2. npm run doctor        (checks SSO + database config offline)');
console.log('  3. npm run db:test       (actually connects to Oracle)');
console.log('  4. Run db/schema.sql once, then npm run db:seed');
console.log('  5. npm run dev           and open http://localhost:3000/admin');
console.log(
  created
    ? '\nNote: changes to .env.local only take effect after restarting npm run dev.\n'
    : '\n',
);
