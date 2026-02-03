import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { photos } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getPhotoPath } from '@/lib/services/photo-storage';
import { promises as fs } from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const thumb = searchParams.get('thumb') === 'true';

    const photo = await db.query.photos.findFirst({
      where: eq(photos.id, id),
    });

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const filename = thumb && photo.thumbnailPath
      ? photo.thumbnailPath
      : photo.filename;
    const filePath = getPhotoPath(filename, thumb && !!photo.thumbnailPath);

    const fileBuffer = await fs.readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': photo.mimeType,
        'Cache-Control': 'public, max-age=86400, immutable',
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error serving photo:', error);
    return NextResponse.json({ error: 'Failed to serve photo' }, { status: 500 });
  }
}
