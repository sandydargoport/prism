import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { taskSources, taskLists, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import { invalidateCache, getCached } from '@/lib/cache/redis';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const cacheKey = userId ? `task-sources:user:${userId}` : 'task-sources:all';

    const sources = await getCached(
      cacheKey,
      async () => {
        let query = db
          .select({
            id: taskSources.id,
            userId: taskSources.userId,
            userName: users.name,
            provider: taskSources.provider,
            externalListId: taskSources.externalListId,
            externalListName: taskSources.externalListName,
            taskListId: taskSources.taskListId,
            taskListName: taskLists.name,
            syncEnabled: taskSources.syncEnabled,
            lastSyncAt: taskSources.lastSyncAt,
            lastSyncError: taskSources.lastSyncError,
            createdAt: taskSources.createdAt,
          })
          .from(taskSources)
          .leftJoin(users, eq(taskSources.userId, users.id))
          .leftJoin(taskLists, eq(taskSources.taskListId, taskLists.id));

        if (userId) {
          query = query.where(eq(taskSources.userId, userId)) as typeof query;
        }

        return query;
      },
      120
    );

    return NextResponse.json(sources);
  } catch (error) {
    console.error('Error fetching task sources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task sources' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  try {
    const body = await request.json();

    if (!body.provider || !body.externalListId || !body.taskListId) {
      return NextResponse.json(
        { error: 'provider, externalListId, and taskListId are required' },
        { status: 400 }
      );
    }

    // Verify the task list exists
    const [list] = await db
      .select()
      .from(taskLists)
      .where(eq(taskLists.id, body.taskListId));

    if (!list) {
      return NextResponse.json(
        { error: 'Task list not found' },
        { status: 404 }
      );
    }

    // Check for duplicate source
    const [existing] = await db
      .select()
      .from(taskSources)
      .where(
        and(
          eq(taskSources.userId, body.userId || auth.userId),
          eq(taskSources.provider, body.provider),
          eq(taskSources.externalListId, body.externalListId)
        )
      );

    if (existing) {
      return NextResponse.json(
        { error: 'This external list is already connected' },
        { status: 409 }
      );
    }

    const [newSource] = await db
      .insert(taskSources)
      .values({
        userId: body.userId || auth.userId,
        provider: body.provider,
        externalListId: body.externalListId,
        externalListName: body.externalListName || null,
        taskListId: body.taskListId,
        syncEnabled: body.syncEnabled !== false,
        accessToken: body.accessToken || null,
        refreshToken: body.refreshToken || null,
        tokenExpiresAt: body.tokenExpiresAt ? new Date(body.tokenExpiresAt) : null,
      })
      .returning();

    if (!newSource) {
      return NextResponse.json(
        { error: 'Failed to create task source' },
        { status: 500 }
      );
    }

    await invalidateCache('task-sources:*');

    // Don't return tokens in response
    return NextResponse.json({
      id: newSource.id,
      userId: newSource.userId,
      provider: newSource.provider,
      externalListId: newSource.externalListId,
      externalListName: newSource.externalListName,
      taskListId: newSource.taskListId,
      syncEnabled: newSource.syncEnabled,
      lastSyncAt: newSource.lastSyncAt,
      createdAt: newSource.createdAt,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating task source:', error);
    return NextResponse.json(
      { error: 'Failed to create task source' },
      { status: 500 }
    );
  }
}
