import { withAuth } from '@/lib/api/withAuth';
import { voiceOk, voiceError } from '@/lib/api/voiceResponse';
import { phraseTodayMeals } from '@/lib/api/voicePhrases';
import { db } from '@/lib/db/client';
import { meals } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { logError } from '@/lib/utils/logError';
import { getHouseholdTimezone } from '@/lib/householdTimezone';
import { todayKey } from '@/lib/utils/zonedDate';

/**
 * GET /api/v1/voice/meals/today
 *
 * Returns today's planned meals (breakfast, lunch, dinner, snack), ordered.
 * "Today" is the household's date, and meals match on their absolute `date`,
 * so the result does not depend on the server's zone or on which weekday the
 * household's week starts.
 */
export async function GET() {
  return withAuth(async () => {
    try {
      const today = todayKey(await getHouseholdTimezone());

      const rows = await db
        .select({
          id: meals.id,
          name: meals.name,
          mealType: meals.mealType,
          mealTime: meals.mealTime,
        })
        .from(meals)
        .where(eq(meals.date, today));

      // Order by mealType (breakfast → lunch → dinner → snack) for spoken output.
      const order: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
      rows.sort((a, b) => (order[a.mealType] ?? 99) - (order[b.mealType] ?? 99));

      const spoken = phraseTodayMeals(rows);

      return voiceOk(spoken, {
        count: rows.length,
        meals: rows,
      });
    } catch (error) {
      logError('Voice API: meals/today failed', error);
      return voiceError("Sorry, I had trouble reading the meal plan.", 500);
    }
  }, {
    tokenScope: 'voice',
    rateLimit: { feature: 'voice-api', limit: 60, windowSeconds: 60 },
  });
}
