import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { recipeSources } from '@/lib/db/schema';
import { requireAuth, requireRole } from '@/lib/auth';
import { logError } from '@/lib/utils/logError';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/recipe-sources/[id] — disconnect a recipe server.
 *
 * Recipes synced from it are KEPT (recipes.source_id is ON DELETE SET NULL,
 * so they become ordinary local recipes) — consistent with the "favor keeping
 * data over deleting" policy. Only the connection + stored token go away.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    await db.delete(recipeSources).where(eq(recipeSources.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Error deleting recipe source:', error);
    return NextResponse.json({ error: 'Failed to disconnect the recipe source.' }, { status: 500 });
  }
}
