import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { calendarGroups, calendarSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logError } from '@/lib/utils/logError';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/calendar-groups/[id]
 * Update a calendar group (name, color, sortOrder).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if ('name' in body) updateData.name = body.name;
    if ('color' in body) updateData.color = body.color;
    if ('sortOrder' in body) updateData.sortOrder = body.sortOrder;

    const [updated] = await db
      .update(calendarGroups)
      .set(updateData)
      .where(eq(calendarGroups.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    await invalidateEntity('calendar-groups');

    return NextResponse.json(updated);
  } catch (error) {
    logError('Error updating calendar group:', error);
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 });
  }
}

/**
 * DELETE /api/calendar-groups/[id]
 * Delete a user-created custom calendar group. System groups — the per-member
 * 'user' groups and the shared 'family' aggregate — are auto-managed and cannot
 * be deleted (they would just be re-seeded on the next calendar load).
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const [group] = await db.select().from(calendarGroups).where(eq(calendarGroups.id, id));
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    if (group.type === 'user' || group.type === 'family') {
      return NextResponse.json(
        { error: 'System calendar groups (member and Family) are managed automatically and cannot be deleted' },
        { status: 400 }
      );
    }

    // Unlink sources from this group
    await db.update(calendarSources).set({ groupId: null }).where(eq(calendarSources.groupId, id));

    await db.delete(calendarGroups).where(eq(calendarGroups.id, id));

    await invalidateEntity('calendar-groups');

    return NextResponse.json({ message: 'Group deleted' });
  } catch (error) {
    logError('Error deleting calendar group:', error);
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
  }
}
