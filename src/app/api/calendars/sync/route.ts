/**
 *
 * Triggers synchronization of calendar events from external sources.
 *
 * ENDPOINT: /api/calendars/sync
 * - POST: Trigger sync for all calendars or a specific calendar
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { logError } from '@/lib/utils/logError';
import { db } from '@/lib/db/client';
import { calendarSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import {
  syncAllGoogleCalendars,
  syncGoogleCalendarSource,
  syncAllIcalCalendars,
  syncIcalCalendarSource,
  syncAllCalDAVCalendars,
  syncCalDAVCalendarSource,
} from '@/lib/services/calendar-sync';

/**
 * POST /api/calendars/sync
 * Triggers calendar synchronization
 *
 * REQUEST BODY:
 * {
 *   calendarId?: string  // Optional: specific calendar to sync
 *   timeMin?: string     // Optional: start of date range (ISO string)
 *   timeMax?: string     // Optional: end of date range (ISO string)
 * }
 *
 * If calendarId is not provided, syncs all enabled calendars.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = await request.json().catch(() => ({}));

    const options: { timeMin?: Date; timeMax?: Date } = {};

    // Parse date range if provided
    if (body.timeMin) {
      const timeMin = new Date(body.timeMin);
      if (!isNaN(timeMin.getTime())) {
        options.timeMin = timeMin;
      }
    }

    if (body.timeMax) {
      const timeMax = new Date(body.timeMax);
      if (!isNaN(timeMax.getTime())) {
        options.timeMax = timeMax;
      }
    }

    let result: {
      synced?: number;
      total?: number;
      added: number;
      updated: number;
      removed: number;
      errors: string[];
    };

    if (body.calendarId) {
      // Sync specific calendar — dispatch by provider
      const source = await db.query.calendarSources.findFirst({
        where: eq(calendarSources.id, body.calendarId),
        columns: { id: true, provider: true },
      });
      if (!source) {
        return NextResponse.json(
          { error: 'Calendar source not found' },
          { status: 404 }
        );
      }
      const syncResult = source.provider === 'ical'
        ? await syncIcalCalendarSource(body.calendarId, options)
        : source.provider === 'caldav'
          ? await syncCalDAVCalendarSource(body.calendarId, options)
          : await syncGoogleCalendarSource(body.calendarId, options);
      result = {
        synced: syncResult.synced,
        added: syncResult.added,
        updated: syncResult.updated,
        removed: syncResult.removed,
        errors: syncResult.errors,
      };
    } else {
      // Sync all calendars across all supported providers
      const [google, ical, caldav] = await Promise.all([
        syncAllGoogleCalendars(options),
        syncAllIcalCalendars(options),
        syncAllCalDAVCalendars(options),
      ]);
      result = {
        total: google.total + ical.total + caldav.total,
        added: google.added + ical.added + caldav.added,
        updated: google.updated + ical.updated + caldav.updated,
        removed: google.removed + ical.removed + caldav.removed,
        errors: [...google.errors, ...ical.errors, ...caldav.errors],
      };
    }

    // Return appropriate response based on results
    if (result.errors.length > 0 && (result.synced === 0 || result.total === 0)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Sync failed',
          errors: result.errors,
        },
        { status: 500 }
      );
    }

    // A manual sync writes straight to the DB; invalidate the cached event
    // lists so the calendar reflects new/removed events immediately (the cron
    // path does this itself, but this route didn't).
    await invalidateEntity('events');

    // Report NET changes (added / updated / removed), not total re-pulled.
    // Removals aren't applied silently anymore — they're flagged for review.
    const changeParts: string[] = [];
    if (result.added) changeParts.push(`${result.added} added`);
    if (result.updated) changeParts.push(`${result.updated} updated`);
    if (result.removed) changeParts.push(`${result.removed} flagged for review`);
    const changeSummary = changeParts.length ? changeParts.join(', ') : 'no changes';

    return NextResponse.json({
      success: true,
      message: `Calendar sync complete — ${changeSummary}`,
      added: result.added,
      updated: result.updated,
      removed: result.removed,
      synced: result.synced ?? result.total,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    logError('Calendar sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync calendars' },
      { status: 500 }
    );
  }
}
