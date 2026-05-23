/**
 * Two-way write to a CalDAV calendar.
 *
 * Scoped narrow on purpose: this PR ships the writeback path for review,
 * but does NOT yet wire it into the main /api/events flow. The main events
 * route will mirror the change locally, then call this endpoint when the
 * event lives on a CalDAV source whose `providerConfig.writable === true`.
 * That wiring is the next PR.
 *
 *   POST  /api/caldav/events/[sourceId]                 — create
 *   PATCH /api/caldav/events/[sourceId]?href=…&etag=…   — update
 *   DELETE /api/caldav/events/[sourceId]?href=…&etag=…  — delete
 *
 * Body shape (POST + PATCH): { uid, title, description?, location?,
 * startTime, endTime, allDay? }. Dates are ISO 8601 strings.
 *
 * Requires `canModifySettings` for now — once integrated into /api/events,
 * permissions will be inherited from that route.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { calendarSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  pushCalDAVEventCreate,
  pushCalDAVEventUpdate,
  pushCalDAVEventDelete,
} from '@/lib/services/calendar-sync';
import { logError } from '@/lib/utils/logError';

interface RouteCtx { params: Promise<{ sourceId: string }> }

async function assertWritable(sourceId: string): Promise<true | NextResponse> {
  const source = await db.query.calendarSources.findFirst({
    where: eq(calendarSources.id, sourceId),
  });
  if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  if (source.provider !== 'caldav') {
    return NextResponse.json({ error: 'Not a CalDAV source' }, { status: 400 });
  }
  const cfg = (source.providerConfig as Record<string, unknown> | null) ?? {};
  if (cfg.writable !== true) {
    return NextResponse.json(
      { error: 'CalDAV source is not flagged writable. Set providerConfig.writable=true to enable two-way write.' },
      { status: 403 },
    );
  }
  return true;
}

interface BodyShape {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startTime: string;
  endTime: string;
  allDay?: boolean;
}

function parseBody(body: BodyShape) {
  return {
    uid: body.uid,
    title: body.title,
    description: body.description,
    location: body.location,
    startTime: new Date(body.startTime),
    endTime: new Date(body.endTime),
    allDay: body.allDay,
  };
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  const { sourceId } = await ctx.params;
  const writable = await assertWritable(sourceId);
  if (writable !== true) return writable;

  try {
    const body = (await req.json()) as BodyShape;
    const result = await pushCalDAVEventCreate(sourceId, parseBody(body));
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ href: result.href }, { status: 201 });
  } catch (err) {
    logError('CalDAV event create failed', err);
    return NextResponse.json({ error: 'Create failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  const { sourceId } = await ctx.params;
  const writable = await assertWritable(sourceId);
  if (writable !== true) return writable;

  const href = req.nextUrl.searchParams.get('href');
  const etag = req.nextUrl.searchParams.get('etag') ?? undefined;
  if (!href) return NextResponse.json({ error: 'href required' }, { status: 400 });

  try {
    const body = (await req.json()) as BodyShape;
    const result = await pushCalDAVEventUpdate(sourceId, href, etag, parseBody(body));
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError('CalDAV event update failed', err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  const { sourceId } = await ctx.params;
  const writable = await assertWritable(sourceId);
  if (writable !== true) return writable;

  const href = req.nextUrl.searchParams.get('href');
  const etag = req.nextUrl.searchParams.get('etag') ?? undefined;
  if (!href) return NextResponse.json({ error: 'href required' }, { status: 400 });

  try {
    const result = await pushCalDAVEventDelete(sourceId, href, etag);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError('CalDAV event delete failed', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
