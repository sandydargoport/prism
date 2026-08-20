/**
 *
 * Handles HTTP requests for calendar events.
 * Events can be synced from external sources (Google, Apple) or created locally.
 *
 * ENDPOINT: /api/events
 * - GET:  List events (with date range filtering)
 * - POST: Create a new event
 *
 * EVENT SOURCES:
 * Events can come from:
 * - Local creation (no external source)
 * - Google Calendar (synced via OAuth)
 * - Apple iCal (synced via CalDAV)
 * - Generic CalDAV
 *
 * For synced events, we store the externalEventId to track changes.
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { events, calendarSources, users, calendarGroups } from '@/lib/db/schema';
import { eq, and, or, gte, lte, asc, isNotNull, isNull } from 'drizzle-orm';
import { createEventSchema, validateRequest } from '@/lib/validations';
import { getCached } from '@/lib/cache/redis';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { createCalendarEvent, refreshAccessToken, toGoogleAllDayRange } from '@/lib/integrations/google-calendar';
import { decrypt, encrypt } from '@/lib/utils/crypto';
import { formatEventRow } from '@/lib/utils/formatters';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';
import { MAX_CALENDAR_EVENTS } from '@/lib/utils/calendarRange';

// Cache events for 5 minutes
const EVENTS_CACHE_TTL = 5 * 60;


import type { CalendarEventResponse as EventResponse } from '@/types/calendar';


/**
 * GET /api/events
 * Lists calendar events within a date range.
 *
 * QUERY PARAMETERS:
 * - startDate:  Start of date range (ISO string, required)
 * - endDate:    End of date range (ISO string, required)
 * - calendarId: Filter by specific calendar source ID
 * - allDay:     Filter by all-day events ("true" or "false")
 * - limit:      Maximum events to return (default: 100)
 * - offset:     Pagination offset
 *
 * EXAMPLE:
 * GET /api/events?startDate=2024-01-01&endDate=2024-01-31
 *
 * NOTE:
 * Always filter by date range to avoid returning huge datasets.
 * The calendar widget typically shows 3-7 days at a time.
 */
export async function GET(request: NextRequest) {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ events: [], total: 0, dateRange: { start: '', end: '' }, limit: 100, offset: 0 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const calendarId = searchParams.get('calendarId');
    const allDay = searchParams.get('allDay');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), MAX_CALENDAR_EVENTS);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate required date range
    if (!startDateStr || !endDateStr) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use ISO 8601.' },
        { status: 400 }
      );
    }

    // Build filter conditions
    // Include events that:
    // 1. Start within the date range
    // 2. End within the date range
    // 3. Span the entire date range
    const dateRangeCondition = or(
      // Event starts within range
      and(gte(events.startTime, startDate), lte(events.startTime, endDate)),
      // Event ends within range
      and(gte(events.endTime, startDate), lte(events.endTime, endDate)),
      // Event spans the entire range
      and(lte(events.startTime, startDate), gte(events.endTime, endDate))
    );

    const conditions = [dateRangeCondition];

    if (calendarId) {
      conditions.push(eq(events.calendarSourceId, calendarId));
    }

    if (allDay !== null) {
      conditions.push(eq(events.allDay, allDay === 'true'));
    }

    // Cache key includes query params for unique results per request
    const cacheKey = `events:${startDateStr}:${endDateStr}:${calendarId || 'all'}:${allDay || 'all'}:${limit}:${offset}`;

    const data = await getCached(cacheKey, async () => {
      // Fetch events with calendar source and user data
      // Only include events from:
      // 1. Enabled calendars
      // 2. Calendars assigned to a user OR marked as family calendars
      const results = await db
        .select({
          id: events.id,
          title: events.title,
          description: events.description,
          location: events.location,
          startTime: events.startTime,
          endTime: events.endTime,
          allDay: events.allDay,
          recurring: events.recurring,
          recurrenceRule: events.recurrenceRule,
          color: events.color,
          reminderMinutes: events.reminderMinutes,
          createdAt: events.createdAt,
          updatedAt: events.updatedAt,
          // Calendar source data
          calendarSourceId: calendarSources.id,
          calendarSourceName: calendarSources.dashboardCalendarName,
          calendarSourceColor: calendarSources.color,
          calendarSourceProvider: calendarSources.provider,
          calendarSourceEnabled: calendarSources.enabled,
          calendarSourceIsFamily: calendarSources.isFamily,
          calendarSourceUserId: calendarSources.userId,
          calendarSourceGroupId: calendarSources.groupId,
          // User data (for color)
          userName: users.name,
          userColor: users.color,
          // Group data (for color)
          groupColor: calendarGroups.color,
          groupName: calendarGroups.name,
        })
        .from(events)
        .leftJoin(calendarSources, eq(events.calendarSourceId, calendarSources.id))
        .leftJoin(users, eq(calendarSources.userId, users.id))
        .leftJoin(calendarGroups, eq(calendarSources.groupId, calendarGroups.id))
        .where(and(
          ...conditions,
          // Only enabled calendars
          or(
            eq(calendarSources.enabled, true),
            // Allow events without a calendar source (local events)
            isNull(events.calendarSourceId)
          ),
          // Include events from enabled calendars (assigned, family, grouped, or with color)
          or(
            isNotNull(calendarSources.userId),
            eq(calendarSources.isFamily, true),
            isNotNull(calendarSources.groupId),
            // Include enabled unassigned calendars (they use their source color)
            eq(calendarSources.enabled, true),
            // Allow events without a calendar source (local events)
            isNull(events.calendarSourceId)
          )
        ))
        .orderBy(asc(events.startTime))
        .limit(limit)
        .offset(offset);

      // If a fetch fills the row ceiling, events may be silently omitted — the
      // exact failure mode of #250. Surface it in logs rather than dropping
      // events quietly, so the cap can be raised or the fetch paginated.
      if (results.length >= limit) {
        console.warn(
          `[events] fetch hit the ${limit}-row ceiling for ${startDateStr}..${endDateStr}; some events may be omitted.`,
        );
      }

      // Format response
      // Color priority: event color > user color > calendar color > default
      const formattedEvents: EventResponse[] = results.map((row) => formatEventRow(row));

      return {
        events: formattedEvents,
        total: formattedEvents.length,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        limit,
        offset,
      };
    }, EVENTS_CACHE_TTL);

    return NextResponse.json(data);
  } catch (error) {
    logError('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}


/**
 * POST /api/events
 * Creates a new calendar event.
 *
 * REQUEST BODY:
 * {
 *   title: string (required)
 *   description?: string
 *   location?: string
 *   startTime: string (required, ISO 8601)
 *   endTime: string (required, ISO 8601)
 *   allDay?: boolean (default: false)
 *   calendarSourceId?: string (optional calendar to add to)
 *   recurring?: boolean
 *   recurrenceRule?: string (iCal RRULE format)
 *   color?: string (hex color, overrides calendar color)
 *   reminderMinutes?: number
 *   createdBy?: string (user ID)
 * }
 *
 * RECURRENCE RULES (iCal RRULE format):
 * - Daily: "FREQ=DAILY;COUNT=10"
 * - Weekly: "FREQ=WEEKLY;BYDAY=MO,WE,FR"
 * - Monthly: "FREQ=MONTHLY;BYMONTHDAY=15"
 * - Yearly: "FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=25"
 *
 * EXAMPLE:
 * POST /api/events
 * {
 *   "title": "Team Meeting",
 *   "startTime": "2024-01-31T09:00:00Z",
 *   "endTime": "2024-01-31T10:00:00Z",
 *   "location": "Conference Room A",
 *   "recurring": true,
 *   "recurrenceRule": "FREQ=WEEKLY;BYDAY=WE"
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { rateLimitGuard } = await import('@/lib/cache/rateLimit');
  const limited = await rateLimitGuard(auth.userId, 'events', 30, 60);
  if (limited) return limited;

  try {
    const body = await request.json();

    // Validate request body with Zod schema
    const validation = validateRequest(createEventSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const {
      title,
      description,
      location,
      startTime: startTimeStr,
      endTime: endTimeStr,
      allDay,
      calendarSourceId,
      recurring,
      recurrenceRule,
      color,
      reminderMinutes,
      createdBy,
    } = validation.data;

    // Convert ISO strings to Date objects
    const startTime = new Date(startTimeStr);
    const endTime = new Date(endTimeStr);

    let externalEventId: string | null = null;
    let googleWarning: string | null = null;
    let calendarSource = null;

    // Validate calendarSourceId if provided and push to external calendar
    if (calendarSourceId) {
      const [calendar] = await db
        .select()
        .from(calendarSources)
        .where(eq(calendarSources.id, calendarSourceId));

      if (!calendar) {
        return NextResponse.json(
          { error: 'Calendar source not found' },
          { status: 400 }
        );
      }

      calendarSource = calendar;

      // If it's a Google Calendar, push the event to Google
      if (calendar.provider === 'google' && calendar.accessToken) {
        try {
          let accessToken = decrypt(calendar.accessToken);

          // Check if token needs refresh
          if (calendar.tokenExpiresAt && calendar.tokenExpiresAt <= new Date()) {
            if (!calendar.refreshToken) {
              return NextResponse.json(
                { error: 'Google Calendar token expired. Please re-authenticate.' },
                { status: 401 }
              );
            }
            const refreshToken = decrypt(calendar.refreshToken);
            const newTokens = await refreshAccessToken(refreshToken);
            accessToken = newTokens.access_token;

            // Update stored tokens
            await db
              .update(calendarSources)
              .set({
                accessToken: encrypt(newTokens.access_token),
                refreshToken: newTokens.refresh_token ? encrypt(newTokens.refresh_token) : calendar.refreshToken,
                tokenExpiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
                updatedAt: new Date(),
              })
              .where(eq(calendarSources.id, calendarSourceId));
          }

          const allDayRange = allDay ? toGoogleAllDayRange(startTime, endTime) : null;

          // Create event on Google Calendar
          const googleEvent = await createCalendarEvent(
            accessToken,
            calendar.sourceCalendarId,
            {
              summary: title.trim(),
              description: description?.trim() || undefined,
              location: location?.trim() || undefined,
              start: allDay
                ? allDayRange!.start
                : { dateTime: startTime.toISOString() },
              end: allDay
                ? allDayRange!.end
                : { dateTime: endTime.toISOString() },
            }
          );

          externalEventId = googleEvent.id;
        } catch (error) {
          logError('Failed to create event on Google Calendar:', error);
          googleWarning = `Event was saved locally but could not be synced to Google Calendar: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      }
    }

    // Insert the event into local database
    const [newEvent] = await db
      .insert(events)
      .values({
        title: title.trim(),
        description: description?.trim() || null,
        location: location?.trim() || null,
        startTime,
        endTime,
        allDay,
        calendarSourceId: calendarSourceId || null,
        externalEventId,
        recurring,
        recurrenceRule: recurrenceRule || null,
        color: color || null,
        reminderMinutes: reminderMinutes ?? null,
        createdBy: createdBy || null,
      })
      .returning();

    if (!newEvent) {
      return NextResponse.json(
        { error: 'Failed to create event' },
        { status: 500 }
      );
    }

    // Fetch with calendar source data
    const [eventWithSource] = await db
      .select({
        id: events.id,
        title: events.title,
        description: events.description,
        location: events.location,
        startTime: events.startTime,
        endTime: events.endTime,
        allDay: events.allDay,
        recurring: events.recurring,
        recurrenceRule: events.recurrenceRule,
        color: events.color,
        reminderMinutes: events.reminderMinutes,
        createdAt: events.createdAt,
        updatedAt: events.updatedAt,
        calendarSourceId: calendarSources.id,
        calendarSourceName: calendarSources.dashboardCalendarName,
        calendarSourceColor: calendarSources.color,
        calendarSourceProvider: calendarSources.provider,
      })
      .from(events)
      .leftJoin(calendarSources, eq(events.calendarSourceId, calendarSources.id))
      .where(eq(events.id, newEvent.id));

    if (!eventWithSource) {
      return NextResponse.json(
        { error: 'Event created but could not be retrieved' },
        { status: 500 }
      );
    }

    const response: EventResponse = formatEventRow(eventWithSource);

    // Invalidate events cache
    await invalidateEntity('events');

    logActivity({
      userId: auth.userId,
      action: 'create',
      entityType: 'event',
      entityId: newEvent.id,
      summary: `Created event: ${newEvent.title}`,
    });

    return NextResponse.json(
      googleWarning ? { ...response, warning: googleWarning } : response,
      { status: 201 }
    );
  } catch (error) {
    logError('Error creating event:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}
