import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/rbac';
import { dbPing } from '@/lib/db';
import { whoAmI, dynamicsEnabled } from '@/lib/dynamics';
import { mailWhoAmI, mailEnabled } from '@/lib/mail';
import { ssoState, dbState, dynamicsState, mediaState, mailState, envFileMissing } from '@/lib/env';
import { activeDriver } from '@/lib/store';
import { getSharp } from '@/lib/images';

export const dynamic = 'force-dynamic';

/* Signed-in-only: the detail strings name environment variables, which is
   exactly the information you do not want on a public endpoint. */

export async function GET(req: Request) {
  const guard = await requireCapability('view');
  if (!guard.ok) return guard.response;

  const deep = new URL(req.url).searchParams.get('deep') === '1';

  const db = dbState();
  const sso = ssoState();
  const dyn = dynamicsState();
  const media = mediaState();
  const mail = mailState();

  /* Image optimisation is a library check rather than a config check —
     sharp is a native module and the common failure is a broken
     postinstall, not a missing variable. */
  const sharp = await getSharp();
  const images = sharp.available
    ? { configured: true, detail: `sharp ${sharp.version} — uploads are resized to WebP`, missing: [] }
    : { configured: false, detail: sharp.reason as string, missing: [] };

  const live = deep
    ? {
        database: await dbPing(),
        dynamics: dynamicsEnabled() ? await whoAmI() : { ok: false, detail: dyn.detail },
        mail: mailEnabled() ? await mailWhoAmI() : { ok: false, detail: mail.detail },
      }
    : undefined;

  return NextResponse.json({
    envFileMissing: envFileMissing(),
    contentStore: activeDriver(),
    role: guard.admin.role,
    provider: guard.admin.provider,
    checks: {
      sso: { ...sso, name: 'Microsoft Entra sign-in' },
      database: { ...db, name: 'Oracle Autonomous Database' },
      dynamics: { ...dyn, name: 'Dynamics 365 lead push' },
      media: { ...media, name: 'Media storage' },
      mail: { ...mail, name: 'Form notification email' },
      images: { ...images, name: 'Image optimisation' },
    },
    live,
  });
}
