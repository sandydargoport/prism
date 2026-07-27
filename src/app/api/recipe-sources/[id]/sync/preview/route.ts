import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { recipeSources } from '@/lib/db/schema';
import { requireAuth, requireRole } from '@/lib/auth';
import { rateLimitGuard } from '@/lib/cache/rateLimit';
import { getRedisClient } from '@/lib/cache/getRedisClient';
import { logError } from '@/lib/utils/logError';
import { previewSync } from '@/lib/sync/runner';
import { getRecipeAdapter } from '@/lib/sync/adapters/registry';
import { UnsafeUrlError } from '@/lib/integrations/tandoor';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** How long a computed diff is held for the user to review + apply. */
const DIFF_TTL_SECONDS = 900; // 15 minutes

/**
 * POST /api/recipe-sources/[id]/sync/preview
 *
 * Computes the review diff (never applies anything), stashes the full diff in
 * Redis under a diffId, and returns a lightweight view for the review modal.
 * The user selects which changes to apply; /apply consumes the stashed diff.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  const limited = await rateLimitGuard(auth.userId, 'recipe-sync:preview', 10, 60);
  if (limited) return limited;

  try {
    const { id } = await params;
    const [src] = await db.select().from(recipeSources).where(eq(recipeSources.id, id));
    if (!src) {
      return NextResponse.json({ error: 'Recipe source not found.' }, { status: 404 });
    }
    const diff = await previewSync(getRecipeAdapter(src.provider), { id: src.id, lastSynced: src.lastSynced });

    // Stash the full diff (with payloads) for /apply; hand the UI a light view.
    const diffId = randomUUID();
    const redis = await getRedisClient();
    if (!redis) {
      return NextResponse.json(
        { error: 'Sync requires Redis, which is currently unavailable.' },
        { status: 503 },
      );
    }
    await redis.setEx(`sync-diff:${diffId}`, DIFF_TTL_SECONDS, JSON.stringify(diff.changes));

    const changes = diff.changes.map((c) => ({
      kind: c.kind,
      externalId: c.externalId,
      label: c.label,
      reason: c.reason,
      defaultChecked: c.defaultChecked,
      remoteUpdatedAt: c.remoteUpdatedAt ?? null,
      localUpdatedAt: c.localUpdatedAt ?? null,
    }));

    return NextResponse.json({
      diffId,
      changes,
      counts: diff.counts,
      massDeleteGuardTripped: diff.massDeleteGuardTripped,
      withheldDeletes: diff.withheldDeletes,
    });
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logError('Error computing recipe sync preview:', error);
    const msg = error instanceof Error ? error.message : 'Failed to compute sync.';
    if (error instanceof Error && /token|reach|Tandoor|list Tandoor/i.test(error.message)) {
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    return NextResponse.json({ error: 'Failed to compute the sync preview.' }, { status: 500 });
  }
}
