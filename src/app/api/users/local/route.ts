/* ================================================================
   src/app/api/users/local/route.ts — NEW. Marketing Admin only.

   Password accounts in cms_local_user. Creating one writes BOTH
   tables: credentials here, role in cms_user_role — so the account
   signs in with the right permissions on its very first login.

     GET    -> list local accounts
     POST   -> { email, password, displayName?, role } create / reset
     PATCH  -> { email, active } enable or disable
     DELETE -> { email } remove the account (role row stays unless
               removed separately at /admin/users)
   ================================================================ */
import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/rbac';
import { ALL_ROLES, upgradeLegacyRole } from '@/lib/permissions';
import { audit, isDbConfigured, withConnection } from '@/lib/db';
import {
  MIN_PASSWORD_LENGTH,
  deleteLocalUser,
  hashPassword,
  listLocalUsers,
  setLocalUserActive,
  upsertLocalUser,
} from '@/lib/local-users';

export const dynamic = 'force-dynamic';
const TENANT = () => process.env.CMS_TENANT_ID || 'hadya';

const needDb = () =>
  NextResponse.json({ error: 'Password accounts need the Oracle store.' }, { status: 400 });

export async function GET() {
  const guard = await requireCapability('manageUsers');
  if (!guard.ok) return guard.response;
  if (!isDbConfigured()) return NextResponse.json({ users: [] });
  return NextResponse.json({ users: await listLocalUsers() });
}

export async function POST(req: Request) {
  const guard = await requireCapability('manageUsers');
  if (!guard.ok) return guard.response;
  if (!isDbConfigured()) return needDb();

  const b = (await req.json().catch(() => ({}))) as {
    email?: string; password?: string; displayName?: string; role?: string;
  };
  const email = (b.email || '').trim().toLowerCase();
  const password = b.password || '';
  const role = upgradeLegacyRole(b.role);

  if (!email.includes('@') || email.endsWith('@local')) {
    return NextResponse.json({ error: 'A real email address is required.' }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 },
    );
  }
  if (!b.role || !(ALL_ROLES as string[]).includes(role)) {
    return NextResponse.json({ error: 'Unknown role.' }, { status: 400 });
  }

  // Credentials + role in one action, so the first sign-in already works.
  await upsertLocalUser(email, hashPassword(password), b.displayName?.trim() || null, guard.admin.actor);
  await withConnection(async (conn) => {
    await conn.execute(
      `MERGE INTO cms_user_role t
        USING (SELECT :t AS tenant_id, :e AS email FROM dual) s
           ON (t.tenant_id = s.tenant_id AND t.email = s.email)
       WHEN MATCHED THEN UPDATE SET role = :r, assigned_by = :b, assigned_at = SYSTIMESTAMP
       WHEN NOT MATCHED THEN INSERT (tenant_id, email, role, assigned_by)
            VALUES (s.tenant_id, s.email, :r, :b)`,
      { t: TENANT(), e: email, r: role, b: guard.admin.actor },
      { autoCommit: true },
    );
  });

  audit('LOCAL_USER_SET', guard.admin.actor, `${email} (${role})`);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const guard = await requireCapability('manageUsers');
  if (!guard.ok) return guard.response;
  if (!isDbConfigured()) return needDb();

  const { email, active } = (await req.json().catch(() => ({}))) as { email?: string; active?: boolean };
  const e = (email || '').trim().toLowerCase();
  if (!e) return NextResponse.json({ error: 'Missing email.' }, { status: 400 });
  if (e === guard.admin.actor.toLowerCase() && active === false) {
    return NextResponse.json({ error: 'You cannot disable your own account.' }, { status: 400 });
  }

  await setLocalUserActive(e, active !== false);
  audit(active === false ? 'LOCAL_USER_DISABLE' : 'LOCAL_USER_ENABLE', guard.admin.actor, e);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const guard = await requireCapability('manageUsers');
  if (!guard.ok) return guard.response;
  if (!isDbConfigured()) return needDb();

  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const e = (email || '').trim().toLowerCase();
  if (!e) return NextResponse.json({ error: 'Missing email.' }, { status: 400 });
  if (e === guard.admin.actor.toLowerCase()) {
    return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
  }

  await deleteLocalUser(e);
  audit('LOCAL_USER_DELETE', guard.admin.actor, e);
  return NextResponse.json({ ok: true });
}
