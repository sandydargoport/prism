import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { taskSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/task-sources/sync-all
 *
 * Syncs all enabled task sources. Returns aggregate results.
 * Query params:
 *   - staleMinutes: Only sync sources that haven't synced in X minutes (default: 0 = sync all)
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const staleMinutes = parseInt(searchParams.get('staleMinutes') || '0');

    // Get all enabled sources
    const allSources = await db
      .select()
      .from(taskSources)
      .where(eq(taskSources.syncEnabled, true));

    // Filter to stale sources if requested
    const now = new Date();
    const sourcesToSync = staleMinutes > 0
      ? allSources.filter(s => {
          if (!s.lastSyncAt) return true;
          const lastSync = new Date(s.lastSyncAt);
          const minutesSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60);
          return minutesSinceSync >= staleMinutes;
        })
      : allSources;

    if (sourcesToSync.length === 0) {
      return NextResponse.json({
        synced: 0,
        skipped: allSources.length,
        created: 0,
        updated: 0,
        deleted: 0,
        errors: [],
        message: staleMinutes > 0 ? 'All sources are up to date' : 'No enabled sources',
      });
    }

    // Sync each source
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalDeleted = 0;
    const errors: string[] = [];
    let syncedCount = 0;

    const results = await Promise.allSettled(
      sourcesToSync.map(async (source) => {
        const res = await fetch(
          `${process.env.BASE_URL || 'http://localhost:3000'}/api/task-sources/${source.id}/sync`,
          {
            method: 'POST',
            headers: {
              Cookie: request.headers.get('cookie') || '',
            },
          }
        );
        const data = await res.json();
        return { source, res, data };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { source, res, data } = result.value;
        if (res.ok) {
          syncedCount++;
          totalCreated += data.created || 0;
          totalUpdated += data.updated || 0;
          totalDeleted += data.deleted || 0;
          if (data.errors?.length > 0) {
            errors.push(`${source.externalListName}: ${data.errors.join(', ')}`);
          }
        } else {
          errors.push(`${source.externalListName}: ${data.error || 'Sync failed'}`);
        }
      } else {
        errors.push(`Sync failed: ${result.reason}`);
      }
    }

    return NextResponse.json({
      synced: syncedCount,
      skipped: allSources.length - sourcesToSync.length,
      created: totalCreated,
      updated: totalUpdated,
      deleted: totalDeleted,
      errors,
    });
  } catch (error) {
    console.error('Sync all error:', error);
    return NextResponse.json(
      { error: 'Failed to sync sources' },
      { status: 500 }
    );
  }
}
