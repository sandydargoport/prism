import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { shoppingListSources, shoppingItems } from '@/lib/db/schema';
import { eq, and, or, isNull } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import { invalidateCache } from '@/lib/cache/redis';
import { getShoppingProvider } from '@/lib/integrations/shopping';
import { decrypt, encrypt } from '@/lib/utils/crypto';
import type {
  ShoppingProviderTokens,
  ExternalShoppingItem,
  SyncResult,
} from '@/lib/integrations/shopping/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/shopping-list-sources/[id]/sync
 *
 * Performs bidirectional sync between Prism shopping items and the external provider.
 *
 * Sync strategy (newest_wins):
 * 1. Fetch all remote items from provider
 * 2. For each remote item:
 *    - If no local match by externalId: create local item
 *    - If local match exists: compare timestamps, update the older one
 * 3. For each local item linked to this source:
 *    - If no remote match: push to remote (item was created locally)
 *    - If deleted remotely: delete locally
 * 4. Update lastSyncAt timestamp
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  const { id: sourceId } = await params;

  try {
    // 1. Get the source configuration
    const [source] = await db
      .select()
      .from(shoppingListSources)
      .where(eq(shoppingListSources.id, sourceId));

    if (!source) {
      return NextResponse.json(
        { error: 'Shopping list source not found' },
        { status: 404 }
      );
    }

    if (!source.syncEnabled) {
      return NextResponse.json(
        { error: 'Sync is disabled for this source' },
        { status: 400 }
      );
    }

    // 2. Get the provider
    const provider = getShoppingProvider(source.provider);
    if (!provider) {
      return NextResponse.json(
        { error: `Unknown provider: ${source.provider}` },
        { status: 400 }
      );
    }

    // 3. Prepare tokens (decrypt from storage)
    if (!source.accessToken) {
      return NextResponse.json(
        { error: 'No access token configured. Please reconnect the provider.' },
        { status: 401 }
      );
    }

    let tokens: ShoppingProviderTokens = {
      accessToken: decrypt(source.accessToken),
      refreshToken: source.refreshToken ? decrypt(source.refreshToken) : undefined,
      expiresAt: source.tokenExpiresAt || undefined,
    };

    // 4. Refresh tokens if expired
    if (tokens.expiresAt && new Date(tokens.expiresAt) < new Date()) {
      if (provider.refreshTokens && tokens.refreshToken) {
        const newTokens = await provider.refreshTokens(tokens);
        if (newTokens) {
          tokens = newTokens;
          // Update tokens in database (encrypt before storage)
          await db
            .update(shoppingListSources)
            .set({
              accessToken: encrypt(newTokens.accessToken),
              refreshToken: newTokens.refreshToken ? encrypt(newTokens.refreshToken) : source.refreshToken,
              tokenExpiresAt: newTokens.expiresAt,
              updatedAt: new Date(),
            })
            .where(eq(shoppingListSources.id, sourceId));
        } else {
          await db
            .update(shoppingListSources)
            .set({
              lastSyncError: 'Token refresh failed. Please reconnect.',
              updatedAt: new Date(),
            })
            .where(eq(shoppingListSources.id, sourceId));

          return NextResponse.json(
            { error: 'Token refresh failed. Please reconnect the provider.' },
            { status: 401 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Access token expired. Please reconnect the provider.' },
          { status: 401 }
        );
      }
    }

    // 5. Perform the sync
    const result = await performSync(
      source.id,
      source.externalListId,
      source.shoppingListId,
      tokens,
      provider
    );

    // 6. Update source with sync result
    await db
      .update(shoppingListSources)
      .set({
        lastSyncAt: new Date(),
        lastSyncError: result.errors.length > 0 ? result.errors.join('; ') : null,
        updatedAt: new Date(),
      })
      .where(eq(shoppingListSources.id, sourceId));

    await invalidateCache('shopping:*');
    await invalidateCache('shopping-list-sources:*');

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Sync error:', error);

    // Update source with error
    await db
      .update(shoppingListSources)
      .set({
        lastSyncError: error instanceof Error ? error.message : 'Unknown sync error',
        updatedAt: new Date(),
      })
      .where(eq(shoppingListSources.id, sourceId));

    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Core sync logic
 */
async function performSync(
  sourceId: string,
  externalListId: string,
  shoppingListId: string,
  tokens: ShoppingProviderTokens,
  provider: ReturnType<typeof getShoppingProvider>
): Promise<SyncResult> {
  if (!provider) {
    throw new Error('Provider not found');
  }

  const result: SyncResult = {
    created: 0,
    updated: 0,
    deleted: 0,
    errors: [],
  };

  try {
    // Fetch remote items
    const remoteItems = await provider.fetchItems(tokens, externalListId);

    // Fetch local items linked to this source OR belonging to this list (for new items)
    const localItems = await db
      .select()
      .from(shoppingItems)
      .where(
        or(
          eq(shoppingItems.shoppingListSourceId, sourceId),
          and(eq(shoppingItems.listId, shoppingListId), isNull(shoppingItems.shoppingListSourceId))
        )
      );

    // Create maps for quick lookup
    const remoteById = new Map(remoteItems.map(i => [i.id, i]));
    const localByExternalId = new Map(
      localItems
        .filter(i => i.externalId)
        .map(i => [i.externalId!, i])
    );

    // Process remote items
    for (const remoteItem of remoteItems) {
      const localItem = localByExternalId.get(remoteItem.id);

      if (!localItem) {
        // Remote item doesn't exist locally - create it
        try {
          await db.insert(shoppingItems).values({
            listId: shoppingListId,
            name: remoteItem.name,
            notes: remoteItem.notes || null,
            checked: remoteItem.checked,
            shoppingListSourceId: sourceId,
            externalId: remoteItem.id,
            externalUpdatedAt: remoteItem.updatedAt,
            lastSynced: new Date(),
          });
          result.created++;
        } catch (err) {
          result.errors.push(`Failed to create local item: ${remoteItem.name}`);
        }
      } else {
        // Item exists in both - compare timestamps
        const remoteUpdated = remoteItem.updatedAt;
        const localUpdated = localItem.updatedAt;

        if (remoteUpdated > localUpdated) {
          // Remote is newer - update local
          try {
            await db
              .update(shoppingItems)
              .set({
                name: remoteItem.name,
                notes: remoteItem.notes || null,
                checked: remoteItem.checked,
                externalUpdatedAt: remoteItem.updatedAt,
                lastSynced: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(shoppingItems.id, localItem.id));
            result.updated++;
          } catch (err) {
            result.errors.push(`Failed to update local item: ${localItem.name}`);
          }
        } else if (localUpdated > remoteUpdated) {
          // Local is newer - update remote
          try {
            await provider.updateItem(tokens, remoteItem.id, externalListId, {
              name: localItem.name,
              notes: localItem.notes,
              checked: localItem.checked,
            });

            // Update local sync timestamp
            await db
              .update(shoppingItems)
              .set({
                lastSynced: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(shoppingItems.id, localItem.id));
            result.updated++;
          } catch (err) {
            result.errors.push(`Failed to update remote item: ${localItem.name}`);
          }
        } else {
          // Same timestamp - just update lastSynced
          await db
            .update(shoppingItems)
            .set({ lastSynced: new Date() })
            .where(eq(shoppingItems.id, localItem.id));
        }
      }
    }

    // Find local items that don't exist remotely (created locally or deleted remotely)
    for (const localItem of localItems) {
      if (!localItem.externalId) {
        // Local item without externalId - push to remote
        try {
          const created = await provider.createItem(tokens, {
            listId: externalListId,
            name: localItem.name,
            notes: localItem.notes,
          });

          // Update if checked locally
          if (localItem.checked) {
            await provider.updateItem(tokens, created.id, externalListId, {
              checked: true,
            });
          }

          // Update local item with external ID and link to this source
          await db
            .update(shoppingItems)
            .set({
              shoppingListSourceId: sourceId,
              externalId: created.id,
              externalUpdatedAt: created.updatedAt,
              lastSynced: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(shoppingItems.id, localItem.id));
          result.created++;
        } catch (err) {
          result.errors.push(`Failed to push item to remote: ${localItem.name}`);
        }
      } else if (!remoteById.has(localItem.externalId)) {
        // Local item has externalId but remote doesn't have it - deleted remotely
        try {
          await db.delete(shoppingItems).where(eq(shoppingItems.id, localItem.id));
          result.deleted++;
        } catch (err) {
          result.errors.push(`Failed to delete local item: ${localItem.name}`);
        }
      }
    }

    return result;
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : 'Unknown sync error');
    return result;
  }
}
