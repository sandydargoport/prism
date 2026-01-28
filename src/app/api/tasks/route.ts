/**
 * ============================================================================
 * PRISM - Tasks API Route
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Handles HTTP requests for task operations (create, list).
 * This is the main entry point for task-related API calls.
 *
 * ENDPOINT: /api/tasks
 * - GET:  List all tasks (with optional filters)
 * - POST: Create a new task
 *
 * NEXT.JS APP ROUTER API ROUTES:
 * In Next.js 14, API routes are defined using the file system:
 * - src/app/api/tasks/route.ts → /api/tasks
 * - src/app/api/tasks/[id]/route.ts → /api/tasks/:id
 *
 * Each file exports HTTP method handlers: GET, POST, PUT, PATCH, DELETE
 *
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { tasks, users } from '@/lib/db/schema';
import { eq, desc, asc, and, isNull, lte, gte } from 'drizzle-orm';


/**
 * TASK RESPONSE TYPE
 * ============================================================================
 * The shape of task data returned by the API.
 * This includes the joined user data for the assigned person.
 * ============================================================================
 */
interface TaskResponse {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: 'high' | 'medium' | 'low' | null;
  category: string | null;
  completed: boolean;
  completedAt: string | null;
  source: string;
  assignedTo: {
    id: string;
    name: string;
    color: string;
    avatarUrl: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}


/**
 * GET /api/tasks
 * ============================================================================
 * Lists all tasks with optional filtering.
 *
 * QUERY PARAMETERS:
 * - userId:      Filter by assigned user ID
 * - completed:   Filter by completion status ("true" or "false")
 * - priority:    Filter by priority ("high", "medium", "low")
 * - dueBefore:   Filter tasks due before this date (ISO string)
 * - dueAfter:    Filter tasks due after this date (ISO string)
 * - limit:       Maximum number of tasks to return (default: 50)
 * - offset:      Number of tasks to skip (for pagination)
 * - sort:        Sort field ("dueDate", "priority", "createdAt")
 * - order:       Sort order ("asc" or "desc", default: "asc")
 *
 * EXAMPLE REQUESTS:
 * - GET /api/tasks                        → All tasks
 * - GET /api/tasks?userId=abc123          → Tasks for specific user
 * - GET /api/tasks?completed=false        → Only incomplete tasks
 * - GET /api/tasks?priority=high          → Only high priority tasks
 * - GET /api/tasks?dueBefore=2024-01-31   → Tasks due before date
 *
 * RESPONSE:
 * {
 *   tasks: TaskResponse[],
 *   total: number,
 *   limit: number,
 *   offset: number
 * }
 * ============================================================================
 */
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters from URL
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const completed = searchParams.get('completed');
    const priority = searchParams.get('priority');
    const dueBefore = searchParams.get('dueBefore');
    const dueAfter = searchParams.get('dueAfter');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const sort = searchParams.get('sort') || 'dueDate';
    const order = searchParams.get('order') || 'asc';

    // Build filter conditions
    // We use Drizzle's 'and' to combine multiple conditions
    const conditions = [];

    if (userId) {
      conditions.push(eq(tasks.assignedTo, userId));
    }

    if (completed !== null) {
      conditions.push(eq(tasks.completed, completed === 'true'));
    }

    if (priority) {
      conditions.push(eq(tasks.priority, priority as 'high' | 'medium' | 'low'));
    }

    if (dueBefore) {
      conditions.push(lte(tasks.dueDate, new Date(dueBefore)));
    }

    if (dueAfter) {
      conditions.push(gte(tasks.dueDate, new Date(dueAfter)));
    }

    // Determine sort column and order
    const getSortColumn = () => {
      switch (sort) {
        case 'dueDate': return tasks.dueDate;
        case 'priority': return tasks.priority;
        case 'createdAt': return tasks.createdAt;
        case 'title': return tasks.title;
        default: return tasks.dueDate;
      }
    };

    const sortFn = order === 'desc' ? desc : asc;

    // Execute query with joins
    // We join with users table to get assigned user details
    const results = await db
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
        // Joined user data
        assignedUserId: users.id,
        assignedUserName: users.name,
        assignedUserColor: users.color,
        assignedUserAvatar: users.avatarUrl,
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assignedTo, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sortFn(getSortColumn()))
      .limit(limit)
      .offset(offset);

    // Transform results to include nested assignedTo object
    const formattedTasks: TaskResponse[] = results.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      dueDate: row.dueDate?.toISOString() || null,
      priority: row.priority,
      category: row.category,
      completed: row.completed,
      completedAt: row.completedAt?.toISOString() || null,
      source: row.source,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      assignedTo: row.assignedUserId
        ? {
            id: row.assignedUserId,
            name: row.assignedUserName!,
            color: row.assignedUserColor!,
            avatarUrl: row.assignedUserAvatar,
          }
        : null,
    }));

    // Get total count for pagination
    // This is a separate query because COUNT with LIMIT doesn't give total
    const countResult = await db
      .select({ count: tasks.id })
      .from(tasks)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return NextResponse.json({
      tasks: formattedTasks,
      total: countResult.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}


/**
 * POST /api/tasks
 * ============================================================================
 * Creates a new task.
 *
 * REQUEST BODY:
 * {
 *   title: string (required)
 *   description?: string
 *   assignedTo?: string (user ID)
 *   dueDate?: string (ISO date string)
 *   priority?: "high" | "medium" | "low"
 *   category?: string
 *   createdBy?: string (user ID of creator)
 * }
 *
 * RESPONSE:
 * - 201: Task created successfully, returns the new task
 * - 400: Invalid request body
 * - 500: Server error
 *
 * EXAMPLE REQUEST:
 * POST /api/tasks
 * {
 *   "title": "Buy groceries",
 *   "assignedTo": "user-uuid",
 *   "dueDate": "2024-01-31T00:00:00Z",
 *   "priority": "medium"
 * }
 * ============================================================================
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.title || typeof body.title !== 'string') {
      return NextResponse.json(
        { error: 'Title is required and must be a string' },
        { status: 400 }
      );
    }

    // Validate priority if provided
    if (body.priority && !['high', 'medium', 'low'].includes(body.priority)) {
      return NextResponse.json(
        { error: 'Priority must be "high", "medium", or "low"' },
        { status: 400 }
      );
    }

    // Validate dueDate if provided
    let dueDate: Date | null = null;
    if (body.dueDate) {
      dueDate = new Date(body.dueDate);
      if (isNaN(dueDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid dueDate format. Use ISO 8601 format.' },
          { status: 400 }
        );
      }
    }

    // Insert the new task
    const [newTask] = await db
      .insert(tasks)
      .values({
        title: body.title.trim(),
        description: body.description?.trim() || null,
        assignedTo: body.assignedTo || null,
        dueDate: dueDate,
        priority: body.priority || null,
        category: body.category?.trim() || null,
        createdBy: body.createdBy || null,
        source: 'internal',
        completed: false,
      })
      .returning();

    if (!newTask) {
      return NextResponse.json(
        { error: 'Failed to create task' },
        { status: 500 }
      );
    }

    // Fetch the complete task with user data
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
      .where(eq(tasks.id, newTask.id));

    if (!taskWithUser) {
      return NextResponse.json(
        { error: 'Task created but could not be retrieved' },
        { status: 500 }
      );
    }

    // Format response
    const response: TaskResponse = {
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
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
