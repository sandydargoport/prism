/**
 * Timelines (#1266): named plans for a screen's day. See src/lib/timeline.ts.
 *
 * GET  — every timeline, the household's first first, each with how many
 *        named screens follow it. Readable wherever the dashboards are, since
 *        every screen needs its own to know what to show and when to rest.
 * POST — a new timeline. Parent only. Body: { name } for an empty one, or
 *        { copyOf: id, name? } to start from an existing one (Duplicate).
 *        It goes last in the list.
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq, max } from 'drizzle-orm';
import { getDisplayAuth, requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { timelines } from '@/lib/db/schema';
import { isDisplayId } from '@/lib/auth/displayIdentity';
import { listTimelines } from '@/lib/services/timelines';
import { logActivity } from '@/lib/services/auditLog';
import { copyName, duplicateOf, TIMELINE_NAME_MAX_LENGTH, toTimeline } from '@/lib/timeline';
import { logError } from '@/lib/utils/logError';

export async function GET() {
  const auth = await getDisplayAuth();
  if (!auth) return NextResponse.json({ timelines: [] });
  try {
    return NextResponse.json({ timelines: await listTimelines() });
  } catch (error) {
    logError('Failed to list timelines:', error);
    return NextResponse.json({ error: 'Failed to list timelines' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = requireRole(auth, 'canModifySettings');
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const rawName = typeof body?.name === 'string' ? body.name.trim() : '';
  if (body?.name !== undefined && (!rawName || rawName.length > TIMELINE_NAME_MAX_LENGTH)) {
    return NextResponse.json({ error: `Give the timeline a name of up to ${TIMELINE_NAME_MAX_LENGTH} characters.` }, { status: 400 });
  }
  if (body?.copyOf !== undefined && (typeof body.copyOf !== 'string' || !isDisplayId(body.copyOf))) {
    return NextResponse.json({ error: 'Not a timeline' }, { status: 400 });
  }
  if (!rawName && body?.copyOf === undefined) {
    return NextResponse.json({ error: 'Give the timeline a name.' }, { status: 400 });
  }

  try {
    const all = await listTimelines();
    const [highest] = await db.select({ last: max(timelines.position) }).from(timelines);
    const position = (highest?.last ?? 0) + 1;

    let values: typeof timelines.$inferInsert;
    if (body?.copyOf !== undefined) {
      const source = all.find((t) => t.id === body.copyOf);
      if (!source) return NextResponse.json({ error: 'That timeline does not exist' }, { status: 404 });
      values = { ...duplicateOf(source, rawName || copyName(source.name, all.map((t) => t.name))), position };
    } else {
      values = { name: rawName, position };
    }

    const [row] = await db.insert(timelines).values(values).returning();
    if (!row) throw new Error('insert returned nothing');
    logActivity({
      userId: auth.userId,
      action: 'create',
      entityType: 'timeline',
      entityId: row.id,
      summary: body?.copyOf !== undefined ? `Duplicated a timeline as "${row.name}"` : `Added the timeline "${row.name}"`,
    });
    // Read back through the list so the new one has its count.
    const [created] = (await db.select().from(timelines).where(eq(timelines.id, row.id))).map((r) => toTimeline(r, 0));
    return NextResponse.json({ timeline: created }, { status: 201 });
  } catch (error) {
    logError('Failed to add a timeline:', error);
    return NextResponse.json({ error: 'Failed to add the timeline' }, { status: 500 });
  }
}
