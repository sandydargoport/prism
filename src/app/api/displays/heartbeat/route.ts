/**
 * POST /api/displays/heartbeat
 *
 * A named screen says it is still on, so Settings > Displays can show
 * "online 2 min ago" (#690). The signed display cookie is the only credential:
 * all a caller can do is touch the timestamp of the screen it already is.
 *
 * Writes at most once a minute per screen, however often it is called. A
 * screen whose row was removed is told so, and its cookies are cleared, so it
 * goes back to being an unnamed browser and stops calling.
 *
 * RESPONSE: { display: { id, name } | null }
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { currentDisplayId, setDisplayCookies } from '@/lib/auth/displayIdentity';
import { db } from '@/lib/db/client';
import { displays } from '@/lib/db/schema';
import { logError } from '@/lib/utils/logError';

const WRITE_EVERY_MS = 60 * 1000;

/** Mirrors the session cookies: secure only when the request arrived over TLS. */
function requestIsSecure(request: NextRequest): boolean {
  return (
    request.nextUrl.protocol === 'https:' ||
    request.headers.get('x-forwarded-proto') === 'https'
  );
}

export async function POST(request: NextRequest) {
  const id = await currentDisplayId();
  if (!id) return NextResponse.json({ display: null });

  try {
    const now = new Date();
    await db
      .update(displays)
      .set({ lastSeenAt: now })
      .where(and(
        eq(displays.id, id),
        or(isNull(displays.lastSeenAt), lt(displays.lastSeenAt, new Date(now.getTime() - WRITE_EVERY_MS))),
      ));
    const [row] = await db.select().from(displays).where(eq(displays.id, id));
    if (!row) {
      setDisplayCookies(await cookies(), null, requestIsSecure(request));
      return NextResponse.json({ display: null });
    }
    return NextResponse.json({ display: { id: row.id, name: row.name } });
  } catch (error) {
    logError('Display heartbeat failed:', error);
    return NextResponse.json({ error: 'Heartbeat failed' }, { status: 500 });
  }
}
