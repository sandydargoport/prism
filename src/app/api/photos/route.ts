import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { photos, photoSources } from '@/lib/db/schema';
import { eq, desc, sql, and, like } from 'drizzle-orm';
import { savePhoto } from '@/lib/services/photo-storage';
import { PHOTO_MAX_SIZE_MB, PHOTO_ALLOWED_TYPES } from '@/lib/constants';
import { validateMagicBytes } from '@/lib/utils/validateFileType';
import { rateLimitGuard } from '@/lib/cache/rateLimit';

export async function GET(request: NextRequest) {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ photos: [], total: 0 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId');
    const favorite = searchParams.get('favorite');
    const usage = searchParams.get('usage');
    const orientation = searchParams.get('orientation');
    const sort = searchParams.get('sort') || 'chronological';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const conditions = [];
    if (sourceId) conditions.push(eq(photos.sourceId, sourceId));
    if (favorite === 'true') conditions.push(eq(photos.favorite, true));
    if (orientation) conditions.push(eq(photos.orientation, orientation as 'landscape' | 'portrait' | 'square'));
    // Usage filter: match photos whose comma-separated usage field contains the tag
    if (usage) {
      // Support legacy _or_all / _or_both queries
      const tag = usage.replace(/_or_all$/, '').replace(/_or_both$/, '');
      conditions.push(like(photos.usage, `%${tag}%`));
    }

    const orderBy = sort === 'random'
      ? sql`RANDOM()`
      : desc(photos.takenAt);

    const query = db
      .select()
      .from(photos)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const results = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    const totalQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(photos);

    const totalResult = conditions.length > 0
      ? await totalQuery.where(and(...conditions))
      : await totalQuery;

    const total = Number(totalResult[0]?.count ?? 0);

    return NextResponse.json({ photos: results, total });
  } catch (error) {
    console.error('Error fetching photos:', error);
    return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const limited = await rateLimitGuard(auth.userId, 'photo-upload', 20, 60);
  if (limited) return limited;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const sourceId = formData.get('sourceId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!PHOTO_ALLOWED_TYPES.includes(file.type as typeof PHOTO_ALLOWED_TYPES[number])) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    if (file.size > PHOTO_MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json({ error: `File too large (max ${PHOTO_MAX_SIZE_MB}MB)` }, { status: 400 });
    }

    // Ensure a local source exists
    let localSourceId = sourceId;
    if (!localSourceId) {
      const existing = await db.query.photoSources.findFirst({
        where: eq(photoSources.type, 'local'),
      });
      if (existing) {
        localSourceId = existing.id;
      } else {
        const [newSource] = await db
          .insert(photoSources)
          .values({ type: 'local', name: 'Local Uploads' })
          .returning();
        localSourceId = newSource!.id;
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const detectedType = validateMagicBytes(buffer, PHOTO_ALLOWED_TYPES);
    if (!detectedType) {
      return NextResponse.json({ error: 'File content does not match an allowed image type' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${crypto.randomUUID()}.${ext}`;

    const result = await savePhoto(buffer, filename);

    // Auto-detect orientation from dimensions
    let orientation: 'landscape' | 'portrait' | 'square' | undefined;
    if (result.width && result.height) {
      if (result.width > result.height) orientation = 'landscape';
      else if (result.height > result.width) orientation = 'portrait';
      else orientation = 'square';
    }

    const [photo] = await db
      .insert(photos)
      .values({
        sourceId: localSourceId,
        filename,
        originalFilename: file.name,
        mimeType: file.type,
        width: result.width,
        height: result.height,
        sizeBytes: result.sizeBytes,
        thumbnailPath: result.thumbnailPath,
        orientation,
      })
      .returning();

    return NextResponse.json(photo, { status: 201 });
  } catch (error) {
    console.error('Error uploading photo:', error);
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
  }
}
