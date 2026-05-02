import { withAuth } from '@/lib/api/withAuth';
import { voiceOk, voiceError } from '@/lib/api/voiceResponse';
import { phraseEventList } from '@/lib/api/voicePhrases';
import { db } from '@/lib/db/client';
import { events } from '@/lib/db/schema';
import { and, gte, lt, asc } from 'drizzle-orm';
import { logError } from '@/lib/utils/logError';

/**
 * GET /api/v1/voice/calendar/today
 *
 * Returns today's events shaped for natural-language playback.
 * Auth: any valid session OR API token. Rate-limited per caller.
 */
export async function GET() {
  return withAuth(async () => {
    try {
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

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
        .where(and(gte(events.startTime, dayStart), lt(events.startTime, dayEnd)))
        .orderBy(asc(events.startTime));

      const spoken = phraseEventList(todayEvents);

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
    rateLimit: { feature: 'voice-api', limit: 60, windowSeconds: 60 },
  });
}

