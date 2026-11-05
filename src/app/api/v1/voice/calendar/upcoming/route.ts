import { type NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { voiceOk, voiceError } from '@/lib/api/voiceResponse';
import { phraseUpcomingEvents } from '@/lib/api/voicePhrases';
import { db } from '@/lib/db/client';
import { events } from '@/lib/db/schema';
import { and, eq, gte, lt, asc, isNotNull, isNull, or } from 'drizzle-orm';
import { expandSeries, occurrenceId } from '@/lib/utils/recurrence';
import { visibleEventsCondition } from '@/lib/services/hiddenEvents';
import { logError } from '@/lib/utils/logError';
import { getHouseholdTimezone } from '@/lib/householdTimezone';
import { addDaysToKey, dateOnlyToFloatingUtc, floatingUtcToDateKey, todayKey, zonedWallTimeToUtc } from '@/lib/utils/zonedDate';

/**
 * GET /api/v1/voice/calendar/upcoming?count=3
 *
 * Returns the next N events (count clamped to 1..10, default 3): timed events
 * that have not started, and all-day events from tomorrow on (today's has
 * already begun), in the household time zone.
 */
export async function GET(request: NextRequest) {
  return withAuth(async () => {
    try {
      const url = new URL(request.url);
      const rawCount = Number(url.searchParams.get('count') ?? '3');
      const count = Number.isFinite(rawCount) ? Math.min(Math.max(Math.trunc(rawCount), 1), 10) : 3;

      const now = new Date();
      const timeZone = await getHouseholdTimezone();
      const tomorrow = addDaysToKey(todayKey(timeZone, now), 1);
      const columns = {
        id: events.id,
        title: events.title,
        startTime: events.startTime,
        endTime: events.endTime,
        allDay: events.allDay,
        location: events.location,
      };
      // A repeating event made in Prism is one row at its first occurrence
      // (#816): it is left out of the plain queries and expanded instead, over
      // the coming year, so one that began before now still comes up.
      const notSeries = or(isNull(events.recurrenceRule), isNotNull(events.seriesKey));
      const horizon = new Date(now.getTime() + 366 * 86_400_000);
      const firstAllDay = dateOnlyToFloatingUtc(tomorrow);
      const [timed, allDay, seriesRows] = await Promise.all([
        db.select(columns).from(events)
          .where(and(eq(events.allDay, false), visibleEventsCondition(), notSeries, gte(events.startTime, now)))
          .orderBy(asc(events.startTime)).limit(count),
        db.select(columns).from(events)
          .where(and(eq(events.allDay, true), visibleEventsCondition(), notSeries, gte(events.startTime, firstAllDay)))
          .orderBy(asc(events.startTime)).limit(count),
        db.select({ ...columns, recurrenceRule: events.recurrenceRule }).from(events)
          .where(and(visibleEventsCondition(), isNotNull(events.recurrenceRule), isNull(events.seriesKey), lt(events.startTime, horizon))),
      ]);
      const occurrences = seriesRows.flatMap(({ recurrenceRule, ...row }) =>
        expandSeries({ ...row, recurrenceRule }, now, horizon, timeZone)
          .filter(({ start }) => (row.allDay ? start >= firstAllDay : start >= now))
          .slice(0, count)
          .map(({ start, end }) => ({ ...row, id: occurrenceId(row.id, start), startTime: start, endTime: end })));

      // An all-day event is stored as UTC midnight of its date; it begins at
      // the household's midnight, which is what it sorts by.
      const begins = (e: (typeof timed)[number]) => e.allDay
        ? zonedWallTimeToUtc(floatingUtcToDateKey(e.startTime), '00:00', timeZone).getTime()
        : e.startTime.getTime();
      const upcoming = [...timed, ...allDay, ...occurrences]
        .sort((a, b) => begins(a) - begins(b))
        .slice(0, count);

      const spoken = phraseUpcomingEvents(upcoming, now, timeZone);

      return voiceOk(spoken, {
        count: upcoming.length,
        events: upcoming.map((e) => ({
          id: e.id,
          title: e.title,
          startTime: e.startTime.toISOString(),
          endTime: e.endTime.toISOString(),
          allDay: e.allDay,
          location: e.location,
        })),
      });
    } catch (error) {
      logError('Voice API: calendar/upcoming failed', error);
      return voiceError('Sorry, I had trouble reading your calendar.', 500);
    }
  }, {
    tokenScope: 'voice',
    rateLimit: { feature: 'voice-api', limit: 60, windowSeconds: 60 },
  });
}
