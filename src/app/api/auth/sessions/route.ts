/**
 * Signed-in devices (#1044).
 *
 * GET    — the signed-in user's sessions: device, signed in, last used, kept,
 *          and which one is this device. Never returns a token.
 * DELETE — ?id=<list id>: sign that session out; ?others=1: sign out every
 *          session but this one.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAuth, listUserSessions, revokeUserSession, revokeOtherSessions } from '@/lib/auth';
import { deviceLabel } from '@/lib/auth/deviceLabel';
import { logActivity } from '@/lib/services/auditLog';

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (auth.scopes !== undefined) return NextResponse.json({ error: 'Sessions only' }, { status: 403 });
  const current = (await cookies()).get('prism_session')?.value;
  const sessions = await listUserSessions(auth.userId, current);
  return NextResponse.json({
    sessions: sessions.map(({ userAgent, ...s }) => ({ ...s, device: deviceLabel(userAgent) })),
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (auth.scopes !== undefined) return NextResponse.json({ error: 'Sessions only' }, { status: 403 });
  if (request.nextUrl.searchParams.get('others') === '1') {
    const current = (await cookies()).get('prism_session')?.value;
    const count = await revokeOtherSessions(auth.userId, current);
    logActivity({ userId: auth.userId, action: 'logout', entityType: 'session', summary: `Signed out ${count} other devices` });
    return NextResponse.json({ ok: true, count });
  }
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const ok = await revokeUserSession(auth.userId, id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  logActivity({ userId: auth.userId, action: 'logout', entityType: 'session', summary: 'Signed out a device' });
  return NextResponse.json({ ok: true });
}
