/**
 *
 * Handles HTTP requests for a specific calendar event by ID.
 *
 * ENDPOINT: /api/events/[id]
 * - GET:    Get a specific event
 * - PATCH:  Update an event
 * - DELETE: Delete an event
 *
 * SYNC CONSIDERATIONS:
 * When updating/deleting events that were synced from external calendars,
 * changes should be pushed back to the source calendar. This is handled
 * by the sync service (not implemented in this route).
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { events, calendarSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { invalidateCache } from '@/lib/cache/redis';
import { updateCalendarEvent, deleteCalendarEvent, refreshAccessToken } from '@/lib/integrations/google-calendar';
import { decrypt, encrypt } from '@/lib/utils/crypto';


interface RouteParams {
  params: Promise<{ id: string }>;
}


/**
 * GET /api/events/[id]
 * Retrieves a single event by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

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
        externalEventId: events.externalEventId,
        createdAt: events.createdAt,
        updatedAt: events.updatedAt,
        calendarSourceId: calendarSources.id,
        calendarSourceName: calendarSources.dashboardCalendarName,
        calendarSourceColor: calendarSources.color,
        calendarSourceProvider: calendarSources.provider,
      })
      .from(events)
      .leftJoin(calendarSources, eq(events.calendarSourceId, calendarSources.id))
      .where(eq(events.id, id));

    if (!eventWithSource) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: eventWithSource.id,
      title: eventWithSource.title,
      description: eventWithSource.description,
      location: eventWithSource.location,
      startTime: eventWithSource.startTime.toISOString(),
      endTime: eventWithSource.endTime.toISOString(),
      allDay: eventWithSource.allDay,
      recurring: eventWithSource.recurring,
      recurrenceRule: eventWithSource.recurrenceRule,
      color: eventWithSource.color || eventWithSource.calendarSourceColor,
      reminderMinutes: eventWithSource.reminderMinutes,
      externalEventId: eventWithSource.externalEventId,
      calendarSource: eventWithSource.calendarSourceId
        ? {
            id: eventWithSource.calendarSourceId,
            name: eventWithSource.calendarSourceName!,
            color: eventWithSource.calendarSourceColor,
            provider: eventWithSource.calendarSourceProvider!,
          }
        : null,
      createdAt: eventWithSource.createdAt.toISOString(),
      updatedAt: eventWithSource.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    );
  }
}


/**
 * PATCH /api/events/[id]
 * Updates a specific event.
 *
 * REQUEST BODY (all fields optional):
 * {
 *   title?: string
 *   description?: string | null
 *   location?: string | null
 *   startTime?: string
 *   endTime?: string
 *   allDay?: boolean
 *   recurring?: boolean
 *   recurrenceRule?: string | null
 *   color?: string | null
 *   reminderMinutes?: number | null
 *   calendarSourceId?: string | null
 * }
 *
 * SYNC NOTE:
 * If this event has an externalEventId (synced from external calendar),
 * the changes should be pushed to the external calendar.
 * This would be handled by a separate sync service.
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    // Check if event exists and get calendar source info
    const [existingEvent] = await db
      .select({
        id: events.id,
        externalEventId: events.externalEventId,
        calendarSourceId: events.calendarSourceId,
        title: events.title,
        description: events.description,
        location: events.location,
        startTime: events.startTime,
        endTime: events.endTime,
        allDay: events.allDay,
      })
      .from(events)
      .where(eq(events.id, id));

    if (!existingEvent) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if ('title' in body) {
      if (typeof body.title !== 'string' || body.title.trim().length === 0) {
        return NextResponse.json(
          { error: 'Title must be a non-empty string' },
          { status: 400 }
        );
      }
      updateData.title = body.title.trim();
    }

    if ('description' in body) {
      updateData.description = body.description?.trim() || null;
    }

    if ('location' in body) {
      updateData.location = body.location?.trim() || null;
    }

    if ('startTime' in body) {
      const startTime = new Date(body.startTime);
      if (isNaN(startTime.getTime())) {
        return NextResponse.json(
          { error: 'Invalid startTime format' },
          { status: 400 }
        );
      }
      updateData.startTime = startTime;
    }

    if ('endTime' in body) {
      const endTime = new Date(body.endTime);
      if (isNaN(endTime.getTime())) {
        return NextResponse.json(
          { error: 'Invalid endTime format' },
          { status: 400 }
        );
      }
      updateData.endTime = endTime;
    }

    if ('allDay' in body) {
      updateData.allDay = Boolean(body.allDay);
    }

    if ('recurring' in body) {
      updateData.recurring = Boolean(body.recurring);
    }

    if ('recurrenceRule' in body) {
      updateData.recurrenceRule = body.recurrenceRule || null;
    }

    if ('color' in body) {
      if (body.color !== null && !/^#[0-9A-Fa-f]{6}$/.test(body.color)) {
        return NextResponse.json(
          { error: 'Color must be a valid hex color' },
          { status: 400 }
        );
      }
      updateData.color = body.color;
    }

    if ('reminderMinutes' in body) {
      updateData.reminderMinutes = body.reminderMinutes;
    }

    if ('calendarSourceId' in body) {
      if (body.calendarSourceId) {
        const [calendar] = await db
          .select({ id: calendarSources.id })
          .from(calendarSources)
          .where(eq(calendarSources.id, body.calendarSourceId));

        if (!calendar) {
          return NextResponse.json(
            { error: 'Calendar source not found' },
            { status: 400 }
          );
        }
      }
      updateData.calendarSourceId = body.calendarSourceId || null;
    }

    // If event is linked to a Google Calendar, push updates to Google
    if (existingEvent.calendarSourceId && existingEvent.externalEventId) {
      const [calendarSource] = await db
        .select()
        .from(calendarSources)
        .where(eq(calendarSources.id, existingEvent.calendarSourceId));

      if (calendarSource?.provider === 'google' && calendarSource.accessToken) {
        try {
          let accessToken = decrypt(calendarSource.accessToken);

          // Check if token needs refresh
          if (calendarSource.tokenExpiresAt && calendarSource.tokenExpiresAt <= new Date()) {
            if (!calendarSource.refreshToken) {
              return NextResponse.json(
                { error: 'Google Calendar token expired. Please re-authenticate.' },
                { status: 401 }
              );
            }
            const refreshToken = decrypt(calendarSource.refreshToken);
            const newTokens = await refreshAccessToken(refreshToken);
            accessToken = newTokens.access_token;

            // Update stored tokens
            await db
              .update(calendarSources)
              .set({
                accessToken: encrypt(newTokens.access_token),
                refreshToken: newTokens.refresh_token ? encrypt(newTokens.refresh_token) : calendarSource.refreshToken,
                tokenExpiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
                updatedAt: new Date(),
              })
              .where(eq(calendarSources.id, existingEvent.calendarSourceId));
          }

          // Build Google Calendar update payload
          const googleUpdate: Record<string, unknown> = {};
          const newTitle = updateData.title as string | undefined;
          const newDesc = updateData.description as string | null | undefined;
          const newLoc = updateData.location as string | null | undefined;
          const newStart = updateData.startTime as Date | undefined;
          const newEnd = updateData.endTime as Date | undefined;
          const newAllDay = updateData.allDay as boolean | undefined;

          if (newTitle !== undefined) googleUpdate.summary = newTitle;
          if (newDesc !== undefined) googleUpdate.description = newDesc || undefined;
          if (newLoc !== undefined) googleUpdate.location = newLoc || undefined;

          // Handle date/time updates
          const finalAllDay = newAllDay !== undefined ? newAllDay : existingEvent.allDay;
          const finalStart = newStart || existingEvent.startTime;
          const finalEnd = newEnd || existingEvent.endTime;

          if (newStart !== undefined || newEnd !== undefined || newAllDay !== undefined) {
            if (finalAllDay) {
              googleUpdate.start = { date: finalStart.toISOString().split('T')[0] };
              googleUpdate.end = { date: finalEnd.toISOString().split('T')[0] };
            } else {
              googleUpdate.start = { dateTime: finalStart.toISOString() };
              googleUpdate.end = { dateTime: finalEnd.toISOString() };
            }
          }

          // Update on Google Calendar
          await updateCalendarEvent(
            accessToken,
            calendarSource.sourceCalendarId,
            existingEvent.externalEventId,
            googleUpdate
          );
        } catch (error) {
          console.error('Failed to update event on Google Calendar:', error);
          // Continue with local update even if Google fails
        }
      }
    }

    // Execute update
    await db
      .update(events)
      .set(updateData)
      .where(eq(events.id, id));

    // Fetch and return updated event
    const [updatedEvent] = await db
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
      .where(eq(events.id, id));

    if (!updatedEvent) {
      return NextResponse.json(
        { error: 'Event not found after update' },
        { status: 404 }
      );
    }

    // Invalidate events cache
    await invalidateCache('events:*');

    return NextResponse.json({
      id: updatedEvent.id,
      title: updatedEvent.title,
      description: updatedEvent.description,
      location: updatedEvent.location,
      startTime: updatedEvent.startTime.toISOString(),
      endTime: updatedEvent.endTime.toISOString(),
      allDay: updatedEvent.allDay,
      recurring: updatedEvent.recurring,
      recurrenceRule: updatedEvent.recurrenceRule,
      color: updatedEvent.color || updatedEvent.calendarSourceColor,
      reminderMinutes: updatedEvent.reminderMinutes,
      calendarSource: updatedEvent.calendarSourceId
        ? {
            id: updatedEvent.calendarSourceId,
            name: updatedEvent.calendarSourceName!,
            color: updatedEvent.calendarSourceColor,
            provider: updatedEvent.calendarSourceProvider!,
          }
        : null,
      createdAt: updatedEvent.createdAt.toISOString(),
      updatedAt: updatedEvent.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    );
  }
}


/**
 * DELETE /api/events/[id]
 * Deletes a specific event.
 *
 * SYNC NOTE:
 * If this event has an externalEventId, the deletion should be
 * synced to the external calendar. This is handled by the sync service.
 *
 * For recurring events, you may want to:
 * - Delete just this instance
 * - Delete this and all future instances
 * - Delete all instances
 *
 * This simple implementation deletes the single event record.
 * Recurring event handling would be more complex in production.
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    // Check if event exists
    const [existingEvent] = await db
      .select({
        id: events.id,
        title: events.title,
        externalEventId: events.externalEventId,
        calendarSourceId: events.calendarSourceId,
      })
      .from(events)
      .where(eq(events.id, id));

    if (!existingEvent) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // If event is linked to a Google Calendar, delete from Google too
    if (existingEvent.calendarSourceId && existingEvent.externalEventId) {
      const [calendarSource] = await db
        .select()
        .from(calendarSources)
        .where(eq(calendarSources.id, existingEvent.calendarSourceId));

      if (calendarSource?.provider === 'google' && calendarSource.accessToken) {
        try {
          let accessToken = decrypt(calendarSource.accessToken);

          // Check if token needs refresh
          if (calendarSource.tokenExpiresAt && calendarSource.tokenExpiresAt <= new Date()) {
            if (calendarSource.refreshToken) {
              const refreshToken = decrypt(calendarSource.refreshToken);
              const newTokens = await refreshAccessToken(refreshToken);
              accessToken = newTokens.access_token;

              // Update stored tokens
              await db
                .update(calendarSources)
                .set({
                  accessToken: encrypt(newTokens.access_token),
                  refreshToken: newTokens.refresh_token ? encrypt(newTokens.refresh_token) : calendarSource.refreshToken,
                  tokenExpiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
                  updatedAt: new Date(),
                })
                .where(eq(calendarSources.id, existingEvent.calendarSourceId));
            }
          }

          // Delete from Google Calendar
          await deleteCalendarEvent(
            accessToken,
            calendarSource.sourceCalendarId,
            existingEvent.externalEventId
          );
        } catch (error) {
          console.error('Failed to delete event from Google Calendar:', error);
          // Continue with local delete even if Google fails
        }
      }
    }

    // Delete the event locally
    await db
      .delete(events)
      .where(eq(events.id, id));

    // Invalidate events cache
    await invalidateCache('events:*');

    return NextResponse.json({
      message: 'Event deleted successfully',
      deletedEvent: {
        id: existingEvent.id,
        title: existingEvent.title,
        wasExternal: !!existingEvent.externalEventId,
      },
    });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    );
  }
}
