/**
 * ============================================================================
 * PRISM - Individual Task API Route
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
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
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { tasks, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth/session';

/**
 * Helper function to authenticate and get user info
 */
async function authenticateRequest(): Promise<{
  user: { id: string; role: string; name: string } | null;
  error: NextResponse | null;
}> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('prism_session')?.value;
  const userId = cookieStore.get('prism_user')?.value;

  if (!sessionToken || !userId) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }

  // Validate session token
  const sessionData = await validateSession(sessionToken);
  if (!sessionData || sessionData.userId !== userId) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      ),
    };
  }

  // Fetch the current user
  const [currentUser] = await db
    .select({ id: users.id, role: users.role, name: users.name })
    .from(users)
    .where(eq(users.id, userId));

  if (!currentUser) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      ),
    };
  }

  return { user: currentUser, error: null };
}


/**
 * ROUTE PARAMS TYPE
 * ============================================================================
 * Next.js 14 App Router provides route params as a Promise.
 * This type defines the expected shape of our dynamic route params.
 * ============================================================================
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}


/**
 * GET /api/tasks/[id]
 * ============================================================================
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
 * ============================================================================
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
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
        source: tasks.source,
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
    return NextResponse.json({
      id: taskWithUser.id,
      title: taskWithUser.title,
      description: taskWithUser.description,
      dueDate: taskWithUser.dueDate?.toISOString() || null,
      priority: taskWithUser.priority,
      category: taskWithUser.category,
      completed: taskWithUser.completed,
      completedAt: taskWithUser.completedAt?.toISOString() || null,
      source: taskWithUser.source,
      createdAt: taskWithUser.createdAt.toISOString(),
      updatedAt: taskWithUser.updatedAt.toISOString(),
      assignedTo: taskWithUser.assignedUserId
        ? {
            id: taskWithUser.assignedUserId,
            name: taskWithUser.assignedUserName!,
            color: taskWithUser.assignedUserColor!,
            avatarUrl: taskWithUser.assignedUserAvatar,
          }
        : null,
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { status: 500 }
    );
  }
}


/**
 * PATCH /api/tasks/[id]
 * ============================================================================
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
 * ============================================================================
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
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

    // ========================================================================
    // AUTHORIZATION CHECK - Children can only toggle their own tasks
    // ========================================================================
    if ('completed' in body) {
      const { user, error } = await authenticateRequest();
      if (error) return error;

      const isChild = user!.role === 'child';
      const isOwner = existingTask.createdBy === user!.id || existingTask.assignedTo === user!.id;

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
        source: tasks.source,
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

    return NextResponse.json({
      id: updatedTaskWithUser.id,
      title: updatedTaskWithUser.title,
      description: updatedTaskWithUser.description,
      dueDate: updatedTaskWithUser.dueDate?.toISOString() || null,
      priority: updatedTaskWithUser.priority,
      category: updatedTaskWithUser.category,
      completed: updatedTaskWithUser.completed,
      completedAt: updatedTaskWithUser.completedAt?.toISOString() || null,
      source: updatedTaskWithUser.source,
      createdAt: updatedTaskWithUser.createdAt.toISOString(),
      updatedAt: updatedTaskWithUser.updatedAt.toISOString(),
      assignedTo: updatedTaskWithUser.assignedUserId
        ? {
            id: updatedTaskWithUser.assignedUserId,
            name: updatedTaskWithUser.assignedUserName!,
            color: updatedTaskWithUser.assignedUserColor!,
            avatarUrl: updatedTaskWithUser.assignedUserAvatar,
          }
        : null,
    });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}


/**
 * DELETE /api/tasks/[id]
 * ============================================================================
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
 * ============================================================================
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    // ========================================================================
    // AUTHENTICATION CHECK
    // ========================================================================
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('prism_session')?.value;
    const userId = cookieStore.get('prism_user')?.value;

    if (!sessionToken || !userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Validate session token
    const sessionData = await validateSession(sessionToken);
    if (!sessionData || sessionData.userId !== userId) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // Fetch the current user to check their role
    const [currentUser] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, userId));

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    // ========================================================================
    // CHECK IF TASK EXISTS AND GET OWNERSHIP INFO
    // ========================================================================
    const [existingTask] = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        createdBy: tasks.createdBy,
        assignedTo: tasks.assignedTo,
      })
      .from(tasks)
      .where(eq(tasks.id, id));

    if (!existingTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // ========================================================================
    // AUTHORIZATION CHECK
    // ========================================================================
    const isParent = currentUser.role === 'parent';
    // A child can delete a task if they created it OR if it's assigned to them
    const isOwner = existingTask.createdBy === userId || existingTask.assignedTo === userId;

    if (!isParent && !isOwner) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this task' },
        { status: 403 }
      );
    }

    // Delete the task
    await db
      .delete(tasks)
      .where(eq(tasks.id, id));

    // Return success response with deleted task info
    return NextResponse.json({
      message: 'Task deleted successfully',
      deletedTask: {
        id: existingTask.id,
        title: existingTask.title,
      },
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}
