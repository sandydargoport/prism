/**
 * POST /api/displays/heartbeat
 *
 * A named screen says it is still on, so Settings > Screens can show
 * "online 2 min ago" (#690). The signed display cookie is the only credential:
 * all a caller can do is touch the timestamp of the screen it already is.
 *
 * Writes at most once a minute per screen, however often it is called. A
 * screen whose row was removed is told so, and its cookies are cleared, so it
 * goes back to being an unnamed browser and stops calling.
 *
 * REQUEST BODY (optional): { width: number, height: number }, the screen's
 * size in CSS pixels, kept so a phone editing it can show it at its own size
 * and shape (#1153). Stored with the once-a-minute write, or at once when it
 * changed.
 *
 * Also optional: { perfLevel: 'full' | 'reduced' | 'minimal', reducedMotion:
 * boolean }, how the screen runs (#1289). Either below Full or asking for
 * less motion turns its fireworks into a fade; Settings > Screens says so.
 * Stored the same way.
 *
 * RESPONSE: { display: { id, name, settingsUpdatedAt, editing } | null }. The
 * screen compares settingsUpdatedAt with what it last synced to notice an
 * edit made from another device; `editing` is true while another device is
 * editing it, so it can say so.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { and, eq, isNull, lt, ne, or } from 'drizzle-orm';
import { cleanScreenSide, currentDisplayId, isBeingEdited, setDisplayCookies } from '@/lib/auth/displayIdentity';
import { db } from '@/lib/db/client';
import { displays } from '@/lib/db/schema';
import { isLevel } from '@/lib/perfLevel';
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

  const body = await request.json().catch(() => null);
  const width = cleanScreenSide(body?.width);
  const height = cleanScreenSide(body?.height);
  const size = width && height ? { screenWidth: width, screenHeight: height } : null;
  const perfLevel = isLevel(body?.perfLevel) ? body.perfLevel : null;
  const reducedMotion = typeof body?.reducedMotion === 'boolean' ? body.reducedMotion : null;

  try {
    const now = new Date();
    const stale = or(isNull(displays.lastSeenAt), lt(displays.lastSeenAt, new Date(now.getTime() - WRITE_EVERY_MS)));
    // Written at once when any of these changed, otherwise with the minute's write.
    const changed = [
      ...(size ? [isNull(displays.screenWidth), ne(displays.screenWidth, size.screenWidth), ne(displays.screenHeight, size.screenHeight)] : []),
      ...(perfLevel ? [isNull(displays.perfLevel), ne(displays.perfLevel, perfLevel)] : []),
      ...(reducedMotion !== null ? [isNull(displays.reducedMotion), ne(displays.reducedMotion, reducedMotion)] : []),
    ];
    await db
      .update(displays)
      .set({
        lastSeenAt: now,
        ...(size ?? {}),
        ...(perfLevel ? { perfLevel } : {}),
        ...(reducedMotion !== null ? { reducedMotion } : {}),
      })
      .where(and(eq(displays.id, id), or(stale, ...changed)));
    const [row] = await db.select().from(displays).where(eq(displays.id, id));
    if (!row) {
      setDisplayCookies(await cookies(), null, requestIsSecure(request));
      return NextResponse.json({ display: null });
    }
    return NextResponse.json({
      display: {
        id: row.id,
        name: row.name,
        settingsUpdatedAt: row.settingsUpdatedAt?.toISOString() ?? null,
        editing: isBeingEdited(row.editingAt ?? null, now.getTime()),
      },
    });
  } catch (error) {
    logError('Display heartbeat failed:', error);
    return NextResponse.json({ error: 'Heartbeat failed' }, { status: 500 });
  }
}
