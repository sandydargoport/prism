/**
 * Hide an event in Prism without deleting it (#592).
 *
 *   PUT    → hide it. The event stays in its source calendar and in the
 *            database; every read path leaves it out, and no sync unhides it.
 *   DELETE → show it again.
 *
 * Parents only (canEditAnyEvent), whoever created the event. Nothing is sent
 * to Google or CalDAV.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { events } from '@/lib/db/schema';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function setHidden(request: NextRequest, { params }: RouteParams, hidden: boolean) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canEditAnyEvent');
  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const [updated] = await db
      .update(events)
      .set({ hiddenAt: hidden ? new Date() : null })
      .where(eq(events.id, id))
      .returning({ id: events.id, title: events.title });

    if (!updated) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    await invalidateEntity('events');

    logActivity({
      userId: auth.userId,
      action: 'update',
      entityType: 'event',
      entityId: updated.id,
      summary: `${hidden ? 'Hid' : 'Unhid'} event: ${updated.title}`,
    });

    return NextResponse.json({ id: updated.id, hidden });
  } catch (error) {
    logError(`Error ${hidden ? 'hiding' : 'unhiding'} event:`, error);
    return NextResponse.json(
      { error: hidden ? 'Failed to hide event' : 'Failed to unhide event' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, ctx: RouteParams) {
  return setHidden(request, ctx, true);
}

export async function DELETE(request: NextRequest, ctx: RouteParams) {
  return setHidden(request, ctx, false);
}
