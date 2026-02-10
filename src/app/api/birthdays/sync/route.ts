/**
 *
 * ENDPOINT: POST /api/birthdays/sync
 *
 * Fetches events from Google Calendar sources:
 * 1. Birthdays calendar (addressbook#contacts@group.v.calendar.google.com)
 * 2. "Friends & Family" calendar (matched by name from calendarSources)
 *
 * Parses event titles to extract name, type, and year, then upserts
 * into the birthdays table.
 *
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { birthdays, calendarSources } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import {
  fetchCalendarEvents,
  refreshAccessToken,
  type GoogleCalendarEvent,
} from '@/lib/integrations/google-calendar';
import { decrypt, encrypt } from '@/lib/utils/crypto';

/** The special Google Contacts birthday calendar ID */
const BIRTHDAYS_CALENDAR_ID = 'addressbook#contacts@group.v.calendar.google.com';

/** Friends & Family calendar name to match against */
const FRIENDS_FAMILY_CALENDAR_NAME = 'Friends & Family';

type EventType = 'birthday' | 'anniversary' | 'milestone';

interface ParsedEvent {
  name: string;
  eventType: EventType;
  birthDate: string; // YYYY-MM-DD
  year: number | null; // Birth year or start year
}

/**
 * Parse a Google Calendar event into a birthday/milestone record
 */
function parseCalendarEvent(event: GoogleCalendarEvent): ParsedEvent | null {
  const title = event.summary || '';
  if (!title.trim()) return null;

  // Determine the event date
  const dateStr = event.start.date || event.start.dateTime?.split('T')[0];
  if (!dateStr) return null;

  // Detect event type from title
  let eventType: EventType = 'milestone';
  let name = title;

  if (/birthday/i.test(title)) {
    eventType = 'birthday';
    // Strip "'s Birthday", "Birthday - ", etc.
    name = title
      .replace(/['']s\s+birthday/i, '')
      .replace(/\s*-\s*birthday/i, '')
      .replace(/birthday\s*-?\s*/i, '')
      .trim();
  } else if (/anniversary/i.test(title)) {
    eventType = 'anniversary';
    name = title
      .replace(/['']s\s+anniversary/i, '')
      .replace(/\s*-\s*anniversary/i, '')
      .replace(/anniversary\s*-?\s*/i, '')
      .trim();
  }

  // Look for a 4-digit year in title or description
  let year: number | null = null;
  const combinedText = `${title} ${event.description || ''}`;
  const yearMatch = combinedText.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    year = parseInt(yearMatch[1]!, 10);
  }

  // Clean up name:
  // Remove parenthesized year like "(1993)" or "(2008)"
  name = name.replace(/\s*\(\d{4}\)\s*/g, ' ');
  // Remove trailing possessive 's or ' left from title parsing
  name = name.replace(/['']s?\s*$/, '');
  // Collapse whitespace
  name = name.replace(/\s+/g, ' ').trim();
  if (!name) name = title;

  return {
    name,
    eventType,
    birthDate: dateStr,
    year,
  };
}

/**
 * Get a valid access token for a calendar source, refreshing if needed
 * Tokens are stored encrypted, so we decrypt before returning
 */
async function getAccessToken(source: {
  id: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
}): Promise<string | null> {
  if (!source.accessToken) return null;

  try {
    // Check if token needs refresh
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    if (source.tokenExpiresAt && source.tokenExpiresAt > fiveMinutesFromNow) {
      // Token still valid - decrypt and return
      return decrypt(source.accessToken);
    }

    if (!source.refreshToken) return null;

    // Token expired - refresh it
    const decryptedRefreshToken = decrypt(source.refreshToken);
    const newTokens = await refreshAccessToken(decryptedRefreshToken);

    // Store new tokens encrypted
    await db
      .update(calendarSources)
      .set({
        accessToken: encrypt(newTokens.access_token),
        refreshToken: newTokens.refresh_token ? encrypt(newTokens.refresh_token) : source.refreshToken,
        tokenExpiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
        updatedAt: new Date(),
      })
      .where(eq(calendarSources.id, source.id));

    return newTokens.access_token;
  } catch (err) {
    console.error('[BirthdaySync] Error getting access token:', err);
    return null;
  }
}

/**
 * POST /api/birthdays/sync
 */
export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    // Find all enabled Google calendar sources
    const sources = await db.query.calendarSources.findMany({
      where: and(
        eq(calendarSources.provider, 'google'),
        eq(calendarSources.enabled, true)
      ),
    });

    if (sources.length === 0) {
      return NextResponse.json(
        { error: 'No Google Calendar sources connected' },
        { status: 400 }
      );
    }

    // We need any valid access token to query Google Calendar
    // Try each source until we find one with valid credentials
    let accessToken: string | null = null;
    let tokenSourceId: string | null = null;

    for (const source of sources) {
      const token = await getAccessToken(source);
      if (token) {
        accessToken = token;
        tokenSourceId = source.id;
        break;
      }
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: 'No valid Google Calendar credentials found' },
        { status: 401 }
      );
    }

    const allEvents: GoogleCalendarEvent[] = [];
    const calendarSourceLabel: Record<string, string> = {};
    // Look back 30 days and forward 400 days to catch all birthday occurrences
    const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const timeMax = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000);
    console.log('[BirthdaySync] Date range:', timeMin.toISOString(), 'to', timeMax.toISOString());

    // 1. Fetch from Birthdays calendar
    try {
      const birthdayEvents = await fetchCalendarEvents(accessToken, BIRTHDAYS_CALENDAR_ID, {
        timeMin,
        timeMax,
        maxResults: 250,
        singleEvents: true,
        orderBy: 'startTime',
      });
      for (const ev of birthdayEvents) {
        allEvents.push(ev);
        calendarSourceLabel[ev.id] = 'birthdays';
      }
    } catch (err) {
      console.warn('Could not fetch from Birthdays calendar:', err);
    }

    // 2. Fetch from Friends & Family calendar (match by display name)
    const friendsFamilySource = sources.find(
      (s) =>
        s.displayName?.toLowerCase().includes('friends') ||
        s.dashboardCalendarName?.toLowerCase().includes('friends')
    );

    console.log('[BirthdaySync] Looking for Friends & Family calendar...');
    console.log('[BirthdaySync] Found source:', friendsFamilySource ? {
      id: friendsFamilySource.id,
      displayName: friendsFamilySource.displayName,
      sourceCalendarId: friendsFamilySource.sourceCalendarId,
    } : 'NOT FOUND');

    if (friendsFamilySource) {
      try {
        const token = await getAccessToken(friendsFamilySource) || accessToken;
        console.log('[BirthdaySync] Fetching events from Friends & Family, calendarId:', friendsFamilySource.sourceCalendarId);
        const ffEvents = await fetchCalendarEvents(token, friendsFamilySource.sourceCalendarId, {
          timeMin,
          timeMax,
          maxResults: 250,
          singleEvents: true,
          orderBy: 'startTime',
        });
        console.log('[BirthdaySync] Found', ffEvents.length, 'events in Friends & Family');
        for (const ev of ffEvents) {
          console.log('[BirthdaySync] Event:', ev.summary, '| Start:', ev.start?.date || ev.start?.dateTime);
          allEvents.push(ev);
          calendarSourceLabel[ev.id] = 'friends_family';
        }
      } catch (err) {
        console.error('[BirthdaySync] Error fetching Friends & Family:', err);
      }
    } else {
      console.log('[BirthdaySync] No Friends & Family calendar found in sources');
    }

    // Parse all events into upsert-ready rows
    const errors: string[] = [];
    const rows: { name: string; birthDate: string; eventType: string; googleCalendarSource: string }[] = [];

    console.log('[BirthdaySync] Parsing', allEvents.length, 'total events...');
    for (const event of allEvents) {
      const parsed = parseCalendarEvent(event);
      if (!parsed) {
        console.log('[BirthdaySync] Could not parse event:', event.summary);
        continue;
      }

      const [, month, day] = parsed.birthDate.split('-');
      const birthDate = parsed.year
        ? `${parsed.year}-${month}-${day}`
        : `1904-${month}-${day}`;

      const calSource = calendarSourceLabel[event.id] || 'google';
      console.log('[BirthdaySync] Parsed:', parsed.name, parsed.eventType, birthDate);
      rows.push({ name: parsed.name, birthDate, eventType: parsed.eventType, googleCalendarSource: calSource });
    }
    console.log('[BirthdaySync] Total rows to upsert:', rows.length);

    // Upsert each row individually for better error tracking
    let synced = 0;
    console.log('[BirthdaySync] Upserting', rows.length, 'rows...');
    for (const row of rows) {
      try {
        await db
          .insert(birthdays)
          .values({
            name: row.name,
            birthDate: row.birthDate,
            eventType: row.eventType,
            googleCalendarSource: row.googleCalendarSource,
          })
          .onConflictDoUpdate({
            target: [birthdays.name, birthdays.eventType],
            set: {
              birthDate: row.birthDate,
              googleCalendarSource: row.googleCalendarSource,
            },
          });
        synced++;
      } catch (err) {
        console.error('[BirthdaySync] Failed to upsert:', row.name, row.eventType, err);
        errors.push(`Failed to upsert ${row.name}: ${err}`);
      }
    }
    console.log('[BirthdaySync] Upserted', synced, 'of', rows.length, 'rows');

    return NextResponse.json({
      synced,
      total: allEvents.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error syncing birthdays:', error);
    return NextResponse.json(
      { error: 'Failed to sync birthdays from Google Calendar' },
      { status: 500 }
    );
  }
}
