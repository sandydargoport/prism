/**
 * ENDPOINT: /api/aurora
 * - GET: whether aurora may be seen from the household location right now.
 *
 * Off unless a parent turns on the night sky's aurora setting
 * (AURORA_SETTING). Then NOAA's forecast is fetched at most once every 30
 * minutes, however many displays ask, and only when one asks: the night sky
 * asks only while it is up and dark.
 *
 * RESPONSE:
 *   { enabled: false }                                  setting off; nothing fetched
 *   { enabled: true, chance, forecastAt? }              chance: 'overhead' | 'horizon' | null
 *   502 { error }                                       NOAA did not answer; the sky leaves the line off
 */

import { NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';
import { getDisplayAuth } from '@/lib/auth';
import { getCached } from '@/lib/cache/redis';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { AURORA_SETTING, fetchAurora, type AuroraResponse } from '@/lib/integrations/aurora';
import { logError } from '@/lib/utils/logError';

const AURORA_CACHE_TTL = 30 * 60;

export async function GET() {
  const auth = await getDisplayAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await db.select().from(settings).where(inArray(settings.key, [AURORA_SETTING, 'location']));
  const value = (key: string) => rows.find((r) => r.key === key)?.value;
  if (value(AURORA_SETTING) !== true) return NextResponse.json({ enabled: false } satisfies AuroraResponse);

  // Only a geocoded location will do: the forecast is read at a point.
  const location = value('location') as { lat?: unknown; lon?: unknown } | undefined;
  const lat = location?.lat;
  const lon = location?.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return NextResponse.json({ enabled: true, chance: null } satisfies AuroraResponse);
  }

  try {
    const forecast = await getCached(
      `aurora:${lat.toFixed(1)},${lon.toFixed(1)}`,
      () => fetchAurora(lat, lon),
      AURORA_CACHE_TTL,
    );
    return NextResponse.json({ enabled: true, ...forecast } satisfies AuroraResponse);
  } catch (error) {
    logError('Aurora forecast error:', error);
    return NextResponse.json({ error: 'Aurora forecast unavailable' }, { status: 502 });
  }
}
