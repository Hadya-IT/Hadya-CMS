import { NextResponse } from 'next/server';
import { getAnalytics, analyticsMode, gtmContainerId } from '@/lib/analytics';
import { requireEditor } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const guard = await requireEditor();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const days = Math.min(90, Math.max(7, Number(url.searchParams.get('days')) || 30));

  try {
    const data = await getAnalytics(days);
    return NextResponse.json({ ...data, mode: analyticsMode(), gtmId: gtmContainerId() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Analytics unavailable.' },
      { status: 503 },
    );
  }
}
