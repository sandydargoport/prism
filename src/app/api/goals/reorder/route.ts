import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { goals } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { z } from 'zod';
import { logError } from '@/lib/utils/logError';

const reorderSchema = z.object({
  order: z.array(z.guid()).min(1).max(1000),
});

/**
 * POST /api/goals/reorder
 * Accepts an array of goal IDs in desired priority order.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageGoals');
  if (forbidden) return forbidden;

  try {
    const body = await request.json();
    const parsed = reorderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { order } = parsed.data;
    const now = new Date();

    await db.transaction(async (tx) => {
      for (let i = 0; i < order.length; i++) {
        const goalId = order[i]!;
        await tx
          .update(goals)
          .set({ priority: i + 1, updatedAt: now })
          .where(eq(goals.id, goalId));
      }
    });

    await invalidateEntity('goals');

    return NextResponse.json({ message: 'Goals reordered' });
  } catch (error) {
    logError('Error reordering goals:', error);
    return NextResponse.json({ error: 'Failed to reorder goals' }, { status: 500 });
  }
}
