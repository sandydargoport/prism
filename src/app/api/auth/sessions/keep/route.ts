/**
 * Keep this device signed in (#1044).
 *
 * POST   — keep the session this request carries: a month from last use, up
 *          to a year from sign in; its cookies are rewritten to match.
 * DELETE — stop keeping it: back to the ordinary window.
 *
 * A parent decision, like trusting a display: a kept phone is a long-lived key.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAuth, requireRole, setSessionKept } from '@/lib/auth';
import { logActivity } from '@/lib/services/auditLog';

/** Mirrors the session cookies: secure only when the request arrived over TLS. */
function requestIsSecure(request: NextRequest): boolean {
  return request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
}

async function setKept(request: NextRequest, kept: boolean) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (auth.scopes !== undefined) return NextResponse.json({ error: 'Sessions only' }, { status: 403 });
  const denied = requireRole(auth, 'canManageUsers');
  if (denied) return denied;

  const store = await cookies();
  const token = store.get('prism_session')?.value;
  if (!token) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const result = await setSessionKept(token, kept);
  if (!result) return NextResponse.json({ error: 'Session not found' }, { status: 401 });

  const base = { secure: requestIsSecure(request), sameSite: 'lax' as const, expires: result.cookieExpires, path: '/' };
  store.set('prism_session', token, { ...base, httpOnly: true });
  store.set('prism_user', auth.userId, { ...base, httpOnly: false });

  logActivity({
    userId: auth.userId,
    action: 'update',
    entityType: 'session',
    summary: kept ? 'Kept this device signed in' : 'Stopped keeping this device signed in',
  });
  return NextResponse.json({ kept, cookieExpires: result.cookieExpires.toISOString() });
}

export const POST = (request: NextRequest) => setKept(request, true);
export const DELETE = (request: NextRequest) => setKept(request, false);
