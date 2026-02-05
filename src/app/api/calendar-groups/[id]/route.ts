import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { calendarGroups, calendarSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { invalidateCache } from '@/lib/cache/redis';

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

    await invalidateCache('calendar-groups:*');

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating calendar group:', error);
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 });
  }
}

/**
 * DELETE /api/calendar-groups/[id]
 * Delete a custom calendar group. User-type groups cannot be deleted.
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
    if (group.type === 'user') {
      return NextResponse.json({ error: 'Cannot delete user-linked groups' }, { status: 400 });
    }

    // Unlink sources from this group
    await db.update(calendarSources).set({ groupId: null }).where(eq(calendarSources.groupId, id));

    await db.delete(calendarGroups).where(eq(calendarGroups.id, id));

    await invalidateCache('calendar-groups:*');

    return NextResponse.json({ message: 'Group deleted' });
  } catch (error) {
    console.error('Error deleting calendar group:', error);
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
  }
}
