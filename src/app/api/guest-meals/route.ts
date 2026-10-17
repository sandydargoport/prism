/**
 * GET /api/guest-meals
 *
 * Today's meal plan for the Babysitter Mode screen (#638), so the sitter knows
 * what to make. Like /api/guest-notes, the mode is the permission: there is no
 * login or PIN, and nothing is returned while Babysitter Mode is off.
 *
 * Anyone who can reach /babysitter can read this while the mode is on, so it
 * carries only the meal name and its slot, for today only. Recipes,
 * ingredients, descriptions, who cooked it and every other day stay behind
 * the family's own /api/meals.
 *
 * "Today" is the household's date (see householdTimezone.ts), matched on the
 * meal's absolute `date`, so it does not depend on the server's zone or on
 * which weekday the household's week starts.
 *
 * RESPONSE:
 * - 200: { date: "YYYY-MM-DD", meals: [{ name, mealType }] }, in day order
 * - 403: Babysitter Mode is off
 */

import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { meals } from '@/lib/db/schema';
import { getBabysitterModeState } from '@/lib/services/babysitterMode';
import { getHouseholdTimezone } from '@/lib/householdTimezone';
import { todayKey } from '@/lib/utils/zonedDate';
import { getCached } from '@/lib/cache/redis';
import { logError } from '@/lib/utils/logError';

type GuestMeal = {
  name: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
};

/** The order the day happens in, which is the order a sitter needs. */
const SLOT_ORDER: Record<GuestMeal['mealType'], number> = {
  breakfast: 0,
  lunch: 1,
  snack: 2,
  dinner: 3,
};

export async function GET() {
  try {
    // Checked on every request and never cached, so turning the mode off
    // closes this at once rather than when a cache entry expires.
    const mode = await getBabysitterModeState();
    if (!mode.enabled) {
      return NextResponse.json(
        { error: 'Babysitter Mode is off.' },
        { status: 403 }
      );
    }

    const date = todayKey(await getHouseholdTimezone());

    // Under the meals: prefix, so invalidateEntity('meals') after any meal
    // write clears this too.
    const todays = await getCached(
      `meals:guest:${date}`,
      async () => {
        const rows = await db
          .select({ name: meals.name, mealType: meals.mealType })
          .from(meals)
          .where(eq(meals.date, date));

        return rows
          .map((row): GuestMeal => ({ name: row.name, mealType: row.mealType }))
          .sort(
            (a, b) =>
              (SLOT_ORDER[a.mealType] ?? 9) - (SLOT_ORDER[b.mealType] ?? 9) ||
              a.name.localeCompare(b.name)
          );
      },
      300
    );

    return NextResponse.json({ date, meals: todays });
  } catch (error) {
    logError("Error fetching today's meals for Babysitter Mode:", error);
    return NextResponse.json({ error: 'Failed to fetch meals' }, { status: 500 });
  }
}
