import { NextRequest, NextResponse } from 'next/server';
import { getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { choreCompletions, chores, users } from '@/lib/db/schema';
import { eq, desc, gte, sql } from 'drizzle-orm';
import { getCached } from '@/lib/cache/redis';
import { subDays } from 'date-fns';

/**
 * GET /api/chores/completions
 * Returns recent chore completions (last 14 days by default).
 * Query params: ?days=14&limit=50
 */
export async function GET(request: NextRequest) {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ completions: [] });
  }

  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') || '14', 10)));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const since = subDays(new Date(), days);

    const cacheKey = `chores:completions:${days}:${limit}`;

    const data = await getCached(cacheKey, async () => {
      const completedByUser = db
        .select({ id: users.id, name: users.name, color: users.color })
        .from(users)
        .as('completedByUser');

      const approvedByUser = db
        .select({ id: users.id, name: users.name, color: users.color })
        .from(users)
        .as('approvedByUser');

      const rows = await db
        .select({
          id: choreCompletions.id,
          choreId: choreCompletions.choreId,
          choreTitle: chores.title,
          choreCategory: chores.category,
          chorePointValue: chores.pointValue,
          completedAt: choreCompletions.completedAt,
          pointsAwarded: choreCompletions.pointsAwarded,
          approvedAt: choreCompletions.approvedAt,
          completedById: choreCompletions.completedBy,
          completedByName: sql<string>`cb.name`.as('cb_name'),
          completedByColor: sql<string>`cb.color`.as('cb_color'),
          approvedById: choreCompletions.approvedBy,
          approvedByName: sql<string>`ab.name`.as('ab_name'),
          approvedByColor: sql<string>`ab.color`.as('ab_color'),
        })
        .from(choreCompletions)
        .innerJoin(chores, eq(choreCompletions.choreId, chores.id))
        .innerJoin(
          sql`users as cb`,
          sql`cb.id = ${choreCompletions.completedBy}`
        )
        .leftJoin(
          sql`users as ab`,
          sql`ab.id = ${choreCompletions.approvedBy}`
        )
        .where(gte(choreCompletions.completedAt, since))
        .orderBy(desc(choreCompletions.completedAt))
        .limit(limit);

      return {
        completions: rows.map((r) => ({
          id: r.id,
          choreId: r.choreId,
          choreTitle: r.choreTitle,
          choreCategory: r.choreCategory,
          completedAt: r.completedAt.toISOString(),
          pointsAwarded: r.pointsAwarded ?? r.chorePointValue ?? 0,
          completedBy: {
            id: r.completedById,
            name: r.completedByName,
            color: r.completedByColor,
          },
          approvedBy: r.approvedById ? {
            id: r.approvedById,
            name: r.approvedByName,
            color: r.approvedByColor,
          } : null,
          approvedAt: r.approvedAt?.toISOString() || null,
        })),
      };
    }, 60);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching chore completions:', error);
    return NextResponse.json({ error: 'Failed to fetch completions' }, { status: 500 });
  }
}
