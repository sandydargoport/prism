/**
 * Mark (or unmark) this browser as a trusted display.
 *
 * With the authentication wall on (#339) every caller has to sign in, which is
 * the wrong behaviour for the one device the wall is not aimed at: the screen on
 * the kitchen wall, whose whole job is to be readable without anyone touching
 * it. A parent marks that screen trusted once, from the screen itself, and it
 * keeps the implicit display identity while everything else is gated.
 *
 * The cookie carries no identity. It only records that a parent stood in front
 * of this browser and said so, and it is signed, so it cannot be invented by
 * something that merely reached the port.
 *
 * POST   — trust this browser
 * DELETE — stop trusting it
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAuth, requireRole } from '@/lib/auth';
import {
  issueTrustedDeviceToken,
  TRUSTED_DEVICE_COOKIE,
  TRUSTED_DEVICE_MAX_AGE_SECONDS,
} from '@/lib/auth/authWall';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';

/** Mirrors the session cookies: secure only when the request arrived over TLS. */
function requestIsSecure(request: NextRequest): boolean {
  return (
    request.nextUrl.protocol === 'https:' ||
    request.headers.get('x-forwarded-proto') === 'https'
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // Trusting a display exempts it from the wall, so it is a parent decision
  // rather than something any signed-in member can do.
  const denied = requireRole(auth, 'canManageUsers');
  if (denied) return denied;

  try {
    const store = await cookies();
    store.set(TRUSTED_DEVICE_COOKIE, issueTrustedDeviceToken(), {
      httpOnly: true,
      secure: requestIsSecure(request),
      sameSite: 'lax',
      maxAge: TRUSTED_DEVICE_MAX_AGE_SECONDS,
      path: '/',
    });

    logActivity({
      userId: auth.userId,
      action: 'update',
      entityType: 'session',
      summary: 'Marked this display as trusted (exempt from the authentication wall)',
    });

    return NextResponse.json({ trusted: true });
  } catch (error) {
    logError('Failed to mark device as trusted:', error);
    return NextResponse.json({ error: 'Failed to trust this display' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const denied = requireRole(auth, 'canManageUsers');
  if (denied) return denied;

  try {
    const store = await cookies();
    store.set(TRUSTED_DEVICE_COOKIE, '', {
      httpOnly: true,
      secure: requestIsSecure(request),
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    logActivity({
      userId: auth.userId,
      action: 'update',
      entityType: 'session',
      summary: 'Removed trusted-display status from this browser',
    });

    return NextResponse.json({ trusted: false });
  } catch (error) {
    logError('Failed to untrust device:', error);
    return NextResponse.json({ error: 'Failed to untrust this display' }, { status: 500 });
  }
}
