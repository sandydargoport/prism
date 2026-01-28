/**
 * ============================================================================
 * PRISM - Calendar Sync API Route
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Triggers synchronization of calendar events from external sources.
 *
 * ENDPOINT: /api/calendars/sync
 * - POST: Trigger sync for all calendars or a specific calendar
 *
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  syncAllGoogleCalendars,
  syncGoogleCalendarSource,
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

    let result: { synced?: number; total?: number; errors: string[] };

    if (body.calendarId) {
      // Sync specific calendar
      const syncResult = await syncGoogleCalendarSource(body.calendarId, options);
      result = { synced: syncResult.synced, errors: syncResult.errors };
    } else {
      // Sync all calendars
      const syncResult = await syncAllGoogleCalendars(options);
      result = { total: syncResult.total, errors: syncResult.errors };
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

    return NextResponse.json({
      success: true,
      message: body.calendarId
        ? `Synced ${result.synced} events`
        : `Synced ${result.total} events from all calendars`,
      synced: result.synced ?? result.total,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error('Calendar sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync calendars' },
      { status: 500 }
    );
  }
}
