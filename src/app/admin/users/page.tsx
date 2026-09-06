'use client';

/* ================================================================
   /admin/users — FULL REPLACEMENT (v2). Marketing Admin only.

   Two sections, one page:
   1. Roles — what any signed-in email (SSO or local) may do.
   2. Password accounts — cms_local_user logins for people without
      an Entra account (the agency, freelancers). Creating one also
      assigns its role, so the first sign-in already works.
   ================================================================ */

import { useCallback, useEffect, useState } from 'react';
import { useDialog } from '@/components/admin/Dialog';
import { Button, Card, ErrorNote, Input, Muted, Pill, Select, SubHeading } from '@/components/admin/ui';

const ROLE_LABELS: Record<string, string> = {
  MARKETING_ADMIN: 'Marketing Admin',
  AGENCY_EDITOR: 'Agency Marketing Editor',
  CONTRIBUTOR: 'Content Contributor',
  APPROVER: 'Approver / Manager',
  READ_ONLY: 'Read Only',
};

type RoleRow = { EMAIL: string; ROLE: string; ASSIGNED_BY: string; ASSIGNED_AT: string };
type LocalRow = { email: string; displayName: string | null; active: boolean; createdBy: string | null };

export default function UsersPage() {
  const dialog = useDialog();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [locals, setLocals] = useState<LocalRow[]>([]);
  const [roleNames, setRoleNames] = useState<string[]>(Object.keys(ROLE_LABELS));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // role assignment form
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('AGENCY_EDITOR');

  // local account form
  const [lEmail, setLEmail] = useState('');
  const [lName, setLName] = useState('');
  const [lPass, setLPass] = useState('');
  const [lRole, setLRole] = useState('AGENCY_EDITOR');

  const load = useCallback(async () => {
    const [r1, r2] = await Promise.all([
      fetch('/api/users', { cache: 'no-store' }),
      fetch('/api/users/local', { cache: 'no-store' }),
    ]);
    const j1 = await r1.json();
    const j2 = await r2.json();
    if (!r1.ok) { setError(j1.error || 'Could not load users.'); return; }
    setRoles(j1.users || []);
    if (j1.roles?.length) setRoleNames(j1.roles);
    setLocals(r2.ok ? j2.users || [] : []);
    setError('');
  }, []);

  useEffect(() => { load(); }, [load]);

  async function call(url: string, method: string, body: unknown) {
    setBusy(true);
    setError('');
    try {
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Request failed.');
      await load();
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  function genPassword() {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%';
    const buf = new Uint32Array(14);
    crypto.getRandomValues(buf);
    setLPass(Array.from(buf, (n) => chars[n % chars.length]).join(''));
  }

  return (
    <div className="mx-auto max-w-[760px] px-5 py-6">
      <SubHeading>Roles</SubHeading>
      <Muted className="mb-4 block">
        The role decides what a signed-in email can do — it applies the same whether they come in
        through Microsoft or with a password. Changes apply at the user’s next sign-in. SSO users
        without a row here fall back to their Entra app role, then the server default.
      </Muted>
      {error && <ErrorNote>{error}</ErrorNote>}

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <Input placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            {roleNames.map((r) => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
          </Select>
          <Button
            size="sm"
            disabled={busy || !email.includes('@')}
            onClick={async () => { if (await call('/api/users', 'PUT', { email, role })) setEmail(''); }}
          >
            Assign role
          </Button>
        </div>
      </Card>

      {roles.length === 0 ? (
        <Muted>No CMS-assigned roles yet.</Muted>
      ) : (
        <ul className="mb-8 list-none">
          {roles.map((u) => (
            <li key={u.EMAIL} className="flex flex-wrap items-center gap-2 border-b border-edge py-2.5 text-[13px]">
              <span className="min-w-[220px] flex-1 font-mono text-[12px]">{u.EMAIL}</span>
              <Select value={u.ROLE} onChange={(e) => call('/api/users', 'PUT', { email: u.EMAIL, role: e.target.value })}>
                {roleNames.map((r) => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
              </Select>
              <Button size="sm" onClick={async () => {
                const sure = await dialog.confirm({
                  title: `Remove the CMS role for ${u.EMAIL}?`,
                  body: 'They fall back to their Entra role, or the server default.',
                  confirmLabel: 'Remove role',
                  danger: true,
                });
                if (sure) call('/api/users', 'DELETE', { email: u.EMAIL });
              }}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <SubHeading>Password accounts</SubHeading>
      <Muted className="mb-4 block">
        Logins for people without a Hadya Microsoft account. Stored in the database, scrypt-hashed.
        Creating an account also assigns its role above. To reset a password, create the account
        again with the same email.
      </Muted>

      <Card className="mb-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input placeholder="email@agency.com" value={lEmail} onChange={(e) => setLEmail(e.target.value)} />
          <Input placeholder="Display name (optional)" value={lName} onChange={(e) => setLName(e.target.value)} />
          <div className="flex gap-2">
            <Input placeholder="Password (min 10 chars)" value={lPass} onChange={(e) => setLPass(e.target.value)} />
            <Button size="sm" onClick={genPassword}>Generate</Button>
          </div>
          <div className="flex gap-2">
            <Select value={lRole} onChange={(e) => setLRole(e.target.value)}>
              {roleNames.map((r) => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
            </Select>
            <Button
              size="sm"
              disabled={busy || !lEmail.includes('@') || lPass.length < 10}
              onClick={async () => {
                if (await call('/api/users/local', 'POST', { email: lEmail, password: lPass, displayName: lName, role: lRole })) {
                  const creds = `${lEmail}\n${lPass}`;
                  await dialog.alert({
                    title: 'Account saved',
                    body: 'Share these once, securely — the CMS will not show the password again.',
                    content: (
                      <div className="rounded-panel bg-subtle px-3 py-2 font-mono text-[12px]">
                        <div>{lEmail}</div>
                        <div>{lPass}</div>
                        <Button size="sm" className="mt-2" onClick={() => navigator.clipboard.writeText(creds)}>
                          Copy both
                        </Button>
                      </div>
                    ),
                    confirmLabel: 'Done',
                  });
                  setLEmail(''); setLName(''); setLPass('');
                }
              }}
            >
              Create / reset
            </Button>
          </div>
        </div>
      </Card>

      {locals.length === 0 ? (
        <Muted>No password accounts yet.</Muted>
      ) : (
        <ul className="list-none">
          {locals.map((u) => (
            <li key={u.email} className="flex flex-wrap items-center gap-2 border-b border-edge py-2.5 text-[13px]">
              <span className="min-w-[220px] flex-1">
                <span className="font-mono text-[12px]">{u.email}</span>
                {u.displayName && <Muted className="ml-2">{u.displayName}</Muted>}
              </span>
              <Pill tone={u.active ? 'ok' : 'danger'}>{u.active ? 'active' : 'disabled'}</Pill>
              <Button size="sm" onClick={() => call('/api/users/local', 'PATCH', { email: u.email, active: !u.active })}>
                {u.active ? 'Disable' : 'Enable'}
              </Button>
              <Button size="sm" onClick={async () => {
                const sure = await dialog.confirm({
                  title: `Delete the password account for ${u.email}?`,
                  body: 'Their role row stays until removed in the Roles section above.',
                  confirmLabel: 'Delete account',
                  danger: true,
                });
                if (sure) call('/api/users/local', 'DELETE', { email: u.email });
              }}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}