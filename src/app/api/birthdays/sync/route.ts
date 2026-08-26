/**
 * ENDPOINT: POST /api/birthdays/sync
 *
 * Detects birthdays, anniversaries and milestones across EVERY calendar
 * source — google, ical, caldav and local — by scanning the normalised
 * `events` table.
 *
 * Previously this read two hardcoded Google calendars (the Google Contacts
 * birthday calendar, and any source whose name contained "friends"). That only
 * worked for users who happened to keep a calendar with that name, missed
 * birthdays sitting on every other calendar, and was documented nowhere
 * (discussion #292). The detection logic now lives in
 * `src/lib/services/birthday-detect.ts`.
 *
 * Response shape is unchanged so existing callers keep working:
 * CalendarsSection.tsx and useBirthdays.ts.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { logError } from '@/lib/utils/logError';
import { detectBirthdaysFromEvents } from '@/lib/services/birthday-detect';

export async function POST() {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { added, updated, total, errors } = await detectBirthdaysFromEvents();

    // Net changes (added + updated), not the total considered — matches the
    // calendar-event sync. `synced` kept for back-compat.
    return NextResponse.json({
      synced: added + updated,
      added,
      updated,
      total,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    logError('Error detecting birthdays:', error);
    return NextResponse.json(
      { error: 'Failed to detect birthdays from calendars' },
      { status: 500 }
    );
  }
}
