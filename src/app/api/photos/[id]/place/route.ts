import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDisplayAuth } from '@/lib/auth';
import { rateLimitGuard } from '@/lib/cache/rateLimit';
import { db } from '@/lib/db/client';
import { photos, settings } from '@/lib/db/schema';
import { PHOTO_PLACE_SETTING } from '@/lib/photos/caption';
import { reversePlace } from '@/lib/photos/place';
import { logError } from '@/lib/utils/logError';

/**
 * The place a photo was taken (#958). Only while the household has turned on
 * "Show where photos were taken": otherwise it answers null and looks nothing
 * up. Looked up once per photo and stored; the public geocoder asks for no
 * more than one request a second, so the whole install keeps under that.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getDisplayAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  try {
    const [setting] = await db.select().from(settings).where(eq(settings.key, PHOTO_PLACE_SETTING));
    if (setting?.value !== true) return NextResponse.json({ place: null });

    const [photo] = await db.select({
      placeName: photos.placeName, placeLookedUp: photos.placeLookedUp,
      latitude: photos.latitude, longitude: photos.longitude,
    }).from(photos).where(eq(photos.id, id));
    if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (photo.placeLookedUp || photo.latitude == null || photo.longitude == null) {
      return NextResponse.json({ place: photo.placeName ?? null });
    }

    const limited = await rateLimitGuard('install', 'photo-place-geocode', 1, 2);
    if (limited) return NextResponse.json({ place: null, later: true });

    const place = await reversePlace(Number(photo.latitude), Number(photo.longitude));
    await db.update(photos).set({ placeName: place, placeLookedUp: true }).where(eq(photos.id, id));
    return NextResponse.json({ place });
  } catch (error) {
    logError('Error finding a photo place:', error);
    return NextResponse.json({ place: null });
  }
}
