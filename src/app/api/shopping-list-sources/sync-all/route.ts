import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { shoppingListSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import { invalidateCache } from '@/lib/cache/redis';
import { getShoppingProvider } from '@/lib/integrations/shopping';
import { decrypt, encrypt } from '@/lib/utils/crypto';
import type { ShoppingProviderTokens, SyncResult } from '@/lib/integrations/shopping/types';

/**
 * POST /api/shopping-list-sources/sync-all
 *
 * Syncs all enabled shopping list sources.
 * Used for background sync.
 */
export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  try {
    // Get all enabled sources
    const sources = await db
      .select()
      .from(shoppingListSources)
      .where(eq(shoppingListSources.syncEnabled, true));

    if (sources.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        message: 'No enabled shopping list sources to sync',
      });
    }

    const results: Array<{
      sourceId: string;
      provider: string;
      success: boolean;
      result?: SyncResult;
      error?: string;
    }> = [];

    for (const source of sources) {
      try {
        const provider = getShoppingProvider(source.provider);
        if (!provider) {
          results.push({
            sourceId: source.id,
            provider: source.provider,
            success: false,
            error: `Unknown provider: ${source.provider}`,
          });
          continue;
        }

        if (!source.accessToken) {
          results.push({
            sourceId: source.id,
            provider: source.provider,
            success: false,
            error: 'No access token configured',
          });
          continue;
        }

        let tokens: ShoppingProviderTokens = {
          accessToken: decrypt(source.accessToken),
          refreshToken: source.refreshToken ? decrypt(source.refreshToken) : undefined,
          expiresAt: source.tokenExpiresAt || undefined,
        };

        // Refresh tokens if expired
        if (tokens.expiresAt && new Date(tokens.expiresAt) < new Date()) {
          if (provider.refreshTokens && tokens.refreshToken) {
            const newTokens = await provider.refreshTokens(tokens);
            if (newTokens) {
              tokens = newTokens;
              await db
                .update(shoppingListSources)
                .set({
                  accessToken: encrypt(newTokens.accessToken),
                  refreshToken: newTokens.refreshToken ? encrypt(newTokens.refreshToken) : source.refreshToken,
                  tokenExpiresAt: newTokens.expiresAt,
                  updatedAt: new Date(),
                })
                .where(eq(shoppingListSources.id, source.id));
            } else {
              results.push({
                sourceId: source.id,
                provider: source.provider,
                success: false,
                error: 'Token refresh failed',
              });
              continue;
            }
          } else {
            results.push({
              sourceId: source.id,
              provider: source.provider,
              success: false,
              error: 'Access token expired',
            });
            continue;
          }
        }

        // Perform sync by calling the individual sync endpoint logic
        const syncResponse = await fetch(
          `${process.env.BASE_URL || 'http://localhost:3000'}/api/shopping-list-sources/${source.id}/sync`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: `prism-session=${auth.userId}`, // Pass session for auth
            },
          }
        );

        if (syncResponse.ok) {
          const syncResult = await syncResponse.json();
          results.push({
            sourceId: source.id,
            provider: source.provider,
            success: true,
            result: syncResult,
          });
        } else {
          const errorData = await syncResponse.json();
          results.push({
            sourceId: source.id,
            provider: source.provider,
            success: false,
            error: errorData.error || 'Sync failed',
          });
        }
      } catch (error) {
        results.push({
          sourceId: source.id,
          provider: source.provider,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    await invalidateCache('shopping:*');
    await invalidateCache('shopping-list-sources:*');

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      synced: successCount,
      total: sources.length,
      results,
    });
  } catch (error) {
    console.error('Sync-all error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
