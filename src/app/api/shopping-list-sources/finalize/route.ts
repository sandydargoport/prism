import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { shoppingListSources, shoppingLists } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getRedisClient } from '@/lib/cache/getRedisClient';
import { invalidateCache } from '@/lib/cache/redis';

/**
 * POST /api/shopping-list-sources/finalize
 *
 * Finalizes the MS To-Do connection for shopping lists by creating a shoppingListSource
 * with the user-selected MS list.
 *
 * Body: { shoppingListId, externalListId, externalListName }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  try {
    const body = await request.json();
    const { shoppingListId, externalListId, externalListName } = body;

    if (!externalListId) {
      return NextResponse.json(
        { error: 'externalListId is required' },
        { status: 400 }
      );
    }

    if (!shoppingListId) {
      return NextResponse.json(
        { error: 'shoppingListId is required' },
        { status: 400 }
      );
    }

    // Get temp tokens from Redis
    const redis = await getRedisClient();
    if (!redis) {
      return NextResponse.json(
        { error: 'Redis unavailable' },
        { status: 503 }
      );
    }

    const tempKey = `ms-todo-temp:${auth.userId}:shopping:${shoppingListId}`;
    let stored = await redis.get(tempKey);

    // Fallback for old key format
    if (!stored) {
      stored = await redis.get(`ms-todo-temp:${auth.userId}:${shoppingListId}`);
    }

    if (!stored) {
      return NextResponse.json(
        { error: 'Session expired. Please reconnect Microsoft To-Do.' },
        { status: 401 }
      );
    }

    const { accessToken, refreshToken, tokenExpiresAt } = JSON.parse(stored);

    // Verify the Prism shopping list exists
    const [list] = await db
      .select()
      .from(shoppingLists)
      .where(eq(shoppingLists.id, shoppingListId));

    if (!list) {
      return NextResponse.json(
        { error: 'Shopping list not found' },
        { status: 404 }
      );
    }

    // Check if source already exists for this Prism list
    const [existing] = await db
      .select()
      .from(shoppingListSources)
      .where(
        and(
          eq(shoppingListSources.provider, 'microsoft_todo'),
          eq(shoppingListSources.shoppingListId, shoppingListId)
        )
      );

    if (existing) {
      // Update existing source
      await db
        .update(shoppingListSources)
        .set({
          accessToken,
          refreshToken: refreshToken || existing.refreshToken,
          tokenExpiresAt: new Date(tokenExpiresAt),
          externalListId,
          externalListName: externalListName || null,
          lastSyncError: null,
          updatedAt: new Date(),
        })
        .where(eq(shoppingListSources.id, existing.id));
    } else {
      // Create new source
      await db.insert(shoppingListSources).values({
        userId: auth.userId,
        provider: 'microsoft_todo',
        shoppingListId,
        externalListId,
        externalListName: externalListName || null,
        accessToken,
        refreshToken,
        tokenExpiresAt: new Date(tokenExpiresAt),
        syncEnabled: true,
      });
    }

    // Clean up temp tokens
    await redis.del(tempKey);

    await invalidateCache('shopping-list-sources:*');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error finalizing MS shopping connection:', error);
    return NextResponse.json(
      { error: 'Failed to complete Microsoft To-Do connection' },
      { status: 500 }
    );
  }
}
