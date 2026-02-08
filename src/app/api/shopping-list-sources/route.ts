import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { shoppingListSources, shoppingLists, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import { invalidateCache, getCached } from '@/lib/cache/redis';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const cacheKey = userId ? `shopping-list-sources:user:${userId}` : 'shopping-list-sources:all';

    const sources = await getCached(
      cacheKey,
      async () => {
        let query = db
          .select({
            id: shoppingListSources.id,
            userId: shoppingListSources.userId,
            userName: users.name,
            provider: shoppingListSources.provider,
            externalListId: shoppingListSources.externalListId,
            externalListName: shoppingListSources.externalListName,
            shoppingListId: shoppingListSources.shoppingListId,
            shoppingListName: shoppingLists.name,
            syncEnabled: shoppingListSources.syncEnabled,
            lastSyncAt: shoppingListSources.lastSyncAt,
            lastSyncError: shoppingListSources.lastSyncError,
            createdAt: shoppingListSources.createdAt,
          })
          .from(shoppingListSources)
          .leftJoin(users, eq(shoppingListSources.userId, users.id))
          .leftJoin(shoppingLists, eq(shoppingListSources.shoppingListId, shoppingLists.id));

        if (userId) {
          query = query.where(eq(shoppingListSources.userId, userId)) as typeof query;
        }

        return query;
      },
      120
    );

    return NextResponse.json(sources);
  } catch (error) {
    console.error('Error fetching shopping list sources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shopping list sources' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  try {
    const body = await request.json();

    if (!body.provider || !body.externalListId || !body.shoppingListId) {
      return NextResponse.json(
        { error: 'provider, externalListId, and shoppingListId are required' },
        { status: 400 }
      );
    }

    // Verify the shopping list exists
    const [list] = await db
      .select()
      .from(shoppingLists)
      .where(eq(shoppingLists.id, body.shoppingListId));

    if (!list) {
      return NextResponse.json(
        { error: 'Shopping list not found' },
        { status: 404 }
      );
    }

    // Check for duplicate source
    const [existing] = await db
      .select()
      .from(shoppingListSources)
      .where(
        and(
          eq(shoppingListSources.userId, body.userId || auth.userId),
          eq(shoppingListSources.provider, body.provider),
          eq(shoppingListSources.externalListId, body.externalListId)
        )
      );

    if (existing) {
      return NextResponse.json(
        { error: 'This external list is already connected' },
        { status: 409 }
      );
    }

    const [newSource] = await db
      .insert(shoppingListSources)
      .values({
        userId: body.userId || auth.userId,
        provider: body.provider,
        externalListId: body.externalListId,
        externalListName: body.externalListName || null,
        shoppingListId: body.shoppingListId,
        syncEnabled: body.syncEnabled !== false,
        accessToken: body.accessToken || null,
        refreshToken: body.refreshToken || null,
        tokenExpiresAt: body.tokenExpiresAt ? new Date(body.tokenExpiresAt) : null,
      })
      .returning();

    if (!newSource) {
      return NextResponse.json(
        { error: 'Failed to create shopping list source' },
        { status: 500 }
      );
    }

    await invalidateCache('shopping-list-sources:*');

    return NextResponse.json({
      id: newSource.id,
      userId: newSource.userId,
      provider: newSource.provider,
      externalListId: newSource.externalListId,
      externalListName: newSource.externalListName,
      shoppingListId: newSource.shoppingListId,
      syncEnabled: newSource.syncEnabled,
      lastSyncAt: newSource.lastSyncAt,
      createdAt: newSource.createdAt,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating shopping list source:', error);
    return NextResponse.json(
      { error: 'Failed to create shopping list source' },
      { status: 500 }
    );
  }
}
