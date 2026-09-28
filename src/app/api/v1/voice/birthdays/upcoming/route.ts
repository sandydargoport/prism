import { type NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { voiceOk, voiceError } from '@/lib/api/voiceResponse';
import { phraseUpcomingBirthdays } from '@/lib/api/voicePhrases';
import { db } from '@/lib/db/client';
import { birthdays } from '@/lib/db/schema';
import { logError } from '@/lib/utils/logError';
import { getHouseholdTimezone } from '@/lib/householdTimezone';
import { todayKey } from '@/lib/utils/zonedDate';
import { birthdayOccurrence } from '@/lib/utils/birthdayOccurrence';

/**
 * GET /api/v1/voice/birthdays/upcoming?days=N
 *
 * Returns upcoming birthdays in the next N days (default 30, clamped 1..365).
 * "Today" is the household's calendar date. Birthdays with no known year
 * (stored as 1904) have a null `turning`.
 */
export async function GET(request: NextRequest) {
  return withAuth(async () => {
    try {
      const url = new URL(request.url);
      const raw = parseInt(url.searchParams.get('days') ?? '30', 10);
      const days = Number.isFinite(raw) ? Math.min(365, Math.max(1, raw)) : 30;

      const all = await db.select().from(birthdays);

      const today = todayKey(await getHouseholdTimezone());

      const upcoming = all
        .map((b) => {
          const occurrence = birthdayOccurrence(b.birthDate, today);
          if (!occurrence) return null;
          return {
            id: b.id,
            name: b.name,
            eventType: b.eventType,
            next: occurrence.nextBirthday,
            daysUntil: occurrence.daysUntil,
            turning: occurrence.age,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .filter((x) => x.daysUntil <= days)
        .sort((a, b) => a.daysUntil - b.daysUntil);

      const spoken = phraseUpcomingBirthdays(upcoming);

      return voiceOk(spoken, {
        count: upcoming.length,
        birthdays: upcoming.map((u) => ({
          id: u.id,
          name: u.name,
          eventType: u.eventType,
          nextOccurrence: u.next,
          turning: u.turning,
        })),
      });
    } catch (error) {
      logError('Voice API: birthdays/upcoming failed', error);
      return voiceError("Sorry, I had trouble reading the birthday list.", 500);
    }
  }, {
    tokenScope: 'voice',
    rateLimit: { feature: 'voice-api', limit: 60, windowSeconds: 60 },
  });
}
