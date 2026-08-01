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
import { logError } from '@/lib/utils/logError';
import { invalidateEntity } from '@/lib/cache/cacheKeys';

/**
 * Ensure every family member has a personal local calendar, plus one shared
 * "Family" local calendar — so events created in-app can be assigned to a
 * person (or the household) with zero third-party integrations. Idempotent and
 * cheap: seeded lazily on calendar load, which also backfills existing installs.
 *
 * These are plain local sources carrying `userId` / `isFamily`; the existing
 * group seeder (GET /api/calendar-groups → seedDefaultGroups) then files each
 * under the member's own calendar group, so they inherit that person's
 * visibility toggle and color rather than showing as separate switches. Even
 * before grouping runs, ownership/color already resolve from the source's user.
 */
async function ensureDefaultCalendars() {
  const allUsers = await db
    .select({ id: users.id, name: users.name, color: users.color })
    .from(users);
  // Pre-setup (no members yet) — nothing to seed.
  if (allUsers.length === 0) return;

  const existing = await db
    .select({
      userId: calendarSources.userId,
      isFamily: calendarSources.isFamily,
      provider: calendarSources.provider,
    })
    .from(calendarSources);

  const membersWithLocal = new Set(
    existing.filter((s) => s.provider === 'local' && s.userId).map((s) => s.userId!)
  );
  const hasFamilyLocal = existing.some((s) => s.provider === 'local' && s.isFamily);

  const toInsert: (typeof calendarSources.$inferInsert)[] = [];
  for (const u of allUsers) {
    if (!membersWithLocal.has(u.id)) {
      toInsert.push({
        provider: 'local',
        sourceCalendarId: `local_user_${u.id}`,
        dashboardCalendarName: u.name,
        displayName: u.name,
        color: u.color || null,
        userId: u.id,
        enabled: true,
        showInEventModal: true,
      });
    }
  }
  if (!hasFamilyLocal) {
    toInsert.push({
      provider: 'local',
      sourceCalendarId: 'local_family',
      dashboardCalendarName: 'Family',
      displayName: 'Family',
      color: '#F59E0B',
      isFamily: true,
      enabled: true,
      showInEventModal: true,
    });
  }

  if (toInsert.length > 0) {
    await db.insert(calendarSources).values(toInsert);
    // The sources list (this endpoint) is uncached, so new rows show up on the
    // next fetch immediately. Invalidate the cached groups so the group seeder
    // re-files these sources under their member/family groups.
    await invalidateEntity('calendar-groups');
  }
}

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
    await ensureDefaultCalendars();

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
        providerConfig: calendarSources.providerConfig,
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
      providerConfig: source.providerConfig,
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
    logError('Error fetching calendar sources:', error);
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
    logError('Error creating calendar:', error);
    return NextResponse.json(
      { error: 'Failed to create calendar' },
      { status: 500 }
    );
  }
}
