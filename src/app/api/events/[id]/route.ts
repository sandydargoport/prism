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
import { requireAuth, requireRole } from '@/lib/auth';
import { patchEventSchema, validateRequest } from '@/lib/validations';
import { db } from '@/lib/db/client';
import { events, calendarSources, dismissedEvents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { updateCalendarEvent, deleteCalendarEvent, createCalendarEvent, moveCalendarEvent, refreshAccessToken, toGoogleAllDayRange } from '@/lib/integrations/google-calendar';
import { pushCalDAVEventDelete } from '@/lib/services/calendar-sync';
import { decrypt, encrypt } from '@/lib/utils/crypto';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';


interface RouteParams {
  params: Promise<{ id: string }>;
}

type CalendarSourceRow = typeof calendarSources.$inferSelect;

/**
 * Decrypt a Google source's access token, refreshing and persisting it when
 * expired. Callers pre-check accessToken/refreshToken presence so the 401
 * responses stay consistent with the rest of this route.
 */
async function ensureFreshGoogleToken(source: CalendarSourceRow): Promise<string> {
  let accessToken = decrypt(source.accessToken!);

  if (source.tokenExpiresAt && source.tokenExpiresAt <= new Date() && source.refreshToken) {
    const newTokens = await refreshAccessToken(decrypt(source.refreshToken));
    accessToken = newTokens.access_token;

    await db
      .update(calendarSources)
      .set({
        accessToken: encrypt(newTokens.access_token),
        refreshToken: newTokens.refresh_token ? encrypt(newTokens.refresh_token) : source.refreshToken,
        tokenExpiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
        updatedAt: new Date(),
      })
      .where(eq(calendarSources.id, source.id));
  }

  return accessToken;
}

/**
 * Build the Google event patch from the fields this request actually carries.
 * A clear has to travel as an empty string — Google reads a missing key as
 * "leave it alone", so sending undefined cleared the field locally and let the
 * next sync pull the old text straight back. Returns null when nothing
 * Google-visible changed.
 */
function buildGoogleFieldUpdate(
  body: Record<string, unknown>,
  effTitle: string,
  effDesc: string | null | undefined,
  effLoc: string | null | undefined,
  effStart: Date,
  effEnd: Date,
  effAllDay: boolean
): Record<string, unknown> | null {
  const googleUpdate: Record<string, unknown> = {};

  if ('title' in body) googleUpdate.summary = effTitle;
  if ('description' in body) googleUpdate.description = effDesc ?? '';
  if ('location' in body) googleUpdate.location = effLoc ?? '';

  if ('startTime' in body || 'endTime' in body || 'allDay' in body) {
    if (effAllDay) {
      const range = toGoogleAllDayRange(effStart, effEnd);
      googleUpdate.start = range.start;
      googleUpdate.end = range.end;
    } else {
      googleUpdate.start = { dateTime: effStart.toISOString() };
      googleUpdate.end = { dateTime: effEnd.toISOString() };
    }
  }

  return Object.keys(googleUpdate).length > 0 ? googleUpdate : null;
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
    logError('Error fetching event:', error);
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
 * Google events push their edits upstream. Calendar reassignment is followed
 * too: switching an event onto a Google calendar creates it there, switching
 * between Google calendars moves it, and switching away from Google deletes
 * the upstream copy (tombstoned so the sync won't re-import it).
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
        createdBy: events.createdBy,
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

    // Owner may edit with canEditOwnEvent; editing anyone else's (or an
    // unowned synced event) requires canEditAnyEvent.
    const canEdit = requireRole(
      auth,
      existingEvent.createdBy === auth.userId ? 'canEditOwnEvent' : 'canEditAnyEvent'
    );
    if (canEdit) return canEdit;

    // Until now PATCH validated title, the two dates and color by hand and let
    // everything else through untouched, so description and location had no
    // length bound at all: `updateEventSchema` existed and was never imported.
    const validation = validateRequest(patchEventSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
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

    let reassignedSource: CalendarSourceRow | null = null;

    if ('calendarSourceId' in body) {
      if (body.calendarSourceId) {
        const [calendar] = await db
          .select()
          .from(calendarSources)
          .where(eq(calendarSources.id, body.calendarSourceId));

        if (!calendar) {
          return NextResponse.json(
            { error: 'Calendar source not found' },
            { status: 400 }
          );
        }
        reassignedSource = calendar;
      }
      updateData.calendarSourceId = body.calendarSourceId || null;
    }

    // POST refuses an end before its start; PATCH did not, so moving one edge
    // of an existing event could invert it. Compare against what the event will
    // actually be, not only against what this request carries.
    const effectiveStart = (updateData.startTime as Date | undefined) ?? existingEvent.startTime;
    const effectiveEnd = (updateData.endTime as Date | undefined) ?? existingEvent.endTime;
    if (effectiveEnd < effectiveStart) {
      return NextResponse.json(
        { error: 'End time must be after start time' },
        { status: 400 }
      );
    }

    // Google is the only provider with a write path from this route. An event
    // on any other synced calendar changes locally and nowhere else, so the next
    // sync pulls the original back and the edit vanishes with no explanation.
    // Say so at save time rather than letting it silently revert.
    //
    // Wiring the CalDAV writeback in here is its own piece of work: the endpoint
    // at /api/caldav/events/[sourceId] rebuilds the VEVENT from uid, summary,
    // description, location and dates alone, which would strip alarms,
    // attendees and recurrence rules off a shared event.
    let localOnlyWarning: string | null = null;

    // Resolve which calendar the event lives on before and after this request,
    // so a reassignment can follow the event upstream: switching onto a Google
    // calendar creates it there, switching between Google calendars moves it,
    // and switching away from Google deletes it there — otherwise the next
    // sync re-imports the stale copy as a duplicate.
    const oldSourceId = existingEvent.calendarSourceId;
    const newSourceId = 'calendarSourceId' in body ? (body.calendarSourceId || null) : oldSourceId;
    const reassigning = newSourceId !== oldSourceId;

    let oldSource: CalendarSourceRow | null = null;
    if (oldSourceId) {
      const [row] = await db
        .select()
        .from(calendarSources)
        .where(eq(calendarSources.id, oldSourceId));
      oldSource = row ?? null;
    }
    const targetSource = reassigning ? reassignedSource : oldSource;

    if (targetSource?.provider === 'google') {
      if (!targetSource.accessToken) {
        return NextResponse.json(
          { error: 'Google Calendar is not authenticated. Reconnect it before editing this event.' },
          { status: 401 }
        );
      }
      if (targetSource.tokenExpiresAt && targetSource.tokenExpiresAt <= new Date() && !targetSource.refreshToken) {
        return NextResponse.json(
          { error: 'Google Calendar token expired. Please re-authenticate.' },
          { status: 401 }
        );
      }

      try {
        const accessToken = await ensureFreshGoogleToken(targetSource);

        // The field values the event will have once this PATCH applies.
        const effTitle = (updateData.title as string | undefined) ?? existingEvent.title;
        // Read the nullable fields by presence in the body, not with ??. A
        // clear stores null, and `null ?? existingEvent.description` falls
        // back to the old text — so the clear saved locally but the previous
        // value went up to Google, and the next sync pulled it straight back.
        // That is the bug the empty-string rule below exists to prevent.
        const effDesc = 'description' in body
          ? (updateData.description as string | null)
          : existingEvent.description;
        const effLoc = 'location' in body
          ? (updateData.location as string | null)
          : existingEvent.location;
        const effStart = (updateData.startTime as Date | undefined) ?? existingEvent.startTime;
        const effEnd = (updateData.endTime as Date | undefined) ?? existingEvent.endTime;
        const effAllDay = (updateData.allDay as boolean | undefined) ?? existingEvent.allDay;

        // A create is needed when the event never went external, or when its
        // external id belongs to a non-Google source (an iCal/CalDAV id that
        // Google knows nothing about).
        const needsCreate =
          !existingEvent.externalEventId ||
          (reassigning && oldSource?.provider !== 'google');

        if (needsCreate) {
          const allDayRange = effAllDay ? toGoogleAllDayRange(effStart, effEnd) : null;
          const created = await createCalendarEvent(
            accessToken,
            targetSource.sourceCalendarId,
            {
              summary: effTitle,
              description: effDesc?.trim() || undefined,
              location: effLoc?.trim() || undefined,
              start: effAllDay ? allDayRange!.start : { dateTime: effStart.toISOString() },
              end: effAllDay ? allDayRange!.end : { dateTime: effEnd.toISOString() },
            }
          );
          updateData.externalEventId = created.id;

          // The row no longer references its old synced source, so that
          // source's next pull would re-import the very same event as a new
          // row. Tombstone the old identity to keep it out.
          if (reassigning && oldSource && existingEvent.externalEventId) {
            await db
              .insert(dismissedEvents)
              .values({
                calendarSourceId: oldSource.id,
                externalEventId: existingEvent.externalEventId,
              })
              .onConflictDoNothing();
          }
        } else if (reassigning && oldSource?.provider === 'google') {
          // Google → Google: a move keeps the event id, then any field edits
          // from this request are applied on the destination calendar.
          const oldToken = oldSource.accessToken
            ? await ensureFreshGoogleToken(oldSource)
            : accessToken;
          await moveCalendarEvent(
            oldToken,
            oldSource.sourceCalendarId,
            existingEvent.externalEventId!,
            targetSource.sourceCalendarId
          );

          const googleUpdate = buildGoogleFieldUpdate(body, effTitle, effDesc, effLoc, effStart, effEnd, effAllDay);
          if (googleUpdate) {
            await updateCalendarEvent(
              accessToken,
              targetSource.sourceCalendarId,
              existingEvent.externalEventId!,
              googleUpdate
            );
          }
        } else if (existingEvent.externalEventId) {
          // Same Google calendar as before: push the field changes.
          const googleUpdate = buildGoogleFieldUpdate(body, effTitle, effDesc, effLoc, effStart, effEnd, effAllDay);
          if (googleUpdate) {
            await updateCalendarEvent(
              accessToken,
              targetSource.sourceCalendarId,
              existingEvent.externalEventId,
              googleUpdate
            );
          }
        }
      } catch (error) {
        logError('Failed to update event on Google Calendar:', error);

        // Google will not move one occurrence of a repeating event, and the
        // rows here are occurrences: sync expands series with
        // singleEvents: true, so externalEventId is an instance id. Google
        // answers 400 cannotChangeOrganizerOfInstance. Say what happened,
        // because the generic message below sends people looking at tokens
        // and permissions for something no retry can fix.
        if (error instanceof Error && error.message.includes('cannotChangeOrganizerOfInstance')) {
          return NextResponse.json(
            {
              error:
                'Google does not allow moving a single occurrence of a repeating event to another calendar. Move the whole series in Google Calendar instead.',
            },
            { status: 400 }
          );
        }

        return NextResponse.json(
          {
            error: 'Google Calendar could not be updated. Your local event was left unchanged.',
          },
          { status: 502 }
        );
      }
    } else if (reassigning && oldSource?.provider === 'google' && existingEvent.externalEventId) {
      // Google → local/other: remove the upstream copy so the next sync does
      // not re-import it as a duplicate. Best-effort like DELETE — the
      // tombstone keeps the removal sticky even when Google is unreachable.
      try {
        if (oldSource.accessToken) {
          const oldToken = await ensureFreshGoogleToken(oldSource);
          await deleteCalendarEvent(oldToken, oldSource.sourceCalendarId, existingEvent.externalEventId);
        }
      } catch (error) {
        logError('Failed to delete event from Google Calendar during reassignment:', error);
      }

      await db
        .insert(dismissedEvents)
        .values({
          calendarSourceId: oldSource.id,
          externalEventId: existingEvent.externalEventId,
        })
        .onConflictDoNothing();
      updateData.externalEventId = null;
    } else if (!reassigning && oldSource && oldSource.provider !== 'google' && existingEvent.externalEventId) {
      localOnlyWarning =
        'Prism cannot write to this calendar. The change is saved here, but the next sync will replace it with the version from that calendar.';
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
    await invalidateEntity('events');

    logActivity({
      userId: auth.userId,
      action: 'update',
      entityType: 'event',
      entityId: updatedEvent.id,
      summary: `Updated event: ${updatedEvent.title}`,
    });

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
      ...(localOnlyWarning ? { warning: localOnlyWarning } : {}),
    });
  } catch (error) {
    logError('Error updating event:', error);
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
        createdBy: events.createdBy,
        title: events.title,
        externalEventId: events.externalEventId,
        calendarSourceId: events.calendarSourceId,
        recurring: events.recurring,
        caldavHref: events.caldavHref,
        caldavEtag: events.caldavEtag,
      })
      .from(events)
      .where(eq(events.id, id));

    if (!existingEvent) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Owner may delete with canDeleteOwnEvent; deleting anyone else's (or an
    // unowned synced event) requires canDeleteAnyEvent.
    const canDelete = requireRole(
      auth,
      existingEvent.createdBy === auth.userId ? 'canDeleteOwnEvent' : 'canDeleteAnyEvent'
    );
    if (canDelete) return canDelete;

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
          logError('Failed to delete event from Google Calendar:', error);
          // Continue with local delete even if Google fails
        }
      }

      // Propagate the delete to a CalDAV source too (parity with Google). The
      // server addresses objects by href, so we use the href + ETag captured at
      // sync time. Single-event scope only: recurring events share one parent
      // object, and an href-based delete would drop the whole series — for those
      // we skip write-back and just tombstone + delete locally (matches the
      // documented CalDAV write scope, issue #59 for recurrence).
      if (calendarSource?.provider === 'caldav') {
        if (existingEvent.recurring) {
          logError(
            'Skipping CalDAV upstream delete for recurring event (single-event scope only):',
            existingEvent.id
          );
        } else if (!existingEvent.caldavHref) {
          logError(
            'Skipping CalDAV upstream delete: no stored href (event predates href capture; re-sync to populate):',
            existingEvent.id
          );
        } else {
          const result = await pushCalDAVEventDelete(
            calendarSource.id,
            existingEvent.caldavHref,
            existingEvent.caldavEtag ?? undefined
          );
          if (!result.ok) {
            // Continue with local delete even if the server rejects it; the
            // tombstone below still prevents the event from being re-pulled.
            logError('Failed to delete event from CalDAV server:', result.error);
          }
        }
      }

      // Tombstone this synced event so the pull sync doesn't re-add it. Google
      // deletes propagate upstream above; CalDAV/iCal (and a failed Google
      // delete) rely on this so the deletion sticks.
      await db
        .insert(dismissedEvents)
        .values({
          calendarSourceId: existingEvent.calendarSourceId,
          externalEventId: existingEvent.externalEventId,
        })
        .onConflictDoNothing();
    }

    // Delete the event locally
    await db
      .delete(events)
      .where(eq(events.id, id));

    // Invalidate events cache
    await invalidateEntity('events');

    logActivity({
      userId: auth.userId,
      action: 'delete',
      entityType: 'event',
      entityId: existingEvent.id,
      summary: `Deleted event: ${existingEvent.title}`,
    });

    return NextResponse.json({
      message: 'Event deleted successfully',
      deletedEvent: {
        id: existingEvent.id,
        title: existingEvent.title,
        wasExternal: !!existingEvent.externalEventId,
      },
    });
  } catch (error) {
    logError('Error deleting event:', error);
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    );
  }
}
