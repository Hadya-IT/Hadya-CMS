import 'server-only';
import { dynamicsState } from './env';

/* ------------------------------------------------------------------
   Microsoft Dynamics 365 (Dataverse) — lead creation.

   This is NOT single sign-on. Two different things share the word
   "Entra" and it is worth being precise about which is which:

     SSO        a HUMAN signs in to this portal with their Microsoft
                account. Authorization Code flow, handled by lib/auth.ts.
     Dynamics   this SERVER talks to Dynamics with no human present.
                Client Credentials flow, handled here. Dynamics also
                needs an Application User created for the app inside the
                Power Platform admin center, or every call returns 401
                even with a perfectly valid token.

   See docs/DYNAMICS365.md for the portal steps.
-------------------------------------------------------------------*/

const API_VERSION = 'v9.2';

type TokenCache = { token: string; expiresAt: number };
let cache: TokenCache | null = null;

function creds() {
  const url = (process.env.DYNAMICS_URL || '').replace(/\/+$/, '');
  return {
    url,
    clientId: process.env.DYNAMICS_CLIENT_ID || process.env.AZURE_AD_CLIENT_ID || '',
    clientSecret:
      process.env.DYNAMICS_CLIENT_SECRET || process.env.AZURE_AD_CLIENT_SECRET || '',
    tenantId: process.env.DYNAMICS_TENANT_ID || process.env.AZURE_AD_TENANT_ID || '',
  };
}

export function dynamicsEnabled(): boolean {
  return dynamicsState().configured;
}

/** Client-credentials access token for Dataverse, cached until it expires. */
async function getToken(): Promise<string> {
  if (cache && cache.expiresAt > Date.now() + 60_000) return cache.token;

  const { url, clientId, clientSecret, tenantId } = creds();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
    // The resource is the Dataverse environment itself, not Graph.
    scope: `${url}/.default`,
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    },
  );

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !json.access_token) {
    throw new Error(
      `Entra token request failed (${res.status}): ${
        json.error_description?.split('\n')[0] || json.error || 'no access_token returned'
      }`,
    );
  }

  cache = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cache.token;
}

async function dataverse(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown; entityId?: string }> {
  const { url } = creds();
  const token = await getToken();

  const res = await fetch(`${url}/api/data/${API_VERSION}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=utf-8',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const message =
      (body as { error?: { message?: string } })?.error?.message ||
      (typeof body === 'string' ? body.slice(0, 300) : '') ||
      res.statusText;
    throw new Error(`Dataverse ${res.status}: ${message}`);
  }

  // Dataverse returns the new record's id in the OData-EntityId header.
  const loc = res.headers.get('OData-EntityId') || '';
  const entityId = loc.match(/\(([0-9a-fA-F-]{36})\)/)?.[1];

  return { status: res.status, body, entityId };
}

/** Connectivity check. Returns the org and user the app is acting as. */
export async function whoAmI(): Promise<{
  ok: boolean;
  detail: string;
}> {
  const state = dynamicsState();
  if (!state.configured) return { ok: false, detail: state.detail };
  try {
    const { body } = await dataverse('WhoAmI');
    const b = body as { UserId?: string; OrganizationId?: string };
    return {
      ok: true,
      detail: `Connected as application user ${b.UserId} in org ${b.OrganizationId}`,
    };
  } catch (e) {
    return { ok: false, detail: (e as Error).message };
  }
}

export type LeadInput = {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message?: string;
  company?: string;
  pageUrl?: string;
};

/** Creates a lead in Dynamics. Returns its GUID. */
export async function createLead(input: LeadInput): Promise<string> {
  const [firstname, ...rest] = input.name.trim().split(/\s+/);

  const payload: Record<string, unknown> = {
    subject: (input.subject || `Website enquiry from ${input.name}`).slice(0, 300),
    firstname: firstname?.slice(0, 50) || input.name.slice(0, 50),
    lastname: (rest.join(' ') || firstname || 'Unknown').slice(0, 50),
    emailaddress1: input.email.slice(0, 100),
    // 4 = Web on the out-of-the-box leadsourcecode option set.
    leadsourcecode: 4,
  };
  if (input.phone) payload.telephone1 = input.phone.slice(0, 50);
  if (input.company) payload.companyname = input.company.slice(0, 100);

  const description = [input.message, input.pageUrl && `Submitted from: ${input.pageUrl}`]
    .filter(Boolean)
    .join('\n\n');
  if (description) payload.description = description.slice(0, 4000);

  const { entityId } = await dataverse('leads', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!entityId) throw new Error('Dynamics accepted the lead but returned no id.');
  return entityId;
}
