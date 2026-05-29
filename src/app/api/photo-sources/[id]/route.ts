import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { photoSources, photos } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { deletePhoto } from '@/lib/services/photo-storage';
import { clearSourceCache } from '@/lib/services/photo-cache';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logError } from '@/lib/utils/logError';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.name === 'string') updates.name = body.name;
    if (typeof body.enabled === 'boolean') updates.enabled = body.enabled;
    if (typeof body.onedriveFolderId === 'string') updates.onedriveFolderId = body.onedriveFolderId;
    // Cross-source dedup priority (lower = preferred). Changing it takes
    // effect immediately because dedup resolves at read time (#57).
    if (typeof body.priority === 'number' && Number.isFinite(body.priority)) {
      updates.priority = Math.trunc(body.priority);
    }

    const [updated] = await db
      .update(photoSources)
      .set(updates)
      .where(eq(photoSources.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    logError('Error updating photo source:', error);
    return NextResponse.json({ error: 'Failed to update photo source' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    // Delete locally-stored files (skip external/proxied photos — they have
    // no file on disk under data/photos/originals).
    const sourcePhotos = await db
      .select()
      .from(photos)
      .where(eq(photos.sourceId, id));

    for (const photo of sourcePhotos) {
      if (photo.isExternal) continue;
      await deletePhoto(photo.filename, photo.thumbnailPath);
    }

    // Wipe the proxy cache for this source (no-op for non-Immich sources).
    await clearSourceCache(id);

    // Cascade delete will remove photos from DB
    await db.delete(photoSources).where(eq(photoSources.id, id));

    await invalidateEntity('photos');

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Error deleting photo source:', error);
    return NextResponse.json({ error: 'Failed to delete photo source' }, { status: 500 });
  }
}
