/**
 * One named screen (#690), managed from any device. Parent only.
 *
 * PATCH  — rename it. Body: { name: string (1 to 60 characters) }
 * DELETE — forget it. The screen goes back to being an unnamed browser; if it
 *          is this browser, its cookie is cleared too.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import {
  cleanDisplayName,
  currentDisplayId,
  DISPLAY_NAME_MAX_LENGTH,
  isDisplayId,
  setDisplayCookies,
} from '@/lib/auth/displayIdentity';
import { db } from '@/lib/db/client';
import { displays } from '@/lib/db/schema';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';

type RouteParams = {
  params: Promise<{ id: string }>;
};

/** Mirrors the session cookies: secure only when the request arrived over TLS. */
function requestIsSecure(request: NextRequest): boolean {
  return (
    request.nextUrl.protocol === 'https:' ||
    request.headers.get('x-forwarded-proto') === 'https'
  );
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = requireRole(auth, 'canManageUsers');
  if (denied) return denied;

  const { id } = await params;
  if (!isDisplayId(id)) return NextResponse.json({ error: 'Display not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const name = cleanDisplayName(body?.name);
  if (!name) {
    return NextResponse.json(
      { error: `Give the screen a name of up to ${DISPLAY_NAME_MAX_LENGTH} characters.` },
      { status: 400 }
    );
  }

  try {
    const [row] = await db
      .update(displays)
      .set({ name, updatedAt: new Date() })
      .where(eq(displays.id, id))
      .returning();
    if (!row) return NextResponse.json({ error: 'Display not found' }, { status: 404 });
    logActivity({
      userId: auth.userId,
      action: 'update',
      entityType: 'display',
      entityId: id,
      summary: `Renamed a display to "${name}"`,
    });
    return NextResponse.json({ display: { id: row.id, name: row.name } });
  } catch (error) {
    logError('Failed to rename display:', error);
    return NextResponse.json({ error: 'Failed to rename the display' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = requireRole(auth, 'canManageUsers');
  if (denied) return denied;

  const { id } = await params;
  if (!isDisplayId(id)) return NextResponse.json({ error: 'Display not found' }, { status: 404 });

  try {
    const [row] = await db.delete(displays).where(eq(displays.id, id)).returning();
    if (!row) return NextResponse.json({ error: 'Display not found' }, { status: 404 });
    if ((await currentDisplayId()) === id) {
      setDisplayCookies(await cookies(), null, requestIsSecure(request));
    }
    logActivity({
      userId: auth.userId,
      action: 'delete',
      entityType: 'display',
      entityId: id,
      summary: `Removed the display "${row.name}"`,
    });
    return NextResponse.json({ removed: true });
  } catch (error) {
    logError('Failed to remove display:', error);
    return NextResponse.json({ error: 'Failed to remove the display' }, { status: 500 });
  }
}
