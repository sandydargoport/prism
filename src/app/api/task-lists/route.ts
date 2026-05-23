import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { taskLists, tasks, calendarSources } from '@/lib/db/schema';
import { eq, asc, sql } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import { getCached } from '@/lib/cache/redis';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logError } from '@/lib/utils/logError';

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const lists = await getCached(
      'task-lists:all',
      async () => db
        .select({
          id: taskLists.id,
          name: taskLists.name,
          color: taskLists.color,
          sortOrder: taskLists.sortOrder,
          createdBy: taskLists.createdBy,
          createdAt: taskLists.createdAt,
          updatedAt: taskLists.updatedAt,
          // Derived: which external system populated this list, if any.
          // 'caldav' when either:
          //   (a) at least one task in the list has a caldav-prefixed externalId, OR
          //   (b) a calendar_source's syncErrors JSON has taskListId pointing here.
          // Checking (b) catches CalDAV-backed lists whose only tasks were
          // Apple's placeholder VTODOs (now filtered out by sync) — those
          // lists are empty but still legitimately CalDAV-sourced.
          linkedProvider: sql<string | null>`(
            CASE
              WHEN EXISTS (
                SELECT 1 FROM ${tasks}
                WHERE ${tasks.listId} = ${taskLists.id}
                  AND ${tasks.externalId} LIKE 'caldav:%'
              ) THEN 'caldav'
              WHEN EXISTS (
                SELECT 1 FROM ${calendarSources}
                WHERE ${calendarSources.provider} = 'caldav'
                  AND ${calendarSources.syncErrors}->>'taskListId' = ${taskLists.id}::text
              ) THEN 'caldav'
              ELSE NULL
            END
          )`,
        })
        .from(taskLists)
        .orderBy(asc(taskLists.sortOrder), asc(taskLists.name)),
      300
    );

    return NextResponse.json(lists);
  } catch (error) {
    logError('Error fetching task lists:', error);
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

    await invalidateEntity('task-lists');

    return NextResponse.json(newList, { status: 201 });
  } catch (error) {
    logError('Error creating task list:', error);
    return NextResponse.json(
      { error: 'Failed to create task list' },
      { status: 500 }
    );
  }
}
