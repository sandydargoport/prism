/**
 * The display registry (#690).
 *
 * GET  — every named screen, with whether it is online, and which one (if any)
 *        this browser is
 * POST — name this browser's screen. Parent only. A browser already named is
 *        renamed rather than given a second row.
 *
 * REQUEST BODY (POST): { name: string (1 to 60 characters) }
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { asc, eq } from 'drizzle-orm';
import { getDisplayAuth, requireAuth, requireRole } from '@/lib/auth';
import {
  cleanDisplayName,
  currentDisplay,
  DISPLAY_NAME_MAX_LENGTH,
  isOnline,
  setDisplayCookies,
} from '@/lib/auth/displayIdentity';
import { db } from '@/lib/db/client';
import { displays } from '@/lib/db/schema';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';

/** Mirrors the session cookies: secure only when the request arrived over TLS. */
function requestIsSecure(request: NextRequest): boolean {
  return (
    request.nextUrl.protocol === 'https:' ||
    request.headers.get('x-forwarded-proto') === 'https'
  );
}

export async function GET() {
  const auth = await getDisplayAuth();
  if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  try {
    const [rows, mine] = await Promise.all([
      db.select().from(displays).orderBy(asc(displays.name)),
      currentDisplay(),
    ]);
    const now = Date.now();
    return NextResponse.json({
      displays: rows.map((d) => ({
        id: d.id,
        name: d.name,
        lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
        online: isOnline(d.lastSeenAt, now),
      })),
      currentId: mine?.id ?? null,
    });
  } catch (error) {
    logError('Failed to list displays:', error);
    return NextResponse.json({ error: 'Failed to list displays' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  // Naming is done from the screen itself, by a parent, like trusting it.
  const denied = requireRole(auth, 'canManageUsers');
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const name = cleanDisplayName(body?.name);
  if (!name) {
    return NextResponse.json(
      { error: `Give the screen a name of up to ${DISPLAY_NAME_MAX_LENGTH} characters.` },
      { status: 400 }
    );
  }

  try {
    const existing = await currentDisplay();
    if (existing) {
      const [row] = await db
        .update(displays)
        .set({ name, updatedAt: new Date() })
        .where(eq(displays.id, existing.id))
        .returning();
      logActivity({
        userId: auth.userId,
        action: 'update',
        entityType: 'display',
        entityId: existing.id,
        summary: `Renamed a display to "${name}"`,
      });
      return NextResponse.json({ display: { id: row!.id, name: row!.name } });
    }

    const [row] = await db
      .insert(displays)
      .values({ name, lastSeenAt: new Date() })
      .returning();
    setDisplayCookies(await cookies(), row!.id, requestIsSecure(request));
    logActivity({
      userId: auth.userId,
      action: 'create',
      entityType: 'display',
      entityId: row!.id,
      summary: `Named this display "${name}"`,
    });
    return NextResponse.json({ display: { id: row!.id, name: row!.name } }, { status: 201 });
  } catch (error) {
    logError('Failed to name display:', error);
    return NextResponse.json({ error: 'Failed to name this display' }, { status: 500 });
  }
}
