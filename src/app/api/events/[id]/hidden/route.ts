/**
 * Hide an event in Prism without deleting it (#592).
 *
 *   PUT                → hide this event. It stays in its source calendar and
 *                        in the database; every read path leaves it out, and
 *                        no sync unhides it.
 *   PUT ?scope=series  → hide every occurrence of its recurring series,
 *                        including ones that sync in later. Answers 400 for
 *                        an event with no series. Returns { seriesId }, which
 *                        DELETE /api/events/hidden-series/[seriesId] undoes.
 *   DELETE             → show this event again (single hide only).
 *
 * Parents only (canEditAnyEvent), whoever created the event. Nothing is sent
 * to Google or CalDAV.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { events, hiddenEventSeries } from '@/lib/db/schema';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';
import { parseEventId } from '@/lib/utils/recurrence';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function hideSeries(id: string, userId: string) {
  const [event] = await db
    .select({ title: events.title, calendarSourceId: events.calendarSourceId, seriesKey: events.seriesKey })
    .from(events)
    .where(eq(events.id, id));

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (!event.calendarSourceId || !event.seriesKey) {
    return NextResponse.json({ error: 'This event is not part of a series' }, { status: 400 });
  }

  // Hiding a series that is already hidden just refreshes its title, so the
  // insert always returns the row's id.
  const [series] = await db
    .insert(hiddenEventSeries)
    .values({ calendarSourceId: event.calendarSourceId, seriesKey: event.seriesKey, title: event.title })
    .onConflictDoUpdate({
      target: [hiddenEventSeries.calendarSourceId, hiddenEventSeries.seriesKey],
      set: { title: event.title },
    })
    .returning({ id: hiddenEventSeries.id });

  await invalidateEntity('events');

  logActivity({
    userId,
    action: 'update',
    entityType: 'event',
    entityId: id,
    summary: `Hid every event in the series: ${event.title}`,
  });

  return NextResponse.json({ id, hidden: true, seriesId: series?.id ?? null });
}

async function setHidden(request: NextRequest, { params }: RouteParams, hidden: boolean) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canEditAnyEvent');
  if (forbidden) return forbidden;

  try {
    const { rowId: id } = parseEventId((await params).id);
    if (hidden && request.nextUrl.searchParams.get('scope') === 'series') {
      return await hideSeries(id, auth.userId);
    }

    const [updated] = await db
      .update(events)
      .set({ hiddenAt: hidden ? new Date() : null })
      .where(eq(events.id, id))
      .returning({ id: events.id, title: events.title });

    if (!updated) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    await invalidateEntity('events');

    logActivity({
      userId: auth.userId,
      action: 'update',
      entityType: 'event',
      entityId: updated.id,
      summary: `${hidden ? 'Hid' : 'Unhid'} event: ${updated.title}`,
    });

    return NextResponse.json({ id: updated.id, hidden });
  } catch (error) {
    logError(`Error ${hidden ? 'hiding' : 'unhiding'} event:`, error);
    return NextResponse.json(
      { error: hidden ? 'Failed to hide event' : 'Failed to unhide event' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, ctx: RouteParams) {
  return setHidden(request, ctx, true);
}

export async function DELETE(request: NextRequest, ctx: RouteParams) {
  return setHidden(request, ctx, false);
}
