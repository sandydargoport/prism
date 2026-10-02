/**
 * Events hidden in Prism (#592), for the Settings > Calendars list that
 * unhides them: a hidden event can no longer be clicked anywhere else.
 *
 *   GET → { hidden: [{ id, title, startTime, allDay, calendarName }] },
 *         most recently hidden first.
 *
 * Unhiding is DELETE /api/events/[id]/hidden. Parents only.
 */

import { NextResponse } from 'next/server';
import { desc, eq, isNotNull } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { events, calendarSources } from '@/lib/db/schema';
import { logError } from '@/lib/utils/logError';

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canEditAnyEvent');
  if (forbidden) return forbidden;

  try {
    const rows = await db
      .select({
        id: events.id,
        title: events.title,
        startTime: events.startTime,
        allDay: events.allDay,
        dashboardName: calendarSources.dashboardCalendarName,
        displayName: calendarSources.displayName,
      })
      .from(events)
      .leftJoin(calendarSources, eq(events.calendarSourceId, calendarSources.id))
      .where(isNotNull(events.hiddenAt))
      .orderBy(desc(events.hiddenAt));

    return NextResponse.json({
      hidden: rows.map((r) => ({
        id: r.id,
        title: r.title,
        startTime: r.startTime,
        allDay: r.allDay,
        calendarName: r.dashboardName || r.displayName || null,
      })),
    });
  } catch (error) {
    logError('Error listing hidden events:', error);
    return NextResponse.json({ error: 'Failed to load hidden events' }, { status: 500 });
  }
}
