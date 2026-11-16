import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { photoSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { syncOneDriveSource, syncImmichSource } from '@/lib/services/photo-sync';
import { logError } from '@/lib/utils/logError';
import { invalidateEntity } from '@/lib/cache/cacheKeys';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const source = await db.query.photoSources.findFirst({
      where: eq(photoSources.id, id),
    });
    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    if (source.type === 'immich') {
      await syncImmichSource(id);
    } else if (source.type === 'onedrive') {
      await syncOneDriveSource(id);
    } else {
      return NextResponse.json(
        { error: `Sync not supported for source type "${source.type}"` },
        { status: 400 },
      );
    }
    // The photo list is cached; new and removed photos show at once.
    await invalidateEntity('photos');

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Error syncing photo source:', error);
    // A sync that failed part way may still have written photos.
    await invalidateEntity('photos').catch(() => {});
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
