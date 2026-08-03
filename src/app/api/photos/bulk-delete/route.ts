import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { photos, excludedPhotos } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import { deletePhoto } from '@/lib/services/photo-storage';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logError } from '@/lib/utils/logError';

/**
 * Bulk "remove from Prism" for photos. Deletes the Prism records + their local
 * files, and — for synced photos (those with an externalId) — records an
 * excludedPhotos tombstone so a future pull sync won't re-download them. This
 * NEVER touches the photo in OneDrive/Immich; it only removes it from Prism.
 *
 * Body: { ids: string[] }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.ids)
      ? body.ids.filter((x: unknown) => typeof x === 'string')
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: 'No photos selected.' }, { status: 400 });
    }

    const targets = await db.select().from(photos).where(inArray(photos.id, ids));
    if (targets.length === 0) {
      return NextResponse.json({ deleted: 0, excluded: 0 });
    }

    // Tombstone synced photos so the next sync skips re-adding them. Local
    // uploads (no externalId) have no remote to boomerang from, so no tombstone.
    const tombstones = targets
      .filter((p): p is typeof p & { externalId: string } => !!p.externalId)
      .map((p) => ({ sourceId: p.sourceId, externalId: p.externalId }));
    if (tombstones.length > 0) {
      await db.insert(excludedPhotos).values(tombstones).onConflictDoNothing();
    }

    // Remove local files (missing files are ignored) — never the remote source.
    for (const p of targets) {
      await deletePhoto(p.filename, p.thumbnailPath);
    }

    await db.delete(photos).where(
      inArray(
        photos.id,
        targets.map((t) => t.id),
      ),
    );
    await invalidateEntity('photos');

    return NextResponse.json({
      deleted: targets.length,
      excluded: tombstones.length,
    });
  } catch (error) {
    logError('Error bulk-deleting photos:', error);
    return NextResponse.json({ error: 'Failed to delete photos' }, { status: 500 });
  }
}
