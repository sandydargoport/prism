import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { goals, goalAchievements } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { updateGoalSchema, validateRequest } from '@/lib/validations';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logError } from '@/lib/utils/logError';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageGoals');
  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const body = await request.json();
    const validation = validateRequest(updateGoalSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const [existing] = await db.select({ id: goals.id }).from(goals).where(eq(goals.id, id));
    if (!existing) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { ...validation.data, updatedAt: new Date() };
    // If toggling recurring, set recurrencePeriod appropriately
    if (validation.data.recurring === false) {
      updateData.recurrencePeriod = null;
    }

    const [updated] = await db
      .update(goals)
      .set(updateData)
      .where(eq(goals.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 });
    }

    await invalidateEntity('goals');

    return NextResponse.json({ goal: updated });
  } catch (error) {
    logError('Error updating goal:', error);
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageGoals');
  if (forbidden) return forbidden;

  try {
    const { id } = await params;

    const [existing] = await db.select({ id: goals.id }).from(goals).where(eq(goals.id, id));
    if (!existing) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    await db.delete(goals).where(eq(goals.id, id));
    await invalidateEntity('goals');

    return NextResponse.json({ message: 'Goal deleted' });
  } catch (error) {
    logError('Error deleting goal:', error);
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 });
  }
}
