#!/usr/bin/env node
/**
 * npm run doctor
 *
 * Checks everything that can be checked without a network call: whether the
 * app will even see your configuration, whether SSO is complete and
 * self-consistent, and whether the Entra redirect URI you must register
 * matches NEXTAUTH_URL. Run this before blaming Azure.
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const ok = (m) => console.log(`  ${green('✓')} ${m}`);
const bad = (m) => console.log(`  ${red('✗')} ${m}`);
const warn = (m) => console.log(`  ${yellow('!')} ${m}`);

let failures = 0;
const fail = (m) => {
  failures++;
  bad(m);
};

console.log('\nHadya CMS — configuration doctor\n');

/* ---------- 1. does the app see any config at all? ---------- */
console.log('Environment file');
const localPath = path.resolve('.env.local');
const plainPath = path.resolve('.env');

if (!fs.existsSync(localPath) && !fs.existsSync(plainPath)) {
  fail('Neither .env.local nor .env exists — the app is running with NO configuration.');
  console.log('      Next.js does not read .env.example. Run: npm run setup');
  console.log('');
  process.exit(1);
}
ok(`${fs.existsSync(localPath) ? '.env.local' : '.env'} found`);

if (fs.existsSync(path.resolve('.env.example'))) {
  const ex = fs.readFileSync(path.resolve('.env.example'), 'utf8');
  const suspicious = [...ex.matchAll(/^(AZURE_AD_CLIENT_SECRET|DB_PASSWORD|DB_WALLET_PASSWORD)=(.+)$/gm)]
    .filter(([, , v]) => v.trim().length > 0)
    .map(([, k]) => k);
  if (suspicious.length) {
    warn(`.env.example contains real-looking values for ${suspicious.join(', ')}.`);
    console.log('      That file is committed to git. Move secrets to .env.local and rotate them.');
  }
}

/* ---------- load env ---------- */
const env = { ...process.env };
for (const f of ['.env.local', '.env']) {
  const p = path.resolve(f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const has = (k) => Boolean((env[k] || '').trim());

/* ---------- 2. session signing ---------- */
console.log('\nSession');
if (!has('NEXTAUTH_SECRET')) {
  fail('NEXTAUTH_SECRET is empty — sessions cannot be signed and sign-in will fail.');
  console.log('      Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"');
} else if ((env.NEXTAUTH_SECRET || '').length < 32) {
  warn('NEXTAUTH_SECRET is shorter than 32 characters. Use a 32-byte random value.');
} else {
  ok('NEXTAUTH_SECRET set');
}

const base = (env.NEXTAUTH_URL || '').replace(/\/+$/, '');
if (!base) {
  fail('NEXTAUTH_URL is empty. Set it to the origin you browse to, e.g. http://localhost:3000');
} else if (base.endsWith('/admin') || base.includes('/api')) {
  fail(`NEXTAUTH_URL should be the origin only, not a path. Got: ${base}`);
} else {
  ok(`NEXTAUTH_URL = ${base}`);
}

/* ---------- 3. SSO ---------- */
console.log('\nMicrosoft Entra ID SSO');
const ssoKeys = ['AZURE_AD_CLIENT_ID', 'AZURE_AD_TENANT_ID', 'AZURE_AD_CLIENT_SECRET'];
const ssoMissing = ssoKeys.filter((k) => !has(k));

if (ssoMissing.length === ssoKeys.length) {
  warn('SSO is not configured — the portal will offer the local password instead.');
} else if (ssoMissing.length) {
  fail(`SSO is half-configured. Missing: ${ssoMissing.join(', ')}`);
} else {
  ok('client id, tenant id and secret are all present');

  const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!guid.test(env.AZURE_AD_CLIENT_ID)) {
    fail('AZURE_AD_CLIENT_ID is not a GUID. Copy "Application (client) ID" from the Overview page.');
  } else ok('client id looks like a GUID');

  if (!guid.test(env.AZURE_AD_TENANT_ID) && !/^(common|organizations)$/.test(env.AZURE_AD_TENANT_ID)) {
    fail('AZURE_AD_TENANT_ID is not a GUID. Copy "Directory (tenant) ID" from the Overview page.');
  } else ok('tenant id looks valid');

  // Entra secret VALUES start with a short prefix then a tilde; Secret IDs are GUIDs.
  if (guid.test(env.AZURE_AD_CLIENT_SECRET)) {
    fail('AZURE_AD_CLIENT_SECRET looks like the Secret ID, not the secret VALUE.');
    console.log('      In Certificates & secrets, copy the "Value" column — it is only shown once.');
  } else ok('client secret does not look like a Secret ID');

  console.log('');
  console.log(`  Register this exact Redirect URI in Entra (platform: Web):`);
  console.log(`      ${green(`${base || 'http://localhost:3000'}/api/auth/callback/azure-ad`)}`);
  console.log(`  A mismatch here is what produces AADSTS50011 / "OAuthCallback" errors.`);
}

if (has('ENABLE_LOCAL_LOGIN') && env.ENABLE_LOCAL_LOGIN === 'true' && !ssoMissing.length) {
  warn('ENABLE_LOCAL_LOGIN=true while SSO is configured — the password door stays open.');
  console.log('      Set it to false before deploying.');
}

/* ---------- 4. roles ---------- */
console.log('\nRoles');
ok(`Admin app role value(s): ${env.ENTRA_ADMIN_ROLES || 'Admin'}`);
ok(`Editor app role value(s): ${env.ENTRA_EDITOR_ROLES || 'Editor'}`);
if (env.REQUIRE_ENTRA_ROLE === 'true') {
  ok('REQUIRE_ENTRA_ROLE=true — users without an assigned app role are refused');
} else {
  warn(
    `REQUIRE_ENTRA_ROLE is not true — anyone in an allowed domain gets ${
      env.DEFAULT_ROLE === 'ADMIN' ? 'ADMIN' : 'EDITOR'
    }.`,
  );
  console.log('      Set it to true once you have assigned the app roles in Entra.');
}
if (!has('ADMIN_ALLOWED_DOMAINS')) {
  warn('ADMIN_ALLOWED_DOMAINS is empty — any Microsoft account in the tenant may sign in.');
} else {
  ok(`domain allowlist: ${env.ADMIN_ALLOWED_DOMAINS}`);
}

/* ---------- 5. database ---------- */
console.log('\nOracle database');
const dbKeys = ['DB_USER', 'DB_PASSWORD', 'DB_CONNECT_STRING'];
const dbMissing = dbKeys.filter((k) => !has(k));
if (dbMissing.length === dbKeys.length) {
  warn('Database not configured — content will be stored in data/content.json.');
} else if (dbMissing.length) {
  fail(`Database is half-configured. Missing: ${dbMissing.join(', ')}`);
} else {
  const walletDir = path.resolve(env.TNS_ADMIN || './wallet');
  if (!fs.existsSync(walletDir)) {
    fail(`wallet folder not found at ${walletDir}`);
  } else {
    for (const f of ['tnsnames.ora', 'sqlnet.ora', 'ewallet.pem']) {
      if (fs.existsSync(path.join(walletDir, f))) ok(`${f} present`);
      else fail(`${f} missing from ${walletDir}`);
    }
    const pemPath = path.join(walletDir, 'ewallet.pem');
    if (fs.existsSync(pemPath)) {
      const encrypted = fs.readFileSync(pemPath, 'utf8').includes('ENCRYPTED PRIVATE KEY');
      if (encrypted && !has('DB_WALLET_PASSWORD')) {
        fail('ewallet.pem is ENCRYPTED but DB_WALLET_PASSWORD is empty.');
        console.log('      This is the #1 cause of NJS-505 "bad decrypt". Use the wallet');
        console.log('      download password, not the database user password.');
      } else if (encrypted) ok('encrypted wallet + DB_WALLET_PASSWORD set');
      else ok('unencrypted wallet');
    }
    const tnsPath = path.join(walletDir, 'tnsnames.ora');
    if (fs.existsSync(tnsPath)) {
      const aliases = [...fs.readFileSync(tnsPath, 'utf8').matchAll(/^([a-zA-Z0-9_]+)\s*=/gm)].map(
        (m) => m[1].toLowerCase(),
      );
      const want = (env.DB_CONNECT_STRING || '').toLowerCase();
      if (aliases.includes(want)) ok(`alias "${want}" exists`);
      else {
        fail(`DB_CONNECT_STRING "${want}" is not in tnsnames.ora`);
        console.log(`      Available: ${aliases.join(', ')}`);
      }
    }
  }
}

/* ---------- 6. dynamics ---------- */
console.log('\nDynamics 365');
if (env.DYNAMICS_ENABLED !== 'true') {
  warn('DYNAMICS_ENABLED is not "true" — leads are stored locally only.');
} else {
  if (!has('DYNAMICS_URL')) fail('DYNAMICS_URL is empty.');
  else if (!/^https:\/\/[^/]+\.crm\d*\.dynamics\.com$/.test(env.DYNAMICS_URL.replace(/\/+$/, ''))) {
    warn(`DYNAMICS_URL "${env.DYNAMICS_URL}" is not the usual https://org.crm4.dynamics.com shape.`);
  } else ok(`Dataverse URL ${env.DYNAMICS_URL}`);

  const usingSsoApp = !has('DYNAMICS_CLIENT_ID');
  if (usingSsoApp) {
    ok('reusing the SSO app registration for Dataverse');
    console.log('      That app still needs an Application User inside Dynamics.');
  } else ok('dedicated Dynamics app registration');
}

/* ---------- 7. email notifications ---------- */
console.log('\nForm notification email');
if (!has('MAIL_FROM')) {
  warn('MAIL_FROM is empty — submissions are stored but nobody is emailed.');
} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(env.MAIL_FROM.trim())) {
  fail(`MAIL_FROM "${env.MAIL_FROM}" is not a valid email address.`);
} else {
  ok(`sending as ${env.MAIL_FROM.trim()}`);
  if (!has('MAIL_CLIENT_ID') && !has('AZURE_AD_CLIENT_ID')) {
    fail('MAIL_FROM is set but there is no MAIL_CLIENT_ID and no AZURE_AD_CLIENT_ID to borrow.');
  } else if (!has('MAIL_CLIENT_ID')) {
    ok('reusing the SSO app registration for Graph');
    console.log('      That app needs the APPLICATION permission Mail.Send with admin consent.');
    console.log('      Scope it to one mailbox with an Application Access Policy — docs/EMAIL.md.');
  } else {
    ok('dedicated mail app registration');
  }
}

/* ---------- 8. SEO + deployment shape ---------- */
console.log('\nSEO and deployment');
if (!has('SITE_URL')) {
  warn('SITE_URL is empty — robots.txt will disallow ALL crawling.');
  console.log('      That is correct for local and staging. Set it in production.');
} else {
  const site = env.SITE_URL.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(site)) {
    fail(`SITE_URL "${site}" must start with http:// or https://`);
  } else if (/localhost|127\.0\.0\.1/.test(site)) {
    warn(`SITE_URL is ${site} — the sitemap would advertise localhost URLs.`);
  } else {
    ok(`public origin ${site} — sitemap at ${site}/sitemap.xml`);
  }
}

const hops = (env.TRUSTED_PROXY_HOPS ?? '1').trim();
if (!/^\d+$/.test(hops)) {
  warn(`TRUSTED_PROXY_HOPS "${hops}" is not a number — defaulting to 1.`);
} else if (Number(hops) === 0) {
  ok('TRUSTED_PROXY_HOPS=0 — treating the app as directly exposed');
} else {
  ok(`TRUSTED_PROXY_HOPS=${hops} — form rate limiting trusts ${hops} proxy hop(s)`);
}

/* ---------- 9. image optimisation ---------- */
console.log('\nImage optimisation');
/* resolve() is not enough: sharp ships a platform-specific binary, so the
   package can be present while the binary for THIS os/arch is missing —
   which is exactly what happens after copying node_modules between a
   Windows machine and a Linux container. Actually loading it is the only
   check that tells the truth. */
try {
  const req = createRequire(import.meta.url);
  const sharp = req('sharp');
  ok(`sharp ${sharp.versions?.sharp || ''} loaded — uploads are resized to WebP`);
} catch (e) {
  warn('sharp did not load — uploads will be stored unoptimised.');
  console.log('      ' + String(e.message).split('\n')[0]);
  console.log('      Fix with: npm install --include=optional sharp');
}

/* ---------- verdict ---------- */
console.log('');
if (failures) {
  console.log(red(`${failures} problem${failures === 1 ? '' : 's'} found. Fix the ✗ lines above.`));
  console.log('Then run: npm run doctor && npm run db:test\n');
  process.exit(1);
}
console.log(green('No blocking problems found.'));
console.log('Next: npm run db:test (real connection), then npm run dev\n');
