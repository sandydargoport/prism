/**
 *
 * Handles HTTP requests for a specific task by ID.
 * Operations: get, update, delete a single task.
 *
 * ENDPOINT: /api/tasks/[id]
 * - GET:    Get a specific task by ID
 * - PATCH:  Update a specific task
 * - DELETE: Delete a specific task
 *
 * DYNAMIC ROUTE SEGMENTS:
 * The [id] folder name is a dynamic segment in Next.js.
 * It captures the task ID from the URL:
 * - /api/tasks/abc123 → params.id = "abc123"
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { tasks, users, dismissedTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import { formatTaskRow } from '@/lib/utils/formatters';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';
import { resolveTaskProviderAuth } from '@/lib/integrations/tasks/providerAuth';

/**
 * Remove a synced task from its provider. Best-effort by design: a failure
 * here must not stop the user deleting the task in Prism, which is how the
 * calendar delete behaves too. The caller writes a tombstone either way, so a
 * failure costs an orphaned remote task rather than a resurrected local one.
 */
async function deleteTaskUpstream(taskSourceId: string, externalId: string): Promise<void> {
  try {
    const auth = await resolveTaskProviderAuth(taskSourceId);
    if (!auth.ok) {
      logError('Skipping upstream task delete:', auth.reason);
      return;
    }
    if (!auth.provider.deleteTask) return;

    // Providers address a task by list, so the id is "listId:taskId" — the
    // same form the sync route builds when it pushes an update.
    await auth.provider.deleteTask(auth.tokens, `${auth.externalListId}:${externalId}`);
  } catch (error) {
    logError('Failed to delete task from provider:', error);
  }
}


/**
 * ROUTE PARAMS TYPE
 * Next.js 14 App Router provides route params as a Promise.
 * This type defines the expected shape of our dynamic route params.
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}


/**
 * GET /api/tasks/[id]
 * Retrieves a single task by its ID.
 *
 * URL PARAMS:
 * - id: The task's UUID
 *
 * RESPONSE:
 * - 200: Task found, returns task data
 * - 404: Task not found
 * - 500: Server error
 *
 * EXAMPLE:
 * GET /api/tasks/550e8400-e29b-41d4-a716-446655440000
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    // Validate UUID format (basic check)
    if (!id || id.length < 10) {
      return NextResponse.json(
        { error: 'Invalid task ID' },
        { status: 400 }
      );
    }

    // Fetch task with assigned user data
    const [taskWithUser] = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        dueDate: tasks.dueDate,
        priority: tasks.priority,
        category: tasks.category,
        completed: tasks.completed,
        completedAt: tasks.completedAt,
        listId: tasks.listId,
        taskSourceId: tasks.taskSourceId,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        assignedUserId: users.id,
        assignedUserName: users.name,
        assignedUserColor: users.color,
        assignedUserAvatar: users.avatarUrl,
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assignedTo, users.id))
      .where(eq(tasks.id, id));

    if (!taskWithUser) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Format and return response
    return NextResponse.json(formatTaskRow(taskWithUser));
  } catch (error) {
    logError('Error fetching task:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { status: 500 }
    );
  }
}


/**
 * PATCH /api/tasks/[id]
 * Updates a specific task.
 *
 * WHY PATCH INSTEAD OF PUT?
 * - PUT replaces the entire resource (all fields required)
 * - PATCH updates only the provided fields (partial update)
 * For task updates, PATCH is more practical since you often
 * just want to toggle completion or update one field.
 *
 * REQUEST BODY (all fields optional):
 * {
 *   title?: string
 *   description?: string | null
 *   assignedTo?: string | null
 *   dueDate?: string | null
 *   priority?: "high" | "medium" | "low" | null
 *   category?: string | null
 *   completed?: boolean
 *   completedBy?: string (user ID who completed it)
 * }
 *
 * RESPONSE:
 * - 200: Task updated successfully
 * - 400: Invalid request body
 * - 404: Task not found
 * - 500: Server error
 *
 * EXAMPLE:
 * PATCH /api/tasks/abc123
 * { "completed": true, "completedBy": "user-uuid" }
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    // Check if task exists and get ownership info
    const [existingTask] = await db
      .select({
        id: tasks.id,
        assignedTo: tasks.assignedTo,
        createdBy: tasks.createdBy,
      })
      .from(tasks)
      .where(eq(tasks.id, id));

    if (!existingTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // AUTHORIZATION CHECK - Children can only toggle their own tasks
    if ('completed' in body) {
      const isChild = auth.role === 'child';
      const isOwner = existingTask.createdBy === auth.userId || existingTask.assignedTo === auth.userId;

      if (isChild && !isOwner) {
        return NextResponse.json(
          { error: 'You can only complete tasks assigned to you' },
          { status: 403 }
        );
      }
    }

    // Build update object with only provided fields
    // This ensures we don't accidentally overwrite fields with undefined
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // Validate and add each field if present in request body
    if ('title' in body) {
      if (typeof body.title !== 'string' || body.title.trim().length === 0) {
        return NextResponse.json(
          { error: 'Title must be a non-empty string' },
          { status: 400 }
        );
      }
      updateData.title = body.title.trim();
    }

    if ('description' in body) {
      updateData.description = body.description?.trim() || null;
    }

    if ('assignedTo' in body) {
      updateData.assignedTo = body.assignedTo || null;
    }

    if ('dueDate' in body) {
      if (body.dueDate === null) {
        updateData.dueDate = null;
      } else if (body.dueDate) {
        const date = new Date(body.dueDate);
        if (isNaN(date.getTime())) {
          return NextResponse.json(
            { error: 'Invalid dueDate format' },
            { status: 400 }
          );
        }
        updateData.dueDate = date;
      }
    }

    if ('priority' in body) {
      if (body.priority !== null && !['high', 'medium', 'low'].includes(body.priority)) {
        return NextResponse.json(
          { error: 'Priority must be "high", "medium", "low", or null' },
          { status: 400 }
        );
      }
      updateData.priority = body.priority;
    }

    if ('category' in body) {
      updateData.category = body.category?.trim() || null;
    }

    if ('listId' in body) {
      updateData.listId = body.listId || null;
    }

    if ('completed' in body) {
      updateData.completed = Boolean(body.completed);

      // Set completedAt timestamp when marking complete
      if (body.completed) {
        updateData.completedAt = new Date();
        if (body.completedBy) {
          updateData.completedBy = body.completedBy;
        }
      } else {
        // Clear completion data when marking incomplete
        updateData.completedAt = null;
        updateData.completedBy = null;
      }
    }

    // Execute update
    await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id));

    // Fetch and return updated task
    const [updatedTaskWithUser] = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        dueDate: tasks.dueDate,
        priority: tasks.priority,
        category: tasks.category,
        completed: tasks.completed,
        completedAt: tasks.completedAt,
        listId: tasks.listId,
        taskSourceId: tasks.taskSourceId,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        assignedUserId: users.id,
        assignedUserName: users.name,
        assignedUserColor: users.color,
        assignedUserAvatar: users.avatarUrl,
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assignedTo, users.id))
      .where(eq(tasks.id, id));

    if (!updatedTaskWithUser) {
      return NextResponse.json(
        { error: 'Task not found after update' },
        { status: 404 }
      );
    }

    await invalidateEntity('tasks');

    const actionSummary = body.completed
      ? `Completed task: ${updatedTaskWithUser.title}`
      : `Updated task: ${updatedTaskWithUser.title}`;
    logActivity({
      userId: auth.userId,
      action: body.completed ? 'complete' : 'update',
      entityType: 'task',
      entityId: id,
      summary: actionSummary,
    });

    return NextResponse.json(formatTaskRow(updatedTaskWithUser));
  } catch (error) {
    logError('Error updating task:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}


/**
 * DELETE /api/tasks/[id]
 * Deletes a specific task.
 *
 * AUTHORIZATION:
 * - Parents can delete any task
 * - Children can only delete their own tasks (tasks they created)
 *
 * URL PARAMS:
 * - id: The task's UUID
 *
 * RESPONSE:
 * - 200: Task deleted successfully
 * - 401: Not authenticated
 * - 403: Not authorized to delete this task
 * - 404: Task not found
 * - 500: Server error
 *
 * EXAMPLE:
 * DELETE /api/tasks/abc123
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    // CHECK IF TASK EXISTS AND GET OWNERSHIP INFO
    const [existingTask] = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        createdBy: tasks.createdBy,
        assignedTo: tasks.assignedTo,
        taskSourceId: tasks.taskSourceId,
        externalId: tasks.externalId,
      })
      .from(tasks)
      .where(eq(tasks.id, id));

    if (!existingTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // AUTHORIZATION CHECK
    const isOwner = existingTask.createdBy === auth.userId || existingTask.assignedTo === auth.userId;
    if (!isOwner) {
      const forbidden = requireRole(auth, 'canDeleteTasks');
      if (forbidden) return forbidden;
    }

    // Propagate the delete to the provider, mirroring how calendar events are
    // handled: best-effort, and never blocking the local delete. Without this
    // the reconciler saw a task present remotely with no local match, treated
    // it as newly created, and re-added it within about five minutes.
    if (existingTask.taskSourceId && existingTask.externalId) {
      await deleteTaskUpstream(
        existingTask.taskSourceId,
        existingTask.externalId,
      );

      // Tombstone regardless of whether the call above succeeded. A failed or
      // unsupported upstream delete, or a remote that still lists the task on
      // the next run, would otherwise resurrect it. See dismissed_tasks.
      await db
        .insert(dismissedTasks)
        .values({
          taskSourceId: existingTask.taskSourceId,
          externalTaskId: existingTask.externalId,
        })
        .onConflictDoNothing();
    }

    // Delete the task
    await db
      .delete(tasks)
      .where(eq(tasks.id, id));

    await invalidateEntity('tasks');

    logActivity({
      userId: auth.userId,
      action: 'delete',
      entityType: 'task',
      entityId: id,
      summary: `Deleted task: ${existingTask.title}`,
    });

    // Return success response with deleted task info
    return NextResponse.json({
      message: 'Task deleted successfully',
      deletedTask: {
        id: existingTask.id,
        title: existingTask.title,
      },
    });
  } catch (error) {
    logError('Error deleting task:', error);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}
