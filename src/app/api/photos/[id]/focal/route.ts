import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { getDisplayAuth } from '@/lib/auth';
import { screenKey } from '@/lib/auth/everydayAuth';
import { rateLimitGuard } from '@/lib/cache/rateLimit';
import { db } from '@/lib/db/client';
import { photos } from '@/lib/db/schema';
import { isFocalCoordinate } from '@/lib/photos/focalPoint';
import { logError } from '@/lib/utils/logError';

/** Focal points one screen may store in a minute. */
// Not exported: a route file may export only its handlers (next build refuses others).
const FOCAL_WRITES_PER_MINUTE = 20;

/**
 * Store a photo's focal point (#956), found in the browser.
 *
 * Narrow on purpose, so a signed-out wall may call it: two numbers from 0 to
 * 1, written only while the photo has none (a found point is never replaced
 * from here), and a few a minute per screen.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getDisplayAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = await rateLimitGuard(`focal:${await screenKey()}`, 'photo-focal', FOCAL_WRITES_PER_MINUTE, 60);
  if (limited) return limited;

  const { id } = await params;
  const body = await request.json().catch(() => null) as { x?: unknown; y?: unknown } | null;
  if (!body || !isFocalCoordinate(body.x) || !isFocalCoordinate(body.y)) {
    return NextResponse.json({ error: 'x and y must be numbers from 0 to 1' }, { status: 400 });
  }

  try {
    const updated = await db.update(photos)
      .set({ focalX: body.x, focalY: body.y })
      .where(and(eq(photos.id, id), isNull(photos.focalX)))
      .returning({ id: photos.id });
    if (updated.length === 0) {
      const [exists] = await db.select({ id: photos.id }).from(photos).where(eq(photos.id, id));
      return exists
        ? NextResponse.json({ error: 'Focal point already set' }, { status: 409 })
        : NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ id, focalX: body.x, focalY: body.y });
  } catch (error) {
    logError('Error storing a focal point:', error);
    return NextResponse.json({ error: 'Failed to store the focal point' }, { status: 500 });
  }
}
