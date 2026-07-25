import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { recipes } from '@/lib/db/schema';
import { requireAuth, requireRole } from '@/lib/auth';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { rateLimitGuard } from '@/lib/cache/rateLimit';
import { saveRecipeImage } from '@/lib/services/recipe-image-storage';
import { logError } from '@/lib/utils/logError';
import {
  testTandoorConnection,
  fetchTandoorRecipes,
  fetchTandoorImage,
  UnsafeUrlError,
} from '@/lib/integrations/tandoor';

/**
 * POST /api/recipes/import-tandoor
 *
 * One-shot import of every recipe from a Tandoor server into Prism, mirroring
 * the URL / Paprika import paths. Body: `{ serverUrl, token, preview? }`.
 * `preview: true` only verifies connectivity and returns the recipe count.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // Connecting to an external server with a credential is integration
  // management, not ordinary recipe editing — gate on canManageIntegrations
  // (parent-only), matching the photo/calendar source connect flows.
  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  const limited = await rateLimitGuard(auth.userId, 'recipe-import-tandoor', 5, 60);
  if (limited) return limited;

  try {
    const body = await request.json();
    const serverUrl = typeof body.serverUrl === 'string' ? body.serverUrl.trim() : '';
    const token = typeof body.token === 'string' ? body.token.trim() : '';

    if (!serverUrl || !token) {
      return NextResponse.json(
        { error: 'Tandoor server URL and API token are both required.' },
        { status: 400 },
      );
    }

    // Preview: verify the server + token, report how many recipes are there.
    if (body.preview) {
      const { count } = await testTandoorConnection(serverUrl, token);
      return NextResponse.json({ preview: true, count });
    }

    const { recipes: items, total } = await fetchTandoorRecipes(serverUrl, token);

    let imported = 0;
    for (const item of items) {
      const [row] = await db
        .insert(recipes)
        .values({
          name: item.name,
          description: item.description,
          url: item.url,
          sourceType: 'tandoor_import',
          ingredients: item.ingredients,
          instructions: item.instructions,
          prepTime: item.prepTime,
          cookTime: item.cookTime,
          servings: item.servings,
          tags: item.tags,
          imageUrl: null,
          createdBy: auth.userId,
        })
        .returning({ id: recipes.id });

      // Best-effort image: download server-side with the token (Tandoor media
      // can sit behind auth / on an internal host), store locally, point the
      // row at the proxy path. A missing image never fails the import.
      if (row && item.remoteImageUrl) {
        const buffer = await fetchTandoorImage(item.remoteImageUrl, token);
        if (buffer) {
          try {
            await saveRecipeImage(buffer, row.id);
            await db
              .update(recipes)
              .set({ imageUrl: `/api/recipes/${row.id}/image` })
              .where(eq(recipes.id, row.id));
          } catch (imgErr) {
            logError('Tandoor import: failed to store recipe image', imgErr);
          }
        }
      }
      imported += 1;
    }

    await invalidateEntity('recipes');
    return NextResponse.json({ imported, total }, { status: 201 });
  } catch (error) {
    // The SSRF-allowlist message is actionable (names the host + the env var);
    // surface it straight to the user so they know exactly what to do.
    if (error instanceof UnsafeUrlError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logError('Error importing recipes from Tandoor:', error);
    // Connection / auth failures carry a user-useful message; pass it through.
    if (error instanceof Error && /Tandoor|token|reach|list Tandoor recipes/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json({ error: 'Failed to import recipes from Tandoor.' }, { status: 500 });
  }
}
