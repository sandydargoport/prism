import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { tasks, users } from '@/lib/db/schema';
import { eq, desc, asc, and, lte, gte, sql } from 'drizzle-orm';
import { formatTaskRow } from '@/lib/utils/formatters';
import { createTaskSchema } from '@/lib/validations';
import { invalidateCache } from '@/lib/cache/redis';


export async function GET(request: NextRequest) {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ tasks: [], total: 0, limit: 50, offset: 0 });
  }

  try {
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
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sortFn(getSortColumn()))
      .limit(limit)
      .offset(offset);

    const formattedTasks = results.map((row) => formatTaskRow(row));

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return NextResponse.json({
      tasks: formattedTasks,
      total: Number(countResult[0]?.count ?? 0),
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


export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { rateLimitGuard } = await import('@/lib/cache/rateLimit');
  const limited = await rateLimitGuard(auth.userId, 'tasks', 30, 60);
  if (limited) return limited;

  try {
    const body = await request.json();

    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const [newTask] = await db
      .insert(tasks)
      .values({
        title: data.title.trim(),
        description: data.description?.trim() || null,
        assignedTo: data.assignedTo || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        priority: data.priority || null,
        category: data.category?.trim() || null,
        createdBy: data.createdBy || null,
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
      .where(eq(tasks.id, newTask.id));

    if (!taskWithUser) {
      return NextResponse.json(
        { error: 'Task created but could not be retrieved' },
        { status: 500 }
      );
    }

    await invalidateCache('tasks:*');

    return NextResponse.json(formatTaskRow(taskWithUser), { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
