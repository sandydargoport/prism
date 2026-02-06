import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole, getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { goals, users, choreCompletions, goalAchievements } from '@/lib/db/schema';
import { eq, and, isNotNull, desc, asc, max } from 'drizzle-orm';
import { createGoalSchema, validateRequest } from '@/lib/validations';
import { getCached, invalidateCache } from '@/lib/cache/redis';
import { rateLimitGuard } from '@/lib/cache/rateLimit';
import { computeWaterfall, getGoalPeriodKey } from '@/lib/utils/pointWaterfall';

export async function GET(request: NextRequest) {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ goals: [], progress: {}, children: [] });
  }

  try {
    const data = await getCached('goals:progress', async () => {
      // Fetch active goals sorted by priority
      const goalRows = await db
        .select()
        .from(goals)
        .where(eq(goals.active, true))
        .orderBy(asc(goals.priority));

      // Fetch children
      const children = await db
        .select({ id: users.id, name: users.name, color: users.color })
        .from(users)
        .where(eq(users.role, 'child'));

      // Fetch all approved chore completions
      const allCompletions = await db
        .select({
          completedBy: choreCompletions.completedBy,
          pointsAwarded: choreCompletions.pointsAwarded,
          completedAt: choreCompletions.completedAt,
        })
        .from(choreCompletions)
        .where(isNotNull(choreCompletions.approvedBy));

      // Fetch achievements
      const achievements = await db
        .select()
        .from(goalAchievements);

      const now = new Date();
      const goalDefs = goalRows.map((g) => ({
        id: g.id,
        pointCost: g.pointCost,
        priority: g.priority,
        recurring: g.recurring,
        recurrencePeriod: g.recurrencePeriod,
        lastResetAt: g.lastResetAt,
      }));

      // Compute waterfall per child
      const progress: Record<string, Record<string, { allocated: number; achieved: boolean }>> = {};
      const childCounters: Record<string, { weekly: number; monthly: number; yearly: number }> = {};

      for (const child of children) {
        // Filter completions after each goal's lastResetAt (for non-recurring)
        const childCompletions = allCompletions
          .filter((c) => c.completedBy === child.id)
          .map((c) => ({
            pointsAwarded: c.pointsAwarded,
            completedAt: c.completedAt,
          }));

        const result = computeWaterfall(goalDefs, childCompletions, now);

        const childProgress: Record<string, { allocated: number; achieved: boolean }> = {};
        for (const gp of result.goals) {
          // Check if already achieved (from achievements table)
          const periodKey = getGoalPeriodKey(
            goalDefs.find((g) => g.id === gp.goalId)!,
            now
          );
          const hasAchievement = achievements.some(
            (a) => a.goalId === gp.goalId && a.userId === child.id && a.periodStart === periodKey
          );

          childProgress[gp.goalId] = {
            allocated: gp.allocated,
            achieved: gp.achieved || hasAchievement,
          };
        }
        progress[child.id] = childProgress;

        childCounters[child.id] = {
          weekly: result.weeklyEarned,
          monthly: result.monthlyEarned,
          yearly: result.yearlyEarned,
        };
      }

      // Determine which goals are fully achieved (all children achieved)
      const fullyAchieved: Record<string, boolean> = {};
      for (const goal of goalRows) {
        if (children.length === 0) {
          fullyAchieved[goal.id] = false;
          continue;
        }
        fullyAchieved[goal.id] = children.every(
          (c) => progress[c.id]?.[goal.id]?.achieved
        );
      }

      return {
        goals: goalRows.map((g) => ({
          id: g.id,
          name: g.name,
          description: g.description,
          pointCost: g.pointCost,
          emoji: g.emoji,
          priority: g.priority,
          recurring: g.recurring,
          recurrencePeriod: g.recurrencePeriod,
          active: g.active,
          lastResetAt: g.lastResetAt.toISOString(),
          createdAt: g.createdAt.toISOString(),
          fullyAchieved: fullyAchieved[g.id] || false,
        })),
        progress,
        children: children.map((c) => ({
          userId: c.id,
          name: c.name,
          color: c.color,
          counters: childCounters[c.id] || { weekly: 0, monthly: 0, yearly: 0 },
        })),
      };
    }, 120);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching goals:', error);
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageGoals');
  if (forbidden) return forbidden;

  const rateLimited = await rateLimitGuard(auth.userId, 'goals:create', 30, 60);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const validation = validateRequest(createGoalSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { name, description, pointCost, emoji, recurring, recurrencePeriod, active } = validation.data;

    // Auto-assign priority: next available
    let priority = validation.data.priority;
    if (priority === undefined || priority === null) {
      const [maxRow] = await db
        .select({ maxPriority: max(goals.priority) })
        .from(goals)
        .where(eq(goals.active, true));
      priority = (Number(maxRow?.maxPriority) || 0) + 1;
    }

    const [goal] = await db
      .insert(goals)
      .values({
        name,
        description,
        pointCost,
        emoji,
        priority,
        recurring: recurring || false,
        recurrencePeriod: recurring ? (recurrencePeriod || 'weekly') : null,
        active,
      })
      .returning();

    if (!goal) {
      return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 });
    }

    await invalidateCache('goals:*');

    return NextResponse.json({ goal }, { status: 201 });
  } catch (error) {
    console.error('Error creating goal:', error);
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 });
  }
}
