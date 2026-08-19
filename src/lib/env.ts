import 'server-only';

/* ------------------------------------------------------------------
   One place that answers "is this feature configured, and if not, why".

   Every subsystem (SSO, database, Dynamics, media) is optional and
   degrades to a working default. The cost of that flexibility is that a
   half-filled .env.local looks identical to no .env.local at all — so
   this module turns "it isn't working" into a specific sentence, and
   /api/health surfaces those sentences in the portal.
-------------------------------------------------------------------*/

import fs from 'fs';
import path from 'path';

export type FeatureState = {
  configured: boolean;
  /** Human-readable reason it is not configured, or how it is configured. */
  detail: string;
  /** Variables that are required but empty. */
  missing: string[];
};

const s = (k: string): string => (process.env[k] || '').trim();
const has = (k: string): boolean => s(k).length > 0;

function report(required: string[]): string[] {
  return required.filter((k) => !has(k));
}

/* ---------------------------- SSO ---------------------------- */

export function ssoState(): FeatureState {
  const missing = report(['AZURE_AD_CLIENT_ID', 'AZURE_AD_TENANT_ID', 'AZURE_AD_CLIENT_SECRET']);
  if (missing.length) {
    return {
      configured: false,
      detail: `Microsoft sign-in is off because ${missing.join(', ')} ${
        missing.length === 1 ? 'is' : 'are'
      } empty in .env.local.`,
      missing,
    };
  }
  if (!has('NEXTAUTH_SECRET')) {
    return {
      configured: false,
      detail: 'NEXTAUTH_SECRET is empty. Sessions cannot be signed without it. Run: npm run setup',
      missing: ['NEXTAUTH_SECRET'],
    };
  }
  return {
    configured: true,
    detail: `Entra tenant ${s('AZURE_AD_TENANT_ID')}, redirect ${
      s('NEXTAUTH_URL') || 'http://localhost:3000'
    }/api/auth/callback/azure-ad`,
    missing: [],
  };
}

/* -------------------------- Database ------------------------- */

export function walletDir(): string {
  return path.resolve(s('TNS_ADMIN') || './wallet');
}

/** Reads the wallet folder to catch the two mistakes that cause 90% of
 *  Oracle connection failures: a missing wallet password, and a connect
 *  string that is not one of the aliases in tnsnames.ora. */
export function dbState(): FeatureState {
  const missing = report(['DB_USER', 'DB_PASSWORD', 'DB_CONNECT_STRING']);
  if (missing.length) {
    return {
      configured: false,
      detail: `Content is stored in data/content.json because ${missing.join(
        ', ',
      )} ${missing.length === 1 ? 'is' : 'are'} empty in .env.local.`,
      missing,
    };
  }

  const dir = walletDir();
  if (!fs.existsSync(dir)) {
    return {
      configured: false,
      detail: `Wallet folder not found at ${dir}. Unzip the Oracle wallet there, or point TNS_ADMIN at it.`,
      missing: ['TNS_ADMIN'],
    };
  }

  for (const f of ['tnsnames.ora', 'ewallet.pem']) {
    if (!fs.existsSync(path.join(dir, f))) {
      return {
        configured: false,
        detail: `${f} is missing from ${dir}. Thin-mode mTLS needs it — re-download the wallet from OCI.`,
        missing: [],
      };
    }
  }

  const pem = fs.readFileSync(path.join(dir, 'ewallet.pem'), 'utf8');
  if (pem.includes('ENCRYPTED PRIVATE KEY') && !has('DB_WALLET_PASSWORD')) {
    return {
      configured: false,
      detail:
        'wallet/ewallet.pem is encrypted but DB_WALLET_PASSWORD is empty. Use the password you typed in the OCI "Download wallet" dialog — not DB_PASSWORD.',
      missing: ['DB_WALLET_PASSWORD'],
    };
  }

  const tns = fs.readFileSync(path.join(dir, 'tnsnames.ora'), 'utf8');
  const aliases = [...tns.matchAll(/^([a-zA-Z0-9_]+)\s*=/gm)].map((m) => m[1].toLowerCase());
  const want = s('DB_CONNECT_STRING').toLowerCase();
  if (aliases.length && !aliases.includes(want)) {
    return {
      configured: false,
      detail: `DB_CONNECT_STRING "${want}" is not an alias in tnsnames.ora. Available: ${aliases.join(', ')}.`,
      missing: ['DB_CONNECT_STRING'],
    };
  }

  return { configured: true, detail: `Oracle alias ${want}, user ${s('DB_USER')}`, missing: [] };
}

/* ------------------------- Dynamics 365 ---------------------- */

export function dynamicsState(): FeatureState {
  if (s('DYNAMICS_ENABLED') !== 'true') {
    return {
      configured: false,
      detail: 'Dynamics push is off (DYNAMICS_ENABLED is not "true"). Leads are still saved here.',
      missing: [],
    };
  }
  const missing: string[] = [];
  if (!has('DYNAMICS_URL')) missing.push('DYNAMICS_URL');
  // Falls back to the SSO app registration when the Dynamics-specific
  // credentials are left blank.
  const id = s('DYNAMICS_CLIENT_ID') || s('AZURE_AD_CLIENT_ID');
  const secret = s('DYNAMICS_CLIENT_SECRET') || s('AZURE_AD_CLIENT_SECRET');
  const tenant = s('DYNAMICS_TENANT_ID') || s('AZURE_AD_TENANT_ID');
  if (!id) missing.push('DYNAMICS_CLIENT_ID');
  if (!secret) missing.push('DYNAMICS_CLIENT_SECRET');
  if (!tenant) missing.push('DYNAMICS_TENANT_ID');

  if (missing.length) {
    return {
      configured: false,
      detail: `Dynamics push is on but ${missing.join(', ')} ${
        missing.length === 1 ? 'is' : 'are'
      } empty.`,
      missing,
    };
  }
  return { configured: true, detail: `Dataverse ${s('DYNAMICS_URL')}`, missing: [] };
}

/* ---------------------------- Email --------------------------- */

/** Outbound mail via Microsoft Graph. Falls back to the SSO app
 *  registration when the mail-specific credentials are blank, the same way
 *  Dynamics does — one Entra app can legitimately do all three jobs. */
export function mailState(): FeatureState {
  if (!has('MAIL_FROM')) {
    return {
      configured: false,
      detail:
        'Form notifications are off because MAIL_FROM is empty. Set it to the shared mailbox ' +
        'that should send them, e.g. website@hadya.com.',
      missing: ['MAIL_FROM'],
    };
  }

  const from = s('MAIL_FROM');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(from)) {
    return {
      configured: false,
      detail: `MAIL_FROM ("${from}") is not a valid email address.`,
      missing: ['MAIL_FROM'],
    };
  }

  const missing: string[] = [];
  if (!s('MAIL_CLIENT_ID') && !s('AZURE_AD_CLIENT_ID')) missing.push('MAIL_CLIENT_ID');
  if (!s('MAIL_CLIENT_SECRET') && !s('AZURE_AD_CLIENT_SECRET')) missing.push('MAIL_CLIENT_SECRET');
  if (!s('MAIL_TENANT_ID') && !s('AZURE_AD_TENANT_ID')) missing.push('MAIL_TENANT_ID');

  if (missing.length) {
    return {
      configured: false,
      detail: `MAIL_FROM is set but ${missing.join(', ')} ${
        missing.length === 1 ? 'is' : 'are'
      } empty, and there is no AZURE_AD_* credential to borrow.`,
      missing,
    };
  }

  return {
    configured: true,
    detail: `Microsoft Graph, sending as ${from}`,
    missing: [],
  };
}

/* --------------------------- Media --------------------------- */

export function mediaState(): FeatureState {
  if (!has('OCI_NAMESPACE') || !has('OCI_BUCKET')) {
    return {
      configured: false,
      detail:
        'Uploads are written to public/uploads on this server. That directory does not ' +
        'survive a redeploy on most hosts.',
      missing: [],
    };
  }
  return {
    configured: true,
    detail: `OCI Object Storage bucket ${s('OCI_BUCKET')}`,
    missing: [],
  };
}

/** True when no .env.local (or .env) exists at all — the single most
 *  common reason "nothing works". */
export function envFileMissing(): boolean {
  return !fs.existsSync(path.resolve('.env.local')) && !fs.existsSync(path.resolve('.env'));
}
