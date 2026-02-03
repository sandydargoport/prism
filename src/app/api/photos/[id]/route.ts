import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { photos } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { deletePhoto } from '@/lib/services/photo-storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const photo = await db.query.photos.findFirst({
      where: eq(photos.id, id),
    });

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    return NextResponse.json(photo);
  } catch (error) {
    console.error('Error fetching photo:', error);
    return NextResponse.json({ error: 'Failed to fetch photo' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    if (typeof body.favorite === 'boolean') {
      updates.favorite = body.favorite;
    }
    if (typeof body.usage === 'string') {
      // Validate each tag in comma-separated string
      const validTags = ['wallpaper', 'gallery', 'screensaver'];
      const tags = body.usage.split(',').filter((t: string) => validTags.includes(t));
      updates.usage = tags.join(',') || '';
    }

    const [updated] = await db
      .update(photos)
      .set(updates)
      .where(eq(photos.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating photo:', error);
    return NextResponse.json({ error: 'Failed to update photo' }, { status: 500 });
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
    const photo = await db.query.photos.findFirst({
      where: eq(photos.id, id),
    });

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    await deletePhoto(photo.filename, photo.thumbnailPath);
    await db.delete(photos).where(eq(photos.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting photo:', error);
    return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 });
  }
}
