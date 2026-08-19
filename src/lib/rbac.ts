import 'server-only';
import { NextResponse } from 'next/server';
import { currentAdmin, type AdminIdentity, type CmsRole } from './auth';

/* ------------------------------------------------------------------
   Middleware and hidden buttons are cosmetic — anyone can type a URL or
   call an API with curl. This is where access is actually decided, and
   every route that reads or writes content calls it first.

     EDITOR — pages, blocks, media, leads
     ADMIN  — everything an editor can do, plus site settings and
              anything that changes how the system is wired
-------------------------------------------------------------------*/

const RANK: Record<CmsRole, number> = { EDITOR: 1, ADMIN: 2 };

/* Both members carry both keys (one always undefined) so that narrowing
   works even with strict:false in tsconfig, where boolean-literal
   discrimination is unreliable. */
export type Guard =
  | { ok: true; admin: AdminIdentity; response?: undefined }
  | { ok: false; admin?: undefined; response: NextResponse };

export async function requireRole(min: CmsRole): Promise<Guard> {
  const admin = await currentAdmin();

  if (!admin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Sign in to continue.' },
        { status: 401 },
      ),
    };
  }

  if (RANK[admin.role] < RANK[min]) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            min === 'ADMIN'
              ? 'This needs the Admin role. Ask IT to assign you the Admin app role in Entra ID.'
              : 'Your account does not have edit access.',
          role: admin.role,
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true, admin };
}

export const requireEditor = () => requireRole('EDITOR');
export const requireAdmin = () => requireRole('ADMIN');
