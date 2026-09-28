import { NextResponse } from 'next/server';
import { getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { users, choreCompletions, settings } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { getCached } from '@/lib/cache/redis';
import { logError } from '@/lib/utils/logError';
import { getHouseholdTimezone } from '@/lib/householdTimezone';
import { currentPeriodStarts } from '@/lib/utils/pointWaterfall';

export async function GET() {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ points: [] });
  }

  try {
    const data = await getCached('points:summary', async () => {
      const [wso] = await db.select().from(settings).where(eq(settings.key, 'weekStartsOn'));
      const weekStartsOn: 0 | 1 = wso?.value === '1' ? 1 : 0;

      const children = await db
        .select({ id: users.id, name: users.name, color: users.color })
        .from(users)
        .where(eq(users.role, 'child'));

      // The household's week, month and year, not the server's.
      const { week: weekStart, month: monthStart, year: yearStart } =
        currentPeriodStarts(new Date(), weekStartsOn, await getHouseholdTimezone());

      const summaries = await Promise.all(
        children.map(async (child) => {
          const completions = await db
            .select({
              pointsAwarded: choreCompletions.pointsAwarded,
              completedAt: choreCompletions.completedAt,
            })
            .from(choreCompletions)
            .where(
              and(
                eq(choreCompletions.completedBy, child.id),
                isNotNull(choreCompletions.approvedBy)
              )
            );

          let weekly = 0;
          let monthly = 0;
          let yearly = 0;
          let allTime = 0;

          for (const c of completions) {
            const pts = c.pointsAwarded ?? 0;
            allTime += pts;
            if (c.completedAt >= yearStart) yearly += pts;
            if (c.completedAt >= monthStart) monthly += pts;
            if (c.completedAt >= weekStart) weekly += pts;
          }

          return {
            userId: child.id,
            name: child.name,
            color: child.color,
            weekly,
            monthly,
            yearly,
            allTime,
          };
        })
      );

      return summaries;
    }, 120);

    return NextResponse.json({ points: data });
  } catch (error) {
    logError('Error fetching points:', error);
    return NextResponse.json({ error: 'Failed to fetch points' }, { status: 500 });
  }
}
