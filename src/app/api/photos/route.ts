import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { photos, photoSources } from '@/lib/db/schema';
import { eq, desc, sql, and, like } from 'drizzle-orm';
import { savePhoto } from '@/lib/services/photo-storage';
import { PHOTO_MAX_SIZE_MB, PHOTO_ALLOWED_TYPES } from '@/lib/constants';
import { validateMagicBytes } from '@/lib/utils/validateFileType';
import exifr from 'exifr';

async function extractGps(buffer: Buffer): Promise<{ latitude: string; longitude: string } | null> {
  try {
    const gps = await exifr.gps(buffer);
    if (gps?.latitude != null && gps?.longitude != null) {
      return { latitude: gps.latitude.toString(), longitude: gps.longitude.toString() };
    }
  } catch {
    // No EXIF or no GPS — not an error
  }
  return null;
}
import { getCached } from '@/lib/cache/redis';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { rateLimitGuard } from '@/lib/cache/rateLimit';
import { logError } from '@/lib/utils/logError';

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

    const runQuery = async () => {
      const conditions = [];
      if (sourceId) conditions.push(eq(photos.sourceId, sourceId));
      if (favorite === 'true') conditions.push(eq(photos.favorite, true));
      if (orientation) conditions.push(eq(photos.orientation, orientation as 'landscape' | 'portrait' | 'square'));
      if (usage) {
        const tag = usage.replace(/_or_all$/, '').replace(/_or_both$/, '');
        conditions.push(like(photos.usage, `%${tag}%`));
      }

      // Cross-source dedup (#57). A photo is suppressed if another photo
      // with the same dedupe_key is carried by a source that "beats" it:
      //   - strictly lower priority number (preferred source), OR
      //   - equal priority + lower id (stable tiebreak so exactly one wins).
      // Null-key photos (missing EXIF time/dims) are never suppressed.
      // Scoping to a single sourceId (gallery "view this source") skips
      // dedup so the user can still see every photo within one source.
      if (!sourceId) {
        conditions.push(sql`(
          ${photos.dedupeKey} IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM ${photos} p2
            JOIN ${photoSources} ps2 ON ps2.id = p2.source_id
            JOIN ${photoSources} ps_self ON ps_self.id = ${photos.sourceId}
            WHERE p2.dedupe_key = ${photos.dedupeKey}
              AND p2.id <> ${photos.id}
              AND (
                ps2.priority < ps_self.priority
                OR (ps2.priority = ps_self.priority AND p2.id < ${photos.id})
              )
          )
        )`);
      }

      const orderBy = sort === 'random' ? sql`RANDOM()` : desc(photos.takenAt);

      const query = db.select().from(photos).orderBy(orderBy).limit(limit).offset(offset);
      const results = conditions.length > 0 ? await query.where(and(...conditions)) : await query;

      const totalQuery = db.select({ count: sql<number>`count(*)` }).from(photos);
      const totalResult = conditions.length > 0
        ? await totalQuery.where(and(...conditions))
        : await totalQuery;

      return { photos: results, total: Number(totalResult[0]?.count ?? 0) };
    };

    // Skip caching for random sort — the point is to get a different selection each time
    const result = sort === 'random'
      ? await runQuery()
      : await getCached(
          `photos:${sourceId ?? 'all'}:${favorite ?? 'any'}:${usage ?? 'all'}:${orientation ?? 'any'}:${sort}:${limit}:${offset}`,
          runQuery,
          300
        );

    return NextResponse.json(result);
  } catch (error) {
    logError('Error fetching photos:', error);
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
        if (!newSource) {
          return NextResponse.json({ error: 'Failed to create photo source' }, { status: 500 });
        }
        localSourceId = newSource.id;
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
    const gps = await extractGps(buffer);

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
        latitude: gps?.latitude ?? null,
        longitude: gps?.longitude ?? null,
      })
      .returning();

    await invalidateEntity('photos');

    return NextResponse.json(photo, { status: 201 });
  } catch (error) {
    logError('Error uploading photo:', error);
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
  }
}
