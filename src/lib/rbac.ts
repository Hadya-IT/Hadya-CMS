import 'server-only';
import { NextResponse } from 'next/server';
import { currentAdmin, type AdminIdentity } from './auth';
import { can, type Capability, type CmsRole, ROLE_LABELS } from './permissions';

/* ------------------------------------------------------------------
   Middleware and hidden buttons are cosmetic — anyone can type a URL or
   call an API with curl. This is where access is actually decided, and
   every route that reads or writes content calls it first.

   v3 change: rank comparison is gone. Routes ask for the capability
   they need; the matrix in lib/permissions.ts decides.
-------------------------------------------------------------------*/

export type Guard =
  | { ok: true; admin: AdminIdentity; response?: undefined }
  | { ok: false; admin?: undefined; response: NextResponse };

export async function requireCapability(cap: Capability): Promise<Guard> {
  const admin = await currentAdmin();

  if (!admin) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 }),
    };
  }

  if (!can(admin.role, cap)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `Your role (${ROLE_LABELS[admin.role]}) cannot do this. Ask a Marketing Admin if you need access.`,
          role: admin.role,
          capability: cap,
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true, admin };
}

/* Back-compat shims for existing routes. Old requireEditor call sites
   guard MUTATIONS (media upload/delete, forms save), so the shim must
   demand editContent — 'view' would let Read Only write. Routes that
   only read call requireCapability('view') directly. */
export const requireEditor = () => requireCapability('editContent');
export const requireAdmin = () => requireCapability('manageSettings');

export { can, type Capability, type CmsRole };
