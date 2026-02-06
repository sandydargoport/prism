import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { taskSources, taskLists } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getRedisClient } from '@/lib/cache/getRedisClient';
import { invalidateCache } from '@/lib/cache/redis';

/**
 * POST /api/task-sources/finalize
 *
 * Finalizes the MS To-Do connection by creating a taskSource
 * with the user-selected MS list.
 *
 * Body: { taskListId, externalListId, externalListName, newListName?, newConnection? }
 * - taskListId: ID of existing Prism list (optional if newListName provided)
 * - newListName: Name for new Prism list to create (optional if taskListId provided)
 * - newConnection: true if this is a new provider connection (no existing taskListId)
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  try {
    const body = await request.json();
    const { taskListId, externalListId, externalListName, newListName, newConnection } = body;

    if (!externalListId) {
      return NextResponse.json(
        { error: 'externalListId is required' },
        { status: 400 }
      );
    }

    if (!taskListId && !newListName) {
      return NextResponse.json(
        { error: 'Either taskListId or newListName is required' },
        { status: 400 }
      );
    }

    // Get temp tokens from Redis
    const redis = await getRedisClient();
    if (!redis) {
      return NextResponse.json(
        { error: 'Redis unavailable' },
        { status: 503 }
      );
    }

    // Try the appropriate temp key
    const tempKey = newConnection || !taskListId
      ? `ms-todo-temp:${auth.userId}:new`
      : `ms-todo-temp:${auth.userId}:${taskListId}`;
    const stored = await redis.get(tempKey);

    if (!stored) {
      return NextResponse.json(
        { error: 'Session expired. Please reconnect Microsoft To-Do.' },
        { status: 401 }
      );
    }

    const { accessToken, refreshToken, tokenExpiresAt } = JSON.parse(stored);

    // Get or create the Prism task list
    let finalTaskListId = taskListId;

    if (newListName && !taskListId) {
      // Create a new Prism list
      const [newList] = await db.insert(taskLists).values({
        name: newListName,
        createdBy: auth.userId,
      }).returning();

      if (!newList) {
        return NextResponse.json(
          { error: 'Failed to create task list' },
          { status: 500 }
        );
      }
      finalTaskListId = newList.id;
      await invalidateCache('task-lists:*');
    } else {
      // Verify the Prism task list exists
      const [taskList] = await db
        .select()
        .from(taskLists)
        .where(eq(taskLists.id, taskListId));

      if (!taskList) {
        return NextResponse.json(
          { error: 'Task list not found' },
          { status: 404 }
        );
      }
    }

    // Check if source already exists for this Prism list
    const [existing] = await db
      .select()
      .from(taskSources)
      .where(
        and(
          eq(taskSources.provider, 'microsoft_todo'),
          eq(taskSources.taskListId, finalTaskListId)
        )
      );

    if (existing) {
      // Update existing source
      await db
        .update(taskSources)
        .set({
          accessToken,
          refreshToken: refreshToken || existing.refreshToken,
          tokenExpiresAt: new Date(tokenExpiresAt),
          externalListId,
          externalListName: externalListName || null,
          lastSyncError: null,
          updatedAt: new Date(),
        })
        .where(eq(taskSources.id, existing.id));
    } else {
      // Create new source
      await db.insert(taskSources).values({
        userId: auth.userId,
        provider: 'microsoft_todo',
        taskListId: finalTaskListId,
        externalListId,
        externalListName: externalListName || null,
        accessToken,
        refreshToken,
        tokenExpiresAt: new Date(tokenExpiresAt),
        syncEnabled: true,
      });
    }

    // Clean up temp tokens
    await redis.del(tempKey);

    await invalidateCache('task-sources:*');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error finalizing MS connection:', error);
    return NextResponse.json(
      { error: 'Failed to complete Microsoft To-Do connection' },
      { status: 500 }
    );
  }
}
