/**
 * ENDPOINT: /api/household-time
 * - GET: The household's time zone, today's date in it, and the week start.
 *
 * For API clients that have to turn a wall time ("3 PM tomorrow") into an
 * instant, such as the MCP server. The zone is the one the server itself uses
 * for "today" (getHouseholdTimezone), including its fallback when none is
 * stored, which reading the raw `timezone` row from /api/settings would miss.
 *
 * RESPONSE:
 * {
 *   timeZone: string      IANA zone, e.g. "America/Chicago"
 *   today: string         YYYY-MM-DD in that zone
 *   now: string           the server's current instant, ISO 8601 UTC
 *   weekStartsOn: 0 | 1   0 = Sunday, 1 = Monday
 * }
 */

import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { getHouseholdTimezone } from '@/lib/householdTimezone';
import { todayKey } from '@/lib/utils/zonedDate';
import { logError } from '@/lib/utils/logError';

export async function GET() {
  const auth = await getDisplayAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const now = new Date();
    const timeZone = await getHouseholdTimezone();
    const [wso] = await db.select().from(settings).where(eq(settings.key, 'weekStartsOn'));
    const weekStartsOn: 0 | 1 = wso?.value === '1' ? 1 : 0;

    return NextResponse.json({
      timeZone,
      today: todayKey(timeZone, now),
      now: now.toISOString(),
      weekStartsOn,
    });
  } catch (error) {
    logError('Error reading household time:', error);
    return NextResponse.json({ error: 'Failed to read household time' }, { status: 500 });
  }
}
