import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { taskSources, tasks } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import { invalidateCache } from '@/lib/cache/redis';
import { getTaskProvider } from '@/lib/integrations/tasks';
import type {
  TaskProviderTokens,
  ExternalTask,
  SyncResult,
} from '@/lib/integrations/tasks/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/task-sources/[id]/sync
 *
 * Performs bidirectional sync between Prism tasks and the external provider.
 *
 * Sync strategy (newest_wins):
 * 1. Fetch all remote tasks from provider
 * 2. For each remote task:
 *    - If no local match by externalId: create local task
 *    - If local match exists: compare timestamps, update the older one
 * 3. For each local task linked to this source:
 *    - If no remote match: push to remote (task was created locally)
 *    - If deleted remotely: delete locally (or mark as unlinked)
 * 4. Update lastSyncAt timestamp
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  const { id: sourceId } = await params;

  try {
    // 1. Get the source configuration
    const [source] = await db
      .select()
      .from(taskSources)
      .where(eq(taskSources.id, sourceId));

    if (!source) {
      return NextResponse.json(
        { error: 'Task source not found' },
        { status: 404 }
      );
    }

    if (!source.syncEnabled) {
      return NextResponse.json(
        { error: 'Sync is disabled for this source' },
        { status: 400 }
      );
    }

    // 2. Get the provider
    const provider = getTaskProvider(source.provider);
    if (!provider) {
      return NextResponse.json(
        { error: `Unknown provider: ${source.provider}` },
        { status: 400 }
      );
    }

    // 3. Prepare tokens
    if (!source.accessToken) {
      return NextResponse.json(
        { error: 'No access token configured. Please reconnect the provider.' },
        { status: 401 }
      );
    }

    let tokens: TaskProviderTokens = {
      accessToken: source.accessToken,
      refreshToken: source.refreshToken || undefined,
      expiresAt: source.tokenExpiresAt || undefined,
    };

    // 4. Refresh tokens if expired
    if (tokens.expiresAt && new Date(tokens.expiresAt) < new Date()) {
      if (provider.refreshTokens && tokens.refreshToken) {
        const newTokens = await provider.refreshTokens(tokens);
        if (newTokens) {
          tokens = newTokens;
          // Update tokens in database
          await db
            .update(taskSources)
            .set({
              accessToken: newTokens.accessToken,
              refreshToken: newTokens.refreshToken || source.refreshToken,
              tokenExpiresAt: newTokens.expiresAt,
              updatedAt: new Date(),
            })
            .where(eq(taskSources.id, sourceId));
        } else {
          await db
            .update(taskSources)
            .set({
              lastSyncError: 'Token refresh failed. Please reconnect.',
              updatedAt: new Date(),
            })
            .where(eq(taskSources.id, sourceId));

          return NextResponse.json(
            { error: 'Token refresh failed. Please reconnect the provider.' },
            { status: 401 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Access token expired. Please reconnect the provider.' },
          { status: 401 }
        );
      }
    }

    // 5. Perform the sync
    const result = await performSync(
      source.id,
      source.externalListId,
      source.taskListId,
      tokens,
      provider
    );

    // 6. Update source with sync result
    await db
      .update(taskSources)
      .set({
        lastSyncAt: new Date(),
        lastSyncError: result.errors.length > 0 ? result.errors.join('; ') : null,
        updatedAt: new Date(),
      })
      .where(eq(taskSources.id, sourceId));

    await invalidateCache('tasks:*');
    await invalidateCache('task-sources:*');

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Sync error:', error);

    // Update source with error
    await db
      .update(taskSources)
      .set({
        lastSyncError: error instanceof Error ? error.message : 'Unknown sync error',
        updatedAt: new Date(),
      })
      .where(eq(taskSources.id, sourceId));

    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Core sync logic
 */
async function performSync(
  sourceId: string,
  externalListId: string,
  taskListId: string,
  tokens: TaskProviderTokens,
  provider: ReturnType<typeof getTaskProvider>
): Promise<SyncResult> {
  if (!provider) {
    throw new Error('Provider not found');
  }

  const result: SyncResult = {
    created: 0,
    updated: 0,
    deleted: 0,
    errors: [],
  };

  try {
    // Fetch remote tasks
    const remoteTasks = await provider.fetchTasks(tokens, externalListId);

    // Fetch local tasks linked to this source
    const localTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.taskSourceId, sourceId));

    // Create maps for quick lookup
    const remoteById = new Map(remoteTasks.map(t => [t.id, t]));
    const localByExternalId = new Map(
      localTasks
        .filter(t => t.externalId)
        .map(t => [t.externalId!, t])
    );

    // Process remote tasks
    for (const remoteTask of remoteTasks) {
      const localTask = localByExternalId.get(remoteTask.id);

      if (!localTask) {
        // Remote task doesn't exist locally - create it
        try {
          await db.insert(tasks).values({
            title: remoteTask.title,
            description: remoteTask.description || null,
            listId: taskListId,
            dueDate: remoteTask.dueDate || null,
            priority: remoteTask.priority || null,
            completed: remoteTask.completed,
            completedAt: remoteTask.completedAt || null,
            taskSourceId: sourceId,
            externalId: remoteTask.id,
            externalUpdatedAt: remoteTask.updatedAt,
            lastSynced: new Date(),
          });
          result.created++;
        } catch (err) {
          result.errors.push(`Failed to create local task: ${remoteTask.title}`);
        }
      } else {
        // Task exists in both - compare timestamps
        const remoteUpdated = remoteTask.updatedAt;
        const localUpdated = localTask.updatedAt;

        if (remoteUpdated > localUpdated) {
          // Remote is newer - update local
          try {
            await db
              .update(tasks)
              .set({
                title: remoteTask.title,
                description: remoteTask.description || null,
                dueDate: remoteTask.dueDate || null,
                priority: remoteTask.priority || null,
                completed: remoteTask.completed,
                completedAt: remoteTask.completedAt || null,
                externalUpdatedAt: remoteTask.updatedAt,
                lastSynced: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(tasks.id, localTask.id));
            result.updated++;
          } catch (err) {
            result.errors.push(`Failed to update local task: ${localTask.title}`);
          }
        } else if (localUpdated > remoteUpdated) {
          // Local is newer - update remote
          try {
            // For MS To-Do, taskId needs format "listId:taskId"
            const taskIdForProvider = `${externalListId}:${remoteTask.id}`;
            await provider.updateTask(tokens, taskIdForProvider, {
              title: localTask.title,
              description: localTask.description,
              dueDate: localTask.dueDate,
              completed: localTask.completed,
              priority: localTask.priority,
            });

            // Update local sync timestamp
            await db
              .update(tasks)
              .set({
                lastSynced: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(tasks.id, localTask.id));
            result.updated++;
          } catch (err) {
            result.errors.push(`Failed to update remote task: ${localTask.title}`);
          }
        } else {
          // Same timestamp - just update lastSynced
          await db
            .update(tasks)
            .set({ lastSynced: new Date() })
            .where(eq(tasks.id, localTask.id));
        }
      }
    }

    // Find local tasks that don't exist remotely (created locally or deleted remotely)
    for (const localTask of localTasks) {
      if (!localTask.externalId) {
        // Local task without externalId - push to remote
        try {
          const created = await provider.createTask(tokens, {
            listId: externalListId,
            title: localTask.title,
            description: localTask.description,
            dueDate: localTask.dueDate,
            priority: localTask.priority,
          });

          // Update local task with external ID
          await db
            .update(tasks)
            .set({
              externalId: created.id,
              externalUpdatedAt: created.updatedAt,
              lastSynced: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(tasks.id, localTask.id));
          result.created++;
        } catch (err) {
          result.errors.push(`Failed to push task to remote: ${localTask.title}`);
        }
      } else if (!remoteById.has(localTask.externalId)) {
        // Local task has externalId but remote doesn't have it - deleted remotely
        // Option 1: Delete locally (sync deletion)
        // Option 2: Re-create remotely (preserve local)
        // We'll go with Option 1 for true bidirectional sync
        try {
          await db.delete(tasks).where(eq(tasks.id, localTask.id));
          result.deleted++;
        } catch (err) {
          result.errors.push(`Failed to delete local task: ${localTask.title}`);
        }
      }
    }

    return result;
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : 'Unknown sync error');
    return result;
  }
}
