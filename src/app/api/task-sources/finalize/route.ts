import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { taskSources, taskLists } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getRedisClient } from '@/lib/cache/getRedisClient';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';

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
    const { taskListId, externalListId, externalListName, newListName, newConnection, provider: requestProvider } = body;
    const provider = requestProvider || 'microsoft_todo';
    const redisPrefix = provider === 'google_tasks' ? 'google-tasks-temp' : 'ms-todo-temp';

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
      ? `${redisPrefix}:${auth.userId}:task:new`
      : `${redisPrefix}:${auth.userId}:task:${taskListId}`;
    let stored = await redis.get(tempKey);

    // Fallback for old MS key format (without key type segment)
    if (!stored && provider === 'microsoft_todo') {
      const fallbackKey = newConnection || !taskListId
        ? `ms-todo-temp:${auth.userId}:new`
        : `ms-todo-temp:${auth.userId}:${taskListId}`;
      stored = await redis.get(fallbackKey);
    }

    if (!stored) {
      const providerName = provider === 'google_tasks' ? 'Google Tasks' : 'Microsoft To-Do';
      return NextResponse.json(
        { error: `Session expired. Please reconnect ${providerName}.` },
        { status: 401 }
      );
    }

    const { accessToken, refreshToken, tokenExpiresAt, accountEmail } = JSON.parse(stored);

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
      await invalidateEntity('task-lists');
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
          eq(taskSources.provider, provider),
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
          accountEmail: accountEmail ?? undefined,
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
        provider,
        taskListId: finalTaskListId,
        externalListId,
        externalListName: externalListName || null,
        accessToken,
        refreshToken,
        tokenExpiresAt: new Date(tokenExpiresAt),
        accountEmail: accountEmail ?? null,
        syncEnabled: true,
      });
    }

    // Clean up temp tokens
    await redis.del(tempKey);

    await invalidateEntity('task-sources');

    logActivity({
      userId: auth.userId,
      action: existing ? 'update' : 'create',
      entityType: 'integration',
      summary: `Finalized task sync connection: ${provider} (${externalListName || externalListId})`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Error finalizing MS connection:', error);
    return NextResponse.json(
      { error: 'Failed to complete task sync connection' },
      { status: 500 }
    );
  }
}
