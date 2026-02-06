import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { goals, goalAchievements } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { invalidateCache } from '@/lib/cache/redis';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/goals/[id]/redeem
 *
 * Resets a fully-achieved non-recurring goal.
 * Clears all achievements and sets lastResetAt to now,
 * so progress starts over.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageGoals');
  if (forbidden) return forbidden;

  try {
    const { id: goalId } = await params;

    const [goal] = await db
      .select()
      .from(goals)
      .where(eq(goals.id, goalId));

    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      // Clear achievements for this goal
      await tx
        .delete(goalAchievements)
        .where(eq(goalAchievements.goalId, goalId));

      // Reset the goal's lastResetAt
      await tx
        .update(goals)
        .set({ lastResetAt: now, updatedAt: now })
        .where(eq(goals.id, goalId));
    });

    await invalidateCache('goals:*');
    await invalidateCache('points:*');

    return NextResponse.json({
      message: `Goal "${goal.name}" has been reset. Progress starts over.`,
    });
  } catch (error) {
    console.error('Error resetting goal:', error);
    return NextResponse.json({ error: 'Failed to reset goal' }, { status: 500 });
  }
}
