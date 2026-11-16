import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { taskSources, shoppingListSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';
import { invalidateEntities } from '@/lib/cache/cacheKeys';

export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  try {
    await db
      .delete(taskSources)
      .where(eq(taskSources.provider, 'microsoft_todo'));

    await db
      .delete(shoppingListSources)
      .where(eq(shoppingListSources.provider, 'microsoft_todo'));

    // The source lists, and the task and shopping lists that show which
    // items are linked, are cached.
    await invalidateEntities('task-sources', 'tasks', 'shopping-list-sources', 'shopping-lists');

    logActivity({
      userId: auth.userId,
      action: 'delete',
      entityType: 'integration',
      summary: 'Disconnected Microsoft To-Do integration',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Error disconnecting Microsoft:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Microsoft' },
      { status: 500 }
    );
  }
}
