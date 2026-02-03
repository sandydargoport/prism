import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { photoSources, photos } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { deletePhoto } from '@/lib/services/photo-storage';

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
    console.error('Error updating photo source:', error);
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

    // Delete all photo files for this source
    const sourcePhotos = await db
      .select()
      .from(photos)
      .where(eq(photos.sourceId, id));

    for (const photo of sourcePhotos) {
      await deletePhoto(photo.filename, photo.thumbnailPath);
    }

    // Cascade delete will remove photos from DB
    await db.delete(photoSources).where(eq(photoSources.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting photo source:', error);
    return NextResponse.json({ error: 'Failed to delete photo source' }, { status: 500 });
  }
}
