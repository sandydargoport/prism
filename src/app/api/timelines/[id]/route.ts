/**
 * One timeline (#1266). Parent only.
 *
 * PATCH  — change it. Body, any of: { name, dashboardId (null: the household
 *          default), placements, idleBackground }. Every screen that follows
 *          it picks the change up on its next look at the list.
 * DELETE — remove it. The last one cannot go. Its screens move to the
 *          household's first timeline (their timeline_id goes null).
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import { isDisplayId } from '@/lib/auth/displayIdentity';
import { db } from '@/lib/db/client';
import { layouts, timelines } from '@/lib/db/schema';
import { listTimelines } from '@/lib/services/timelines';
import { logActivity } from '@/lib/services/auditLog';
import { timelinePatchSchema, toTimeline } from '@/lib/timeline';
import { logError } from '@/lib/utils/logError';

type RouteParams = { params: Promise<{ id: string }> };

async function parentOnly() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  return requireRole(auth, 'canModifySettings') ?? auth;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await parentOnly();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!isDisplayId(id)) return NextResponse.json({ error: 'Timeline not found' }, { status: 404 });

  const parsed = timelinePatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Not a valid change to a timeline' }, { status: 400 });
  }
  const patch = parsed.data;

  try {
    if (patch.dashboardId) {
      const [layout] = await db.select({ id: layouts.id }).from(layouts).where(eq(layouts.id, patch.dashboardId));
      if (!layout) return NextResponse.json({ error: 'That dashboard does not exist' }, { status: 400 });
    }
    const [row] = await db
      .update(timelines)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(timelines.id, id))
      .returning();
    if (!row) return NextResponse.json({ error: 'Timeline not found' }, { status: 404 });
    logActivity({
      userId: auth.userId,
      action: 'update',
      entityType: 'timeline',
      entityId: id,
      summary: `Timeline "${row.name}": changed ${Object.keys(patch).join(', ')}`,
    });
    return NextResponse.json({ timeline: toTimeline(row) });
  } catch (error) {
    logError('Failed to change a timeline:', error);
    return NextResponse.json({ error: 'Failed to change the timeline' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await parentOnly();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!isDisplayId(id)) return NextResponse.json({ error: 'Timeline not found' }, { status: 404 });

  try {
    const all = await listTimelines();
    if (!all.some((t) => t.id === id)) return NextResponse.json({ error: 'Timeline not found' }, { status: 404 });
    if (all.length === 1) {
      return NextResponse.json({ error: 'Every household keeps one timeline.' }, { status: 409 });
    }
    // The screens on it go to the first, by the foreign key (on delete set null).
    const [row] = await db.delete(timelines).where(eq(timelines.id, id)).returning();
    logActivity({
      userId: auth.userId,
      action: 'delete',
      entityType: 'timeline',
      entityId: id,
      summary: `Removed the timeline "${row?.name ?? ''}"`,
    });
    return NextResponse.json({ removed: true });
  } catch (error) {
    logError('Failed to remove a timeline:', error);
    return NextResponse.json({ error: 'Failed to remove the timeline' }, { status: 500 });
  }
}
