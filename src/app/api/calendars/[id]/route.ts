/**
 * ============================================================================
 * PRISM - Individual Calendar Source API Route
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Handles HTTP requests for individual calendar sources.
 *
 * ENDPOINT: /api/calendars/[id]
 * - GET:    Get single calendar source details
 * - PATCH:  Update calendar source (enable/disable, rename, etc.)
 * - DELETE: Remove calendar source
 *
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { calendarSources, events } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/calendars/[id]
 * Gets a single calendar source with sync status
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Calendar ID is required' }, { status: 400 });
  }

  try {
    const calendar = await db.query.calendarSources.findFirst({
      where: eq(calendarSources.id, id),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    if (!calendar) {
      return NextResponse.json({ error: 'Calendar not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: calendar.id,
      provider: calendar.provider,
      sourceCalendarId: calendar.sourceCalendarId,
      dashboardCalendarName: calendar.dashboardCalendarName,
      displayName: calendar.displayName,
      color: calendar.color,
      enabled: calendar.enabled,
      lastSynced: calendar.lastSynced?.toISOString() || null,
      syncErrors: calendar.syncErrors,
      createdAt: calendar.createdAt.toISOString(),
      user: calendar.user,
    });
  } catch (error) {
    console.error('Error fetching calendar:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/calendars/[id]
 * Updates a calendar source
 *
 * REQUEST BODY:
 * {
 *   enabled?: boolean
 *   dashboardCalendarName?: string
 *   color?: string
 * }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Calendar ID is required' }, { status: 400 });
  }

  try {
    const body = await request.json();

    // Check if calendar exists
    const existing = await db.query.calendarSources.findFirst({
      where: eq(calendarSources.id, id),
    });

    if (!existing) {
      return NextResponse.json({ error: 'Calendar not found' }, { status: 404 });
    }

    // Build update object
    const updates: Partial<typeof calendarSources.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (typeof body.enabled === 'boolean') {
      updates.enabled = body.enabled;
    }

    if (body.dashboardCalendarName && typeof body.dashboardCalendarName === 'string') {
      updates.dashboardCalendarName = body.dashboardCalendarName.trim();
    }

    // Handle userId - can be a string (assign) or null (unassign)
    if ('userId' in body) {
      updates.userId = body.userId || null;
    }

    // Handle isFamily flag
    if (typeof body.isFamily === 'boolean') {
      updates.isFamily = body.isFamily;
      // If marking as family, clear the userId
      if (body.isFamily) {
        updates.userId = null;
      }
    }

    // Handle groupId assignment
    if ('groupId' in body) {
      updates.groupId = body.groupId || null;
    }

    // Handle showInEventModal flag
    if (typeof body.showInEventModal === 'boolean') {
      updates.showInEventModal = body.showInEventModal;
    }

    if (body.color) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(body.color)) {
        return NextResponse.json(
          { error: 'Color must be a valid hex color (e.g., #3B82F6)' },
          { status: 400 }
        );
      }
      updates.color = body.color;
    }

    // Update the calendar
    const [updated] = await db
      .update(calendarSources)
      .set(updates)
      .where(eq(calendarSources.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update calendar' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: updated.id,
      provider: updated.provider,
      dashboardCalendarName: updated.dashboardCalendarName,
      displayName: updated.displayName,
      color: updated.color,
      enabled: updated.enabled,
      lastSynced: updated.lastSynced?.toISOString() || null,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Error updating calendar:', error);
    return NextResponse.json(
      { error: 'Failed to update calendar' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/calendars/[id]
 * Removes a calendar source and all its events
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Calendar ID is required' }, { status: 400 });
  }

  try {
    // Check if calendar exists
    const existing = await db.query.calendarSources.findFirst({
      where: eq(calendarSources.id, id),
    });

    if (!existing) {
      return NextResponse.json({ error: 'Calendar not found' }, { status: 404 });
    }

    // Delete the calendar (events will be cascade deleted)
    await db.delete(calendarSources).where(eq(calendarSources.id, id));

    return NextResponse.json({
      message: 'Calendar deleted successfully',
      deletedId: id,
    });
  } catch (error) {
    console.error('Error deleting calendar:', error);
    return NextResponse.json(
      { error: 'Failed to delete calendar' },
      { status: 500 }
    );
  }
}
