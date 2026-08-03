import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { photos } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logError } from '@/lib/utils/logError';

const VALID_TAGS = ['wallpaper', 'gallery', 'screensaver'] as const;
type UsageTag = (typeof VALID_TAGS)[number];

/**
 * Bulk add/remove a single usage tag (wallpaper | gallery | screensaver) across
 * many photos at once, preserving each photo's other tags. Used by the photo
 * library's select mode to toggle W/G/S en masse.
 *
 * Body: { ids: string[], tag: UsageTag, action: 'add' | 'remove' }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.ids)
      ? body.ids.filter((x: unknown) => typeof x === 'string')
      : [];
    const tag = body.tag as UsageTag;
    const action = body.action as 'add' | 'remove';

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No photos selected.' }, { status: 400 });
    }
    if (!VALID_TAGS.includes(tag)) {
      return NextResponse.json({ error: 'Invalid usage tag.' }, { status: 400 });
    }
    if (action !== 'add' && action !== 'remove') {
      return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    }

    const rows = await db
      .select({ id: photos.id, usage: photos.usage })
      .from(photos)
      .where(inArray(photos.id, ids));
    if (rows.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    // Compute each row's new usage, then batch by resulting value so we issue
    // one UPDATE per distinct usage string (a handful) rather than one per row.
    const byNewUsage = new Map<string, string[]>();
    for (const row of rows) {
      const tags = new Set(
        (row.usage ?? '').split(',').filter((t): t is UsageTag =>
          VALID_TAGS.includes(t as UsageTag),
        ),
      );
      if (action === 'add') tags.add(tag);
      else tags.delete(tag);
      // Keep canonical W,G,S order so values dedupe cleanly.
      const newUsage = VALID_TAGS.filter((t) => tags.has(t)).join(',');
      if (newUsage === (row.usage ?? '')) continue; // no-op for this row
      const group = byNewUsage.get(newUsage) ?? [];
      group.push(row.id);
      byNewUsage.set(newUsage, group);
    }

    let updated = 0;
    for (const [newUsage, groupIds] of byNewUsage) {
      await db.update(photos).set({ usage: newUsage }).where(inArray(photos.id, groupIds));
      updated += groupIds.length;
    }

    if (updated > 0) await invalidateEntity('photos');

    return NextResponse.json({ updated });
  } catch (error) {
    logError('Error bulk-updating photo usage:', error);
    return NextResponse.json({ error: 'Failed to update photos' }, { status: 500 });
  }
}
