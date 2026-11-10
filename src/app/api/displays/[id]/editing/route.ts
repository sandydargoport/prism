/**
 * POST /api/displays/:id/editing (#1153). Parent only.
 *
 * Body: { editing: boolean }. A phone editing this screen says so when it
 * opens the editor and again every minute it stays open, and clears it on
 * Done or Cancel. The screen reads it from its heartbeat and shows a small
 * note; a phone that went away without clearing it stops counting after
 * DISPLAY_EDITING_WINDOW_MS.
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import { isDisplayId } from '@/lib/auth/displayIdentity';
import { db } from '@/lib/db/client';
import { displays } from '@/lib/db/schema';
import { logError } from '@/lib/utils/logError';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = requireRole(auth, 'canManageUsers');
  if (denied) return denied;

  const { id } = await params;
  if (!isDisplayId(id)) return NextResponse.json({ error: 'Display not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (typeof body?.editing !== 'boolean') {
    return NextResponse.json({ error: 'Say whether the screen is being edited' }, { status: 400 });
  }

  try {
    const [row] = await db
      .update(displays)
      .set({ editingAt: body.editing ? new Date() : null })
      .where(eq(displays.id, id))
      .returning();
    if (!row) return NextResponse.json({ error: 'Display not found' }, { status: 404 });
    return NextResponse.json({ editing: body.editing });
  } catch (error) {
    logError('Failed to mark display editing:', error);
    return NextResponse.json({ error: 'Failed to update the display' }, { status: 500 });
  }
}
