/**
 * Deletes-only review for task sync.
 *
 * The reconciler used to delete any synced task the provider stopped listing.
 * That is silent and unrecoverable: an outage, a revoked scope or the wrong
 * list id wiped the lot with no undo. It now flags them instead, and this is
 * where the user decides.
 *
 * GET  — list the flagged tasks.
 * POST — apply a decision to a set of them:
 *          { taskIds, action: 'delete' } → remove them, or
 *          { taskIds, action: 'keep' }   → keep as a local task the sync
 *                                          will not touch again.
 *
 * Mirrors /api/calendars/pending-deletions, with one important difference:
 * 'keep' must set syncExempt, not merely clear the link. Task sync pushes
 * local tasks UP to the provider, so a kept task with no external id would be
 * recreated on the provider it was just deleted from, and the loop would
 * repeat every five minutes. Calendar has no such push, which is why clearing
 * the id is enough there.
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { tasks, taskSources, taskLists } from '@/lib/db/schema';
import { requireAuth, requireRole, getDisplayAuth } from '@/lib/auth';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logError } from '@/lib/utils/logError';

export async function GET() {
  // A shared display is not signed in but still shows the badge, so an
  // unauthenticated read returns an empty list rather than a 401.
  const auth = await getDisplayAuth();
  if (!auth) return NextResponse.json({ pending: [], count: 0 });

  try {
    const rows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueDate: tasks.dueDate,
        completed: tasks.completed,
        provider: taskSources.provider,
        listName: taskSources.externalListName,
        prismList: taskLists.name,
        // CalDAV task rows carry no task_source_id, so the join above yields
        // nothing for them. Their origin is encoded in the external id
        // instead: caldav:<sourceId>:<uid>.
        externalId: tasks.externalId,
      })
      .from(tasks)
      .leftJoin(taskSources, eq(tasks.taskSourceId, taskSources.id))
      .leftJoin(taskLists, eq(tasks.listId, taskLists.id))
      .where(isNotNull(tasks.pendingDeletion))
      .orderBy(tasks.title);

    const providerLabel = (p: string | null, externalId: string | null) => {
      if (p === 'google_tasks') return 'Google Tasks';
      if (p === 'microsoft_todo') return 'Microsoft To Do';
      if (externalId?.startsWith('caldav:')) return 'Reminders (CalDAV)';
      return p ?? 'its source';
    };

    return NextResponse.json({
      pending: rows.map((r) => ({
        id: r.id,
        title: r.title,
        dueDate: r.dueDate,
        completed: r.completed,
        source: r.listName
          ? `${providerLabel(r.provider, r.externalId)} — ${r.listName}`
          : providerLabel(r.provider, r.externalId),
        list: r.prismList,
      })),
      count: rows.length,
    });
  } catch (error) {
    logError('Error listing pending task deletions:', error);
    return NextResponse.json({ error: 'Failed to load pending deletions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canDeleteTasks');
  if (forbidden) return forbidden;

  try {
    const body = await request.json();
    const taskIds: string[] = Array.isArray(body.taskIds)
      ? body.taskIds.filter((x: unknown) => typeof x === 'string')
      : [];
    const action = body.action === 'keep' ? 'keep' : body.action === 'delete' ? 'delete' : null;

    if (!action) return NextResponse.json({ error: "action must be 'delete' or 'keep'." }, { status: 400 });
    if (taskIds.length === 0) return NextResponse.json({ error: 'No tasks selected.' }, { status: 400 });

    // Only act on tasks that are actually flagged, so stale ids from a cached
    // page are no-ops rather than deletions.
    const targets = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(inArray(tasks.id, taskIds), isNotNull(tasks.pendingDeletion)));

    const ids = targets.map((t) => t.id);
    if (ids.length === 0) return NextResponse.json({ applied: 0, action });

    if (action === 'delete') {
      // No tombstone here, deliberately. These tasks are already absent from
      // the provider, so a tombstone would be pruned on the next run in the
      // ordinary case — and in the case where it survives, the task came back
      // and the tombstone would hide a live task permanently, with no UI to
      // clear it. The grace window and the mass-delete guard are what protect
      // against a hiccup; a tombstone here would only add a way to lose data.
      await db.delete(tasks).where(inArray(tasks.id, ids));
    } else {
      // Keep: hand the task to Prism permanently. syncExempt is the part that
      // matters — without it the reconciler would push this straight back to
      // the provider as a new task.
      await db
        .update(tasks)
        .set({
          pendingDeletion: null,
          syncExempt: true,
          taskSourceId: null,
          externalId: null,
          lastSynced: null,
        })
        .where(inArray(tasks.id, ids));
    }

    await invalidateEntity('tasks');
    return NextResponse.json({ applied: ids.length, action });
  } catch (error) {
    logError('Error applying pending task deletions:', error);
    return NextResponse.json({ error: 'Failed to apply.' }, { status: 500 });
  }
}
