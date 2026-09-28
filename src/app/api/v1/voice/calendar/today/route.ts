import { withAuth } from '@/lib/api/withAuth';
import { voiceOk, voiceError } from '@/lib/api/voiceResponse';
import { phraseEventList } from '@/lib/api/voicePhrases';
import { db } from '@/lib/db/client';
import { events } from '@/lib/db/schema';
import { and, eq, gt, lt, lte, or, asc, desc } from 'drizzle-orm';
import { logError } from '@/lib/utils/logError';
import { getHouseholdTimezone } from '@/lib/householdTimezone';
import { dateOnlyToFloatingUtc, dayWindowUtc, todayKey } from '@/lib/utils/zonedDate';

/**
 * GET /api/v1/voice/calendar/today
 *
 * Returns today's events, in the household time zone, shaped for
 * natural-language playback.
 * Auth: any valid session OR API token. Rate-limited per caller.
 */
export async function GET() {
  return withAuth(async () => {
    try {
      const timeZone = await getHouseholdTimezone();
      const today = todayKey(timeZone);
      // Timed events are instants: take those overlapping the household's
      // day. All-day events are stored as UTC midnight of their dates with
      // an exclusive end, so they are matched by date, not by that window,
      // which would drop today's west of UTC and pick up tomorrow's.
      const { start: dayStart, end: dayEnd } = dayWindowUtc(today, timeZone);
      const floatingToday = dateOnlyToFloatingUtc(today);

      const todayEvents = await db
        .select({
          id: events.id,
          title: events.title,
          startTime: events.startTime,
          endTime: events.endTime,
          allDay: events.allDay,
          location: events.location,
        })
        .from(events)
        .where(or(
          and(eq(events.allDay, false), lt(events.startTime, dayEnd), gt(events.endTime, dayStart)),
          and(eq(events.allDay, true), lte(events.startTime, floatingToday), gt(events.endTime, floatingToday)),
        ))
        // All-day first, then timed in start order.
        .orderBy(desc(events.allDay), asc(events.startTime));

      const spoken = phraseEventList(todayEvents, timeZone);

      return voiceOk(spoken, {
        count: todayEvents.length,
        events: todayEvents.map((e) => ({
          id: e.id,
          title: e.title,
          startTime: e.startTime.toISOString(),
          endTime: e.endTime.toISOString(),
          allDay: e.allDay,
          location: e.location,
        })),
      });
    } catch (error) {
      logError('Voice API: calendar/today failed', error);
      return voiceError('Sorry, I had trouble reading your calendar.', 500);
    }
  }, {
    tokenScope: 'voice',
    rateLimit: { feature: 'voice-api', limit: 60, windowSeconds: 60 },
  });
}

