import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { recipeSources } from '@/lib/db/schema';
import { requireAuth, requireRole } from '@/lib/auth';
import { rateLimitGuard } from '@/lib/cache/rateLimit';
import { getRedisClient } from '@/lib/cache/getRedisClient';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logError } from '@/lib/utils/logError';
import { applySync } from '@/lib/sync/runner';
import { getRecipeAdapter } from '@/lib/sync/adapters/registry';
import type { SyncChange } from '@/lib/sync/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/recipe-sources/[id]/sync/apply
 *
 * Applies the user-approved subset of a previously previewed diff.
 * Body: { diffId, selected: [{ kind, externalId }] }
 * Only changes present in BOTH the stashed diff and the selection are applied,
 * so the user can never apply anything they didn't see.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  const limited = await rateLimitGuard(auth.userId, 'recipe-sync:apply', 10, 60);
  if (limited) return limited;

  try {
    const { id } = await params;
    const body = await request.json();
    const diffId = typeof body.diffId === 'string' ? body.diffId : '';
    const selected: Array<{ kind: string; externalId: string }> = Array.isArray(body.selected)
      ? body.selected
      : [];

    if (!diffId) {
      return NextResponse.json({ error: 'diffId is required.' }, { status: 400 });
    }

    const [src] = await db.select().from(recipeSources).where(eq(recipeSources.id, id));
    if (!src) {
      return NextResponse.json({ error: 'Recipe source not found.' }, { status: 404 });
    }
    const redis = await getRedisClient();
    const stored = redis ? await redis.get(`sync-diff:${diffId}`) : null;
    if (!stored) {
      return NextResponse.json(
        { error: 'This sync preview expired — please re-run the sync and review again.' },
        { status: 409 },
      );
    }

    const allChanges = JSON.parse(stored) as SyncChange<unknown>[];
    const selectedKeys = new Set(selected.map((s) => `${s.kind}:${s.externalId}`));
    const toApply = allChanges.filter((c) => selectedKeys.has(`${c.kind}:${c.externalId}`));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await applySync(getRecipeAdapter(src.provider), id, toApply as any);

    await db
      .update(recipeSources)
      .set({
        lastSynced: new Date(),
        updatedAt: new Date(),
        syncErrors: result.errors.length ? { lastError: result.errors.join('; ') } : null,
      })
      .where(eq(recipeSources.id, id));

    await invalidateEntity('recipes');
    if (redis) await redis.del(`sync-diff:${diffId}`);

    return NextResponse.json({ applied: result.applied, errors: result.errors });
  } catch (error) {
    logError('Error applying recipe sync:', error);
    return NextResponse.json({ error: 'Failed to apply the sync.' }, { status: 500 });
  }
}
