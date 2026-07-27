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
import { getMealPlanAdapter } from '@/lib/sync/adapters/registry';
import { UnsafeUrlError } from '@/lib/integrations/tandoor';

/** The meal-plan payload fields the review enrichment reads (both providers). */
interface MealPayload {
  recipeExternalId?: string | null;
  recipeAlreadyImported?: boolean;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** How long a computed diff is held for the user to review + apply. */
const DIFF_TTL_SECONDS = 900; // 15 minutes

/**
 * POST /api/recipe-sources/[id]/meal-sync/preview
 *
 * Computes the meal-plan review diff (never applies), stashes it in Redis under
 * a diffId, and returns a light view for the review modal. Enriches each change
 * with whether applying it will also import a not-yet-imported Tandoor recipe,
 * and a summary note of how many recipes that is.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  const limited = await rateLimitGuard(auth.userId, 'meal-sync:preview', 10, 60);
  if (limited) return limited;

  try {
    const { id } = await params;
    const [src] = await db.select().from(recipeSources).where(eq(recipeSources.id, id));
    if (!src) {
      return NextResponse.json({ error: 'Recipe source not found.' }, { status: 404 });
    }
    const diff = await previewSync(getMealPlanAdapter(src.provider), { id: src.id, lastSynced: src.lastSynced });

    const diffId = randomUUID();
    const redis = await getRedisClient();
    if (!redis) {
      return NextResponse.json(
        { error: 'Sync requires Redis, which is currently unavailable.' },
        { status: 503 },
      );
    }
    await redis.setEx(`sync-diff:${diffId}`, DIFF_TTL_SECONDS, JSON.stringify(diff.changes));

    // Recipes that applying the pre-checked (add/update) meals will also import.
    const recipesToImport = new Set<string>();
    for (const c of diff.changes) {
      if (c.kind === 'delete') continue;
      const p = c.payload as MealPayload | undefined;
      if (p?.recipeExternalId && !p.recipeAlreadyImported) recipesToImport.add(p.recipeExternalId);
    }

    const changes = diff.changes.map((c) => {
      const p = c.payload as MealPayload | undefined;
      const alsoImports = c.kind !== 'delete' && p?.recipeExternalId && !p.recipeAlreadyImported;
      return {
        kind: c.kind,
        externalId: c.externalId,
        label: c.label,
        reason: alsoImports ? `${c.reason} · also imports its recipe` : c.reason,
        defaultChecked: c.defaultChecked,
      };
    });

    const notes =
      recipesToImport.size > 0
        ? [
            `Applying these meals will also import ${recipesToImport.size} recipe${
              recipesToImport.size === 1 ? '' : 's'
            } from Tandoor (with photos).`,
          ]
        : [];

    return NextResponse.json({
      diffId,
      changes,
      counts: diff.counts,
      massDeleteGuardTripped: diff.massDeleteGuardTripped,
      withheldDeletes: diff.withheldDeletes,
      notes,
    });
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logError('Error computing meal-plan sync preview:', error);
    const msg = error instanceof Error ? error.message : 'Failed to compute sync.';
    if (error instanceof Error && /token|reach|Tandoor|meal plan/i.test(error.message)) {
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    return NextResponse.json({ error: 'Failed to compute the meal-plan sync preview.' }, { status: 500 });
  }
}
