/* ================================================================
   src/app/api/users/route.ts — NEW. Marketing Admin only.

   Assigns CMS roles by email (cms_user_role). Entra keeps deciding
   WHO can sign in; this table decides WHAT they can do. A change
   takes effect at the user's next sign-in.
   ================================================================ */
import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/rbac';
import { ALL_ROLES, upgradeLegacyRole } from '@/lib/permissions';
import { audit, isDbConfigured, withConnection } from '@/lib/db';

export const dynamic = 'force-dynamic';
const TENANT = () => process.env.CMS_TENANT_ID || 'hadya';

export async function GET() {
  const guard = await requireCapability('manageUsers');
  if (!guard.ok) return guard.response;
  if (!isDbConfigured()) {
    return NextResponse.json({ users: [], note: 'Role assignment needs the Oracle store.' });
  }
  const users = await withConnection(async (conn) => {
    const r = await conn.execute(
      `SELECT email, role, assigned_by, assigned_at
         FROM cms_user_role WHERE tenant_id = :t ORDER BY email`,
      { t: TENANT() },
    );
    return r.rows ?? [];
  });
  return NextResponse.json({ users, roles: ALL_ROLES });
}

export async function PUT(req: Request) {
  const guard = await requireCapability('manageUsers');
  if (!guard.ok) return guard.response;
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Role assignment needs the Oracle store.' }, { status: 400 });
  }

  const { email, role } = (await req.json().catch(() => ({}))) as { email?: string; role?: string };
  const e = (email || '').trim().toLowerCase();
  const r = upgradeLegacyRole(role);
  if (!e.includes('@')) return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
  if (!role || !(ALL_ROLES as string[]).includes(r)) {
    return NextResponse.json({ error: 'Unknown role.' }, { status: 400 });
  }
  // An admin removing their own admin role is a footgun; require someone else.
  if (e === guard.admin.actor.toLowerCase() && r !== 'MARKETING_ADMIN') {
    return NextResponse.json({ error: 'You cannot downgrade your own role.' }, { status: 400 });
  }

  await withConnection(async (conn) => {
    await conn.execute(
      `MERGE INTO cms_user_role t
        USING (SELECT :t AS tenant_id, :e AS email FROM dual) s
           ON (t.tenant_id = s.tenant_id AND t.email = s.email)
       WHEN MATCHED THEN UPDATE SET role = :r, assigned_by = :b, assigned_at = SYSTIMESTAMP
       WHEN NOT MATCHED THEN INSERT (tenant_id, email, role, assigned_by)
            VALUES (s.tenant_id, s.email, :r, :b)`,
      { t: TENANT(), e, r, b: guard.admin.actor },
      { autoCommit: true },
    );
  });
  audit('ROLE_ASSIGN', guard.admin.actor, `${e} -> ${r}`);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const guard = await requireCapability('manageUsers');
  if (!guard.ok) return guard.response;
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const e = (email || '').trim().toLowerCase();
  if (!e) return NextResponse.json({ error: 'Missing email.' }, { status: 400 });
  if (e === guard.admin.actor.toLowerCase()) {
    return NextResponse.json({ error: 'You cannot remove your own role.' }, { status: 400 });
  }
  await withConnection(async (conn) => {
    await conn.execute(
      `DELETE FROM cms_user_role WHERE tenant_id = :t AND email = :e`,
      { t: TENANT(), e },
      { autoCommit: true },
    );
  });
  audit('ROLE_REMOVE', guard.admin.actor, e);
  return NextResponse.json({ ok: true });
}
