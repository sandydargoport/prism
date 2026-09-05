/**
 * Whether calendar sync has stopped, and for how many sources.
 *
 * When a provider's grant is revoked or expires, `calendar-sync` flags the
 * source `needsReauth` and stops. That has always been recorded and shown on
 * the integrations settings page — but only to somebody who thinks to look
 * there. A household sees a calendar quietly going stale and no reason for it;
 * on one instance twelve calendars stopped syncing and it went unnoticed for
 * six days.
 *
 * So the calendar page and the calendar widget ask this. It returns a count and
 * the provider names, deliberately nothing else: not the calendar names, not
 * the account addresses. A wall display is a public surface, and "your calendar
 * needs reconnecting" is all anyone standing in front of one needs to know.
 *
 * `/api/integrations/status` already derives the same flag, and is the wrong
 * thing to reuse here on both counts: it answers with the connected account
 * addresses (it exists to render "Connected as ..."), and it only looks at
 * Google. Note also that `syncErrors` doubles as a config blob on CalDAV rows,
 * where it holds the account username — so the column must never be passed
 * through to a client verbatim.
 */

import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { calendarSources } from '@/lib/db/schema';
import { getDisplayAuth } from '@/lib/auth';
import { logError } from '@/lib/utils/logError';

export async function GET() {
  const auth = await getDisplayAuth();
  if (!auth) return NextResponse.json({ needsReauth: 0, providers: [] });

  try {
    const rows = await db
      .select({
        provider: calendarSources.provider,
        syncErrors: calendarSources.syncErrors,
      })
      .from(calendarSources)
      .where(eq(calendarSources.enabled, true));

    const stalled = rows.filter(
      (r) => (r.syncErrors as { needsReauth?: boolean } | null)?.needsReauth === true,
    );

    return NextResponse.json({
      needsReauth: stalled.length,
      providers: [...new Set(stalled.map((r) => r.provider))],
    });
  } catch (error) {
    logError('calendar sync health', error);
    // A broken health check must never become a broken calendar.
    return NextResponse.json({ needsReauth: 0, providers: [] });
  }
}
