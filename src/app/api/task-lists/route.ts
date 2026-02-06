import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { taskLists } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import { invalidateCache, getCached } from '@/lib/cache/redis';

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const lists = await getCached(
      'task-lists:all',
      async () => db
        .select()
        .from(taskLists)
        .orderBy(asc(taskLists.sortOrder), asc(taskLists.name)),
      300
    );

    return NextResponse.json(lists);
  } catch (error) {
    console.error('Error fetching task lists:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task lists' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageTasks');
  if (forbidden) return forbidden;

  try {
    const body = await request.json();

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const maxSort = await db
      .select({ sortOrder: taskLists.sortOrder })
      .from(taskLists)
      .orderBy(asc(taskLists.sortOrder))
      .limit(1);

    const firstSort = maxSort[0];
    const nextSort = firstSort ? (firstSort.sortOrder || 0) + 1 : 0;

    const [newList] = await db
      .insert(taskLists)
      .values({
        name: body.name.trim(),
        color: body.color || null,
        sortOrder: nextSort,
        createdBy: auth.userId,
      })
      .returning();

    await invalidateCache('task-lists:*');
    await invalidateCache('tasks:*');

    return NextResponse.json(newList, { status: 201 });
  } catch (error) {
    console.error('Error creating task list:', error);
    return NextResponse.json(
      { error: 'Failed to create task list' },
      { status: 500 }
    );
  }
}
