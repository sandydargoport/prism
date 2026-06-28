import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { wishItemSources, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getRedisClient } from '@/lib/cache/getRedisClient';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';

/**
 * POST /api/wish-item-sources/finalize
 *
 * Finalizes the MS To-Do connection for wish lists by creating a wishItemSource
 * with the user-selected MS list.
 *
 * Body: { memberId, externalListId, externalListName }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  try {
    const body = await request.json();
    const { memberId, externalListId, externalListName } = body;

    if (!externalListId) {
      return NextResponse.json(
        { error: 'externalListId is required' },
        { status: 400 }
      );
    }

    if (!memberId) {
      return NextResponse.json(
        { error: 'memberId is required' },
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

    const tempKey = `ms-todo-temp:${auth.userId}:wish:${memberId}`;
    const stored = await redis.get(tempKey);

    if (!stored) {
      return NextResponse.json(
        { error: 'Session expired. Please reconnect Microsoft To-Do.' },
        { status: 401 }
      );
    }

    const { accessToken, refreshToken, tokenExpiresAt, accountEmail } = JSON.parse(stored);

    // Verify the member exists
    const [member] = await db
      .select()
      .from(users)
      .where(eq(users.id, memberId));

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Check if source already exists for this member
    const [existing] = await db
      .select()
      .from(wishItemSources)
      .where(
        and(
          eq(wishItemSources.provider, 'microsoft_todo'),
          eq(wishItemSources.memberId, memberId)
        )
      );

    if (existing) {
      // Update existing source
      await db
        .update(wishItemSources)
        .set({
          accessToken,
          refreshToken: refreshToken || existing.refreshToken,
          tokenExpiresAt: new Date(tokenExpiresAt),
          accountEmail: accountEmail ?? undefined,
          externalListId,
          externalListName: externalListName || null,
          lastSyncError: null,
          updatedAt: new Date(),
        })
        .where(eq(wishItemSources.id, existing.id));
    } else {
      // Create new source
      await db.insert(wishItemSources).values({
        userId: auth.userId,
        provider: 'microsoft_todo',
        memberId,
        externalListId,
        externalListName: externalListName || null,
        accessToken,
        refreshToken,
        tokenExpiresAt: new Date(tokenExpiresAt),
        accountEmail: accountEmail ?? null,
        syncEnabled: true,
      });
    }

    // Clean up temp tokens
    await redis.del(tempKey);

    await invalidateEntity('wish-item-sources');

    logActivity({
      userId: auth.userId,
      action: existing ? 'update' : 'create',
      entityType: 'integration',
      summary: `Finalized wish list sync connection: microsoft_todo (${externalListName || externalListId})`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Error finalizing MS wish connection:', error);
    return NextResponse.json(
      { error: 'Failed to complete Microsoft To-Do connection' },
      { status: 500 }
    );
  }
}
