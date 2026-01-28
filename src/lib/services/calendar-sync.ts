/**
 * ============================================================================
 * PRISM - Calendar Sync Service
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Provides synchronization between external calendar providers and the
 * internal events database.
 *
 * ============================================================================
 */

import { db } from '@/lib/db/client';
import { calendarSources, events } from '@/lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import {
  fetchCalendarEvents,
  refreshAccessToken,
  convertGoogleEventToInternal,
  type GoogleCalendarEvent,
} from '@/lib/integrations/google-calendar';

/**
 * Check if token needs refresh (within 5 minutes of expiry)
 */
function tokenNeedsRefresh(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  return expiresAt <= fiveMinutesFromNow;
}

/**
 * Sync events from a single Google Calendar source
 */
export async function syncGoogleCalendarSource(
  sourceId: string,
  options: {
    timeMin?: Date;
    timeMax?: Date;
  } = {}
): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;

  // Fetch the calendar source
  const source = await db.query.calendarSources.findFirst({
    where: eq(calendarSources.id, sourceId),
  });

  if (!source) {
    return { synced: 0, errors: ['Calendar source not found'] };
  }

  if (source.provider !== 'google') {
    return { synced: 0, errors: ['Not a Google Calendar source'] };
  }

  if (!source.accessToken) {
    return { synced: 0, errors: ['No access token available'] };
  }

  let accessToken = source.accessToken;

  // Refresh token if needed
  if (tokenNeedsRefresh(source.tokenExpiresAt)) {
    if (!source.refreshToken) {
      return { synced: 0, errors: ['Token expired and no refresh token available'] };
    }

    try {
      const newTokens = await refreshAccessToken(source.refreshToken);
      accessToken = newTokens.access_token;

      // Update tokens in database
      await db
        .update(calendarSources)
        .set({
          accessToken: newTokens.access_token,
          refreshToken: newTokens.refresh_token || source.refreshToken,
          tokenExpiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
          updatedAt: new Date(),
        })
        .where(eq(calendarSources.id, sourceId));
    } catch (error) {
      return { synced: 0, errors: [`Failed to refresh token: ${error}`] };
    }
  }

  // Set default time range (now to 30 days from now)
  const timeMin = options.timeMin || new Date();
  const timeMax = options.timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Fetch events from Google
  let googleEvents: GoogleCalendarEvent[];
  try {
    googleEvents = await fetchCalendarEvents(accessToken, source.sourceCalendarId, {
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    });
  } catch (error) {
    // Store sync error
    await db
      .update(calendarSources)
      .set({
        syncErrors: { lastError: String(error), timestamp: new Date().toISOString() },
        updatedAt: new Date(),
      })
      .where(eq(calendarSources.id, sourceId));

    return { synced: 0, errors: [`Failed to fetch events: ${error}`] };
  }

  // Process each event
  for (const googleEvent of googleEvents) {
    try {
      const internalEvent = convertGoogleEventToInternal(googleEvent, sourceId);

      // Check if event already exists
      const existing = await db.query.events.findFirst({
        where: and(
          eq(events.calendarSourceId, sourceId),
          eq(events.externalEventId, googleEvent.id)
        ),
      });

      if (existing) {
        // Update existing event
        await db
          .update(events)
          .set({
            title: internalEvent.title,
            description: internalEvent.description,
            location: internalEvent.location,
            startTime: internalEvent.startTime,
            endTime: internalEvent.endTime,
            allDay: internalEvent.allDay,
            recurring: internalEvent.recurring,
            recurrenceRule: internalEvent.recurrenceRule,
            lastSynced: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(events.id, existing.id));
      } else {
        // Insert new event
        await db.insert(events).values({
          calendarSourceId: sourceId,
          externalEventId: internalEvent.externalEventId,
          title: internalEvent.title,
          description: internalEvent.description,
          location: internalEvent.location,
          startTime: internalEvent.startTime,
          endTime: internalEvent.endTime,
          allDay: internalEvent.allDay,
          recurring: internalEvent.recurring,
          recurrenceRule: internalEvent.recurrenceRule,
          lastSynced: new Date(),
        });
      }

      synced++;
    } catch (error) {
      errors.push(`Failed to sync event ${googleEvent.id}: ${error}`);
    }
  }

  // Update last synced timestamp
  await db
    .update(calendarSources)
    .set({
      lastSynced: new Date(),
      syncErrors: null,
      updatedAt: new Date(),
    })
    .where(eq(calendarSources.id, sourceId));

  return { synced, errors };
}

/**
 * Sync all enabled Google Calendar sources
 */
export async function syncAllGoogleCalendars(
  options: {
    timeMin?: Date;
    timeMax?: Date;
  } = {}
): Promise<{ total: number; errors: string[] }> {
  const allErrors: string[] = [];
  let total = 0;

  // Get all enabled Google Calendar sources
  const sources = await db.query.calendarSources.findMany({
    where: and(
      eq(calendarSources.provider, 'google'),
      eq(calendarSources.enabled, true)
    ),
  });

  // Sync each source
  for (const source of sources) {
    const result = await syncGoogleCalendarSource(source.id, options);
    total += result.synced;
    allErrors.push(...result.errors);
  }

  return { total, errors: allErrors };
}

/**
 * Get all events for a date range from the database
 */
export async function getEventsForDateRange(
  startDate: Date,
  endDate: Date
): Promise<typeof events.$inferSelect[]> {
  return db.query.events.findMany({
    where: and(
      gte(events.startTime, startDate),
      lte(events.startTime, endDate)
    ),
    orderBy: (events, { asc }) => [asc(events.startTime)],
    with: {
      calendarSource: true,
    },
  });
}

/**
 * Get all calendar sources with their sync status
 */
export async function getCalendarSourcesWithStatus() {
  return db.query.calendarSources.findMany({
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
}
