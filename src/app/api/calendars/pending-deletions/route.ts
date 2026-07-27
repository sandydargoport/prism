/**
 * Deletes-only review for calendar sync (#171 Stage 3).
 *
 * GET  — list synced events flagged pending-deletion (the source dropped them;
 *        sync held the delete for review instead of applying it silently).
 * POST — apply the user's decision for a set of events:
 *          { eventIds, action: 'delete' }  → remove them (+ tombstone), or
 *          { eventIds, action: 'keep' }    → detach to a permanent local event
 *                                            so the next sync won't re-flag it.
 *
 * Reviewing/applying requires delete permission — on a shared display the badge
 * shows but only an authenticated parent can action it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { events, calendarSources, dismissedEvents } from '@/lib/db/schema';
import { requireAuth, requireRole, getDisplayAuth } from '@/lib/auth';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logError } from '@/lib/utils/logError';

export async function GET() {
  const auth = await getDisplayAuth();
  if (!auth) return NextResponse.json({ pending: [], count: 0 });

  try {
    const rows = await db
      .select({
        id: events.id,
        title: events.title,
        startTime: events.startTime,
        allDay: events.allDay,
        eventColor: events.color,
        provider: calendarSources.provider,
        displayName: calendarSources.displayName,
        dashboardName: calendarSources.dashboardCalendarName,
        calColor: calendarSources.color,
      })
      .from(events)
      .leftJoin(calendarSources, eq(events.calendarSourceId, calendarSources.id))
      .where(isNotNull(events.pendingDeletion))
      .orderBy(events.startTime);

    const providerLabel = (p: string | null) =>
      p === 'google' ? 'Google' : p === 'caldav' ? 'iCloud/CalDAV' : p === 'ical' ? 'iCal feed' : (p ?? 'source');

    return NextResponse.json({
      pending: rows.map((r) => ({
        id: r.id,
        title: r.title,
        startTime: r.startTime,
        allDay: r.allDay,
        // The source calendar this event came from, shown neatly in the splash.
        sourceCalendar: r.displayName || r.dashboardName || providerLabel(r.provider),
        provider: providerLabel(r.provider),
        color: r.calColor || r.eventColor || null,
      })),
      count: rows.length,
    });
  } catch (error) {
    logError('Error listing pending deletions:', error);
    return NextResponse.json({ error: 'Failed to load pending deletions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canDeleteAnyEvent');
  if (forbidden) return forbidden;

  try {
    const body = await request.json();
    const eventIds: string[] = Array.isArray(body.eventIds) ? body.eventIds.filter((x: unknown) => typeof x === 'string') : [];
    const action = body.action === 'keep' ? 'keep' : body.action === 'delete' ? 'delete' : null;

    if (!action) return NextResponse.json({ error: "action must be 'delete' or 'keep'." }, { status: 400 });
    if (eventIds.length === 0) return NextResponse.json({ error: 'No events selected.' }, { status: 400 });

    // Only act on events that are actually pending (guard against stale ids).
    const targets = await db
      .select({ id: events.id, calendarSourceId: events.calendarSourceId, externalEventId: events.externalEventId })
      .from(events)
      .where(and(inArray(events.id, eventIds), isNotNull(events.pendingDeletion)));

    if (action === 'delete') {
      // Tombstone (so it can't be re-added) then delete.
      for (const t of targets) {
        if (t.calendarSourceId && t.externalEventId) {
          await db
            .insert(dismissedEvents)
            .values({ calendarSourceId: t.calendarSourceId, externalEventId: t.externalEventId })
            .onConflictDoNothing();
        }
      }
      await db.delete(events).where(inArray(events.id, targets.map((t) => t.id)));
    } else {
      // Keep: detach from the source (drop externalEventId) so it becomes a
      // permanent local event the sync never touches again, and clear the flag.
      await db
        .update(events)
        .set({ pendingDeletion: null, externalEventId: null, lastSynced: null })
        .where(inArray(events.id, targets.map((t) => t.id)));
    }

    await invalidateEntity('events');
    return NextResponse.json({ applied: targets.length, action });
  } catch (error) {
    logError('Error applying pending deletions:', error);
    return NextResponse.json({ error: 'Failed to apply.' }, { status: 500 });
  }
}
