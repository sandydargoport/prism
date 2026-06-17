import { NextRequest, NextResponse } from 'next/server';
import { getDisplayAuth } from '@/lib/auth';
import { withAuth } from '@/lib/api/withAuth';
import { db } from '@/lib/db/client';
import { tasks, users } from '@/lib/db/schema';
import { eq, desc, asc, and, lte, gte, sql } from 'drizzle-orm';
import { formatTaskRow } from '@/lib/utils/formatters';
import { createTaskSchema } from '@/lib/validations';
import { getCached } from '@/lib/cache/redis';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';


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

    const cacheKey = `tasks:${userId ?? 'all'}:${completed ?? 'any'}:${priority ?? 'any'}:${dueBefore ?? ''}:${dueAfter ?? ''}:${sort}:${order}:${limit}:${offset}`;

    const result = await getCached(cacheKey, async () => {
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
        // Incomplete tasks first, then the requested sort, then newest-first as a
        // stable tiebreaker. Without this, a household with >limit tasks (e.g. many
        // with no due date) would have its newest/active tasks sorted past the row
        // limit and silently dropped from the fetch — they'd never appear in the
        // list. The client re-sorts for display, so this only affects which rows
        // are fetched, not their on-screen order.
        .orderBy(asc(tasks.completed), sortFn(getSortColumn()), desc(tasks.createdAt))
        .limit(limit)
        .offset(offset);

      const formattedTasks = results.map((row) => formatTaskRow(row));

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return {
        tasks: formattedTasks,
        total: Number(countResult[0]?.count ?? 0),
        limit,
        offset,
      };
    }, 60);

    return NextResponse.json(result);
  } catch (error) {
    logError('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}


export async function POST(request: NextRequest) {
  return withAuth(async (auth) => {
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
          createdBy: data.createdBy || auth.userId,
          listId: data.listId || null,
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

      await invalidateEntity('tasks');

      logActivity({
        userId: auth.userId,
        action: 'create',
        entityType: 'task',
        entityId: newTask.id,
        summary: `Created task: ${data.title.trim()}`,
      });

      return NextResponse.json(formatTaskRow(taskWithUser), { status: 201 });
    } catch (error) {
      logError('Error creating task:', error);
      return NextResponse.json(
        { error: 'Failed to create task' },
        { status: 500 }
      );
    }
  }, { rateLimit: { feature: 'tasks', limit: 30, windowSeconds: 60 } });
}
