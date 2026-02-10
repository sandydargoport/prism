/**
 *
 * Handles HTTP requests for calendar sources (connections to external calendars).
 *
 * ENDPOINT: /api/calendars
 * - GET:  List all calendar sources
 * - POST: Add a new calendar source (for local calendars)
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { calendarSources, users, calendarGroups } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';

/**
 * GET /api/calendars
 * Lists all calendar sources with their sync status
 */
export async function GET() {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ calendars: [], total: 0 });
  }

  try {
    // Sort by createdAt to maintain stable order regardless of user assignment changes
    const sources = await db
      .select({
        id: calendarSources.id,
        provider: calendarSources.provider,
        sourceCalendarId: calendarSources.sourceCalendarId,
        dashboardCalendarName: calendarSources.dashboardCalendarName,
        displayName: calendarSources.displayName,
        color: calendarSources.color,
        enabled: calendarSources.enabled,
        showInEventModal: calendarSources.showInEventModal,
        isFamily: calendarSources.isFamily,
        groupId: calendarSources.groupId,
        lastSynced: calendarSources.lastSynced,
        syncErrors: calendarSources.syncErrors,
        createdAt: calendarSources.createdAt,
        // User info
        userId: calendarSources.userId,
        userName: users.name,
        userColor: users.color,
        // Group info
        groupName: calendarGroups.name,
        groupColor: calendarGroups.color,
      })
      .from(calendarSources)
      .leftJoin(users, eq(calendarSources.userId, users.id))
      .leftJoin(calendarGroups, eq(calendarSources.groupId, calendarGroups.id))
      .orderBy(asc(calendarSources.createdAt));

    const formattedSources = sources.map((source) => ({
      id: source.id,
      provider: source.provider,
      sourceCalendarId: source.sourceCalendarId,
      dashboardCalendarName: source.dashboardCalendarName,
      displayName: source.displayName,
      color: source.color || source.userColor,
      enabled: source.enabled,
      showInEventModal: source.showInEventModal,
      isFamily: source.isFamily,
      groupId: source.groupId,
      groupName: source.groupName,
      groupColor: source.groupColor,
      lastSynced: source.lastSynced?.toISOString() || null,
      syncErrors: source.syncErrors,
      createdAt: source.createdAt.toISOString(),
      // For family calendars, return a virtual "Family" user
      user: source.isFamily
        ? { id: 'FAMILY', name: 'Family', color: '#F59E0B' }
        : source.userId
          ? {
              id: source.userId,
              name: source.userName,
              color: source.userColor,
            }
          : null,
    }));

    return NextResponse.json({
      calendars: formattedSources,
      total: formattedSources.length,
    });
  } catch (error) {
    console.error('Error fetching calendar sources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar sources' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/calendars
 * Creates a new local calendar source
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Calendar name is required' },
        { status: 400 }
      );
    }

    // Validate color format if provided
    if (body.color && !/^#[0-9A-Fa-f]{6}$/.test(body.color)) {
      return NextResponse.json(
        { error: 'Color must be a valid hex color (e.g., #3B82F6)' },
        { status: 400 }
      );
    }

    // Create the calendar source
    const [newCalendar] = await db
      .insert(calendarSources)
      .values({
        provider: 'local',
        sourceCalendarId: `local_${Date.now()}`,
        dashboardCalendarName: body.name.trim(),
        displayName: body.name.trim(),
        color: body.color || null,
        userId: body.userId || null,
        enabled: true,
      })
      .returning();

    if (!newCalendar) {
      return NextResponse.json(
        { error: 'Failed to create calendar' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        id: newCalendar.id,
        provider: newCalendar.provider,
        dashboardCalendarName: newCalendar.dashboardCalendarName,
        displayName: newCalendar.displayName,
        color: newCalendar.color,
        enabled: newCalendar.enabled,
        createdAt: newCalendar.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating calendar:', error);
    return NextResponse.json(
      { error: 'Failed to create calendar' },
      { status: 500 }
    );
  }
}
