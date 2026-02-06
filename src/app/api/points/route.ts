import { NextResponse } from 'next/server';
import { getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { users, choreCompletions } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { getCached } from '@/lib/cache/redis';
import { startOfWeek, startOfMonth, startOfYear } from 'date-fns';

export async function GET() {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ points: [] });
  }

  try {
    const data = await getCached('points:summary', async () => {
      const children = await db
        .select({ id: users.id, name: users.name, color: users.color })
        .from(users)
        .where(eq(users.role, 'child'));

      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const monthStart = startOfMonth(now);
      const yearStart = startOfYear(now);

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
    console.error('Error fetching points:', error);
    return NextResponse.json({ error: 'Failed to fetch points' }, { status: 500 });
  }
}
