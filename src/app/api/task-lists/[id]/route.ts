import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { taskLists } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import { invalidateCache } from '@/lib/cache/redis';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const [list] = await db
      .select()
      .from(taskLists)
      .where(eq(taskLists.id, id));

    if (!list) {
      return NextResponse.json(
        { error: 'Task list not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(list);
  } catch (error) {
    console.error('Error fetching task list:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task list' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageTasks');
  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const body = await request.json();

    const [existing] = await db
      .select()
      .from(taskLists)
      .where(eq(taskLists.id, id));

    if (!existing) {
      return NextResponse.json(
        { error: 'Task list not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if ('name' in body) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Name must be a non-empty string' },
          { status: 400 }
        );
      }
      updateData.name = body.name.trim();
    }

    if ('color' in body) {
      updateData.color = body.color || null;
    }

    if ('sortOrder' in body) {
      updateData.sortOrder = body.sortOrder;
    }

    const [updated] = await db
      .update(taskLists)
      .set(updateData)
      .where(eq(taskLists.id, id))
      .returning();

    await invalidateCache('task-lists:*');
    await invalidateCache('tasks:*');

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating task list:', error);
    return NextResponse.json(
      { error: 'Failed to update task list' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageTasks');
  if (forbidden) return forbidden;

  try {
    const { id } = await params;

    const [existing] = await db
      .select()
      .from(taskLists)
      .where(eq(taskLists.id, id));

    if (!existing) {
      return NextResponse.json(
        { error: 'Task list not found' },
        { status: 404 }
      );
    }

    await db.delete(taskLists).where(eq(taskLists.id, id));

    await invalidateCache('task-lists:*');
    await invalidateCache('tasks:*');

    return NextResponse.json({
      message: 'Task list deleted successfully',
      deletedList: { id: existing.id, name: existing.name },
    });
  } catch (error) {
    console.error('Error deleting task list:', error);
    return NextResponse.json(
      { error: 'Failed to delete task list' },
      { status: 500 }
    );
  }
}
