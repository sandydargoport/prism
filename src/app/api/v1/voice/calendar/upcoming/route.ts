import { type NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { voiceOk, voiceError } from '@/lib/api/voiceResponse';
import { phraseUpcomingEvents } from '@/lib/api/voicePhrases';
import { db } from '@/lib/db/client';
import { events } from '@/lib/db/schema';
import { gte, asc } from 'drizzle-orm';
import { logError } from '@/lib/utils/logError';

/**
 * GET /api/v1/voice/calendar/upcoming?count=3
 *
 * Returns the next N events (count clamped to 1..10, default 3).
 */
export async function GET(request: NextRequest) {
  return withAuth(async () => {
    try {
      const url = new URL(request.url);
      const rawCount = Number(url.searchParams.get('count') ?? '3');
      const count = Number.isFinite(rawCount) ? Math.min(Math.max(Math.trunc(rawCount), 1), 10) : 3;

      const now = new Date();
      const upcoming = await db
        .select({
          id: events.id,
          title: events.title,
          startTime: events.startTime,
          endTime: events.endTime,
          allDay: events.allDay,
          location: events.location,
        })
        .from(events)
        .where(gte(events.startTime, now))
        .orderBy(asc(events.startTime))
        .limit(count);

      const spoken = phraseUpcomingEvents(upcoming, now);

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
