import { db } from '@/lib/db/client';
import { calendarSources, events, tasks, taskLists } from '@/lib/db/schema';
import { eq, and, gte, lte, sql, inArray } from 'drizzle-orm';
import {
  fetchCalDAVEvents,
  fetchCalDAVTasks,
  type CalDAVConnectionConfig,
} from '@/lib/integrations/caldav';
import {
  fetchCalendarEvents,
  fetchCalendarList,
  refreshAccessToken,
  convertGoogleEventToInternal,
  TokenRevokedError,
  type GoogleCalendarEvent,
} from '@/lib/integrations/google-calendar';
import { decrypt, encrypt } from '@/lib/utils/crypto';
import { validatePublicUrl, UnsafeUrlError } from '@/lib/utils/safeFetch';
import { async as icalAsync, type VEvent, type CalendarResponse } from 'node-ical';

/**
 * Default sync window.
 *
 * Past: 90 days back so recent-past events (last quarter) keep flowing in.
 * Events OLDER than this are never touched by sync — the delete-on-remove
 * logic only operates within this window, so historic events synced under
 * an older default stay in the local DB forever.
 *
 * Future: 365 days forward so school-year, sports-season, and far-out
 * scheduled events show up. The previous ±30-day default silently dropped
 * anything beyond a month.
 */
const DEFAULT_TIME_MIN_MS = 90 * 24 * 60 * 60 * 1000;       // 90 days
const DEFAULT_TIME_MAX_MS = 365 * 24 * 60 * 60 * 1000;      // 365 days

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

  let accessToken: string;
  try {
    accessToken = decrypt(source.accessToken);
  } catch (error) {
    return { synced: 0, errors: [`Failed to decrypt access token (may need re-authentication): ${error instanceof Error ? error.message : String(error)}`] };
  }

  if (tokenNeedsRefresh(source.tokenExpiresAt)) {
    if (!source.refreshToken) {
      return { synced: 0, errors: ['Token expired and no refresh token available'] };
    }

    try {
      const refreshToken = decrypt(source.refreshToken);
      const newTokens = await refreshAccessToken(refreshToken);
      accessToken = newTokens.access_token;

      await db
        .update(calendarSources)
        .set({
          accessToken: encrypt(newTokens.access_token),
          refreshToken: newTokens.refresh_token ? encrypt(newTokens.refresh_token) : source.refreshToken,
          tokenExpiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
          updatedAt: new Date(),
        })
        .where(eq(calendarSources.id, sourceId));
    } catch (error) {
      // If token is revoked/expired, mark as needing re-authentication
      if (error instanceof TokenRevokedError) {
        await db
          .update(calendarSources)
          .set({
            syncErrors: {
              needsReauth: true,
              lastError: 'Token expired or revoked. Please re-authenticate.',
              timestamp: new Date().toISOString(),
            },
            updatedAt: new Date(),
          })
          .where(eq(calendarSources.id, sourceId));
        return { synced: 0, errors: ['Token expired or revoked. Re-authentication required.'] };
      }
      return { synced: 0, errors: [`Failed to refresh token: ${error}`] };
    }
  }

  // Default sync window — 30 days back, 365 days forward. See constants above.
  const timeMin = options.timeMin || new Date(Date.now() - DEFAULT_TIME_MIN_MS);
  const timeMax = options.timeMax || new Date(Date.now() + DEFAULT_TIME_MAX_MS);

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
    const errorStr = String(error);
    const is404 = errorStr.includes('404') || errorStr.includes('Not Found');

    // Track consecutive failures instead of immediately disabling
    const prevErrors = (source.syncErrors as Record<string, unknown>) || {};
    const prevFailures = (typeof prevErrors.consecutiveFailures === 'number' ? prevErrors.consecutiveFailures : 0);
    const consecutiveFailures = prevFailures + 1;
    const DISABLE_THRESHOLD = 3; // Only auto-disable after 3 consecutive 404s

    const shouldAutoDisable = is404
      && consecutiveFailures >= DISABLE_THRESHOLD
      && !prevErrors.userOverride; // Never auto-disable if user manually re-enabled

    await db
      .update(calendarSources)
      .set({
        ...(shouldAutoDisable ? { enabled: false, showInEventModal: false } : {}),
        syncErrors: {
          lastError: is404
            ? `Calendar not found in Google (404). Failure ${consecutiveFailures}/${DISABLE_THRESHOLD}.`
            : errorStr,
          consecutiveFailures,
          is404,
          ...(shouldAutoDisable ? { autoDisabled: true, autoDisabledAt: new Date().toISOString() } : {}),
          ...(prevErrors.userOverride ? { userOverride: true } : {}),
          timestamp: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(calendarSources.id, sourceId));

    return { synced: 0, errors: [`Failed to fetch events: ${error}`] };
  }

  // Build set of Google event IDs for deletion cleanup (excluding cancelled)
  const googleEventIds = new Set<string>();

  // Process each event using upsert to prevent duplicates
  for (const googleEvent of googleEvents) {
    try {
      // Skip cancelled events (deleted recurring instances)
      if (googleEvent.status === 'cancelled') continue;

      googleEventIds.add(googleEvent.id);
      const internalEvent = convertGoogleEventToInternal(googleEvent, sourceId);

      // Use upsert (ON CONFLICT) to prevent race condition duplicates
      await db
        .insert(events)
        .values({
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
        })
        .onConflictDoUpdate({
          target: [events.calendarSourceId, events.externalEventId],
          set: {
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
          },
        });

      synced++;
    } catch (error) {
      errors.push(`Failed to sync event ${googleEvent.id}: ${error}`);
    }
  }

  // Delete events that exist in Prism but were removed from Google
  // (Google is source of truth for synced events; cancelled events excluded above)

  // Find Prism events for this source that have an external_event_id
  // but are no longer in Google (within the sync date range)
  const prismEventsToCheck = await db.query.events.findMany({
    where: and(
      eq(events.calendarSourceId, sourceId),
      gte(events.startTime, timeMin),
      lte(events.startTime, timeMax)
    ),
  });

  for (const prismEvent of prismEventsToCheck) {
    // Only delete if it has an external_event_id (was synced) but is no longer in Google
    if (prismEvent.externalEventId && !googleEventIds.has(prismEvent.externalEventId)) {
      await db.delete(events).where(eq(events.id, prismEvent.id));
    }
  }

  // Update last synced timestamp (preserve userOverride so sync won't auto-disable)
  const currentErrors = (source.syncErrors as Record<string, unknown>) || {};
  await db
    .update(calendarSources)
    .set({
      lastSynced: new Date(),
      syncErrors: currentErrors.userOverride ? { userOverride: true } : null,
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

  // Update showInEventModal based on actual Google accessRole.
  // Group sources by their refresh token to handle multiple Google accounts.
  // Each unique refresh token represents a different Google account.
  const tokenGroups = new Map<string, typeof sources>();
  for (const source of sources) {
    if (!source.refreshToken) continue;
    const key = source.refreshToken; // Encrypted token as grouping key
    const group = tokenGroups.get(key) || [];
    group.push(source);
    tokenGroups.set(key, group);
  }

  // Build a combined role map across all Google accounts
  const combinedRoleMap = new Map<string, string>();
  const checkedSourceIds = new Set<string>();

  for (const [, group] of tokenGroups) {
    const representative = group[0];
    if (!representative?.accessToken) continue;

    try {
      let accessToken = decrypt(representative.accessToken);
      if (tokenNeedsRefresh(representative.tokenExpiresAt) && representative.refreshToken) {
        const refreshToken = decrypt(representative.refreshToken);
        const newTokens = await refreshAccessToken(refreshToken);
        accessToken = newTokens.access_token;
      }
      const googleCalendars = await fetchCalendarList(accessToken);
      for (const cal of googleCalendars) {
        combinedRoleMap.set(cal.id, cal.accessRole);
      }
      for (const s of group) {
        checkedSourceIds.add(s.id);
      }
    } catch (error) {
      console.error(`[Sync] Failed to fetch calendar list for account group:`, error);
    }
  }

  // Now check each source against the combined map
  for (const source of sources) {
    if (!checkedSourceIds.has(source.id)) continue;

    const role = combinedRoleMap.get(source.sourceCalendarId);
    if (role === undefined) {
      // Calendar no longer in any connected Google account
      const prevErrors = (source.syncErrors as Record<string, unknown>) || {};
      const prevFailures = (typeof prevErrors.consecutiveNotFound === 'number' ? prevErrors.consecutiveNotFound : 0);
      const consecutiveNotFound = prevFailures + 1;
      const DISABLE_THRESHOLD = 3;
      const shouldAutoDisable = consecutiveNotFound >= DISABLE_THRESHOLD && !prevErrors.userOverride;

      await db
        .update(calendarSources)
        .set({
          ...(shouldAutoDisable ? { enabled: false, showInEventModal: false } : {}),
          syncErrors: {
            lastError: `Calendar not found in Google. Check ${consecutiveNotFound}/${DISABLE_THRESHOLD}.`,
            consecutiveNotFound,
            ...(shouldAutoDisable ? { autoDisabled: true, autoDisabledAt: new Date().toISOString() } : {}),
            ...(prevErrors.userOverride ? { userOverride: true } : {}),
            timestamp: new Date().toISOString(),
          },
          updatedAt: new Date(),
        })
        .where(eq(calendarSources.id, source.id));
      continue;
    }
    // Calendar found — clear any not-found counters (preserve userOverride)
    const prevErrors = (source.syncErrors as Record<string, unknown>) || {};
    if (prevErrors.consecutiveNotFound) {
      await db
        .update(calendarSources)
        .set({
          syncErrors: prevErrors.userOverride ? { userOverride: true } : null,
          updatedAt: new Date(),
        })
        .where(eq(calendarSources.id, source.id));
    }
    const isWritable = role === 'writer' || role === 'owner';
    if (source.showInEventModal !== isWritable) {
      await db
        .update(calendarSources)
        .set({ showInEventModal: isWritable, updatedAt: new Date() })
        .where(eq(calendarSources.id, source.id));
    }
  }

  // Sync each source (catch errors per-source so one bad calendar doesn't crash all)
  for (const source of sources) {
    try {
      const result = await syncGoogleCalendarSource(source.id, options);
      total += result.synced;
      allErrors.push(...result.errors);
    } catch (error) {
      const errorMsg = `Failed to sync calendar "${source.dashboardCalendarName}": ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[Sync] ${errorMsg}`);
      allErrors.push(errorMsg);
    }
  }

  return { total, errors: allErrors };
}

const ICAL_DISABLE_THRESHOLD = 3;

/**
 * Build a stable per-instance external ID for a recurring iCal event so each
 * occurrence gets its own row keyed off (calendarSourceId, externalEventId).
 */
function instanceExternalId(uid: string, occurrence: Date): string {
  return `${uid}_${occurrence.toISOString()}`;
}

/**
 * Coerce an iCal property to a plain string. node-ical returns
 * { params, val } objects when the source property carries parameters
 * (e.g. `SUMMARY;LANGUAGE=en-us:New Year's Day`), even though its types
 * declare these fields as plain strings.
 */
function readIcalString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'val' in value) {
    const inner = (value as { val: unknown }).val;
    return typeof inner === 'string' ? inner : null;
  }
  return null;
}

/**
 * Sync events from a single iCal subscription source.
 *
 * Mirrors syncGoogleCalendarSource: fetches and parses the feed, upserts
 * VEVENTs (expanding recurrences within the time window), then deletes Prism
 * events whose externalEventId is no longer present upstream.
 */
export async function syncIcalCalendarSource(
  sourceId: string,
  options: {
    timeMin?: Date;
    timeMax?: Date;
  } = {}
): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;

  const source = await db.query.calendarSources.findFirst({
    where: eq(calendarSources.id, sourceId),
  });

  if (!source) {
    return { synced: 0, errors: ['Calendar source not found'] };
  }
  if (source.provider !== 'ical') {
    return { synced: 0, errors: ['Not an iCal calendar source'] };
  }
  if (!source.icalUrl) {
    return { synced: 0, errors: ['No iCal URL configured'] };
  }

  const timeMin = options.timeMin || new Date(Date.now() - DEFAULT_TIME_MIN_MS);
  const timeMax = options.timeMax || new Date(Date.now() + DEFAULT_TIME_MAX_MS);

  // SSRF guard: a stored icalUrl that predates the route-level validator
  // could still point at a private destination. Re-validate at the fetch
  // boundary so a malicious or compromised parent cannot use Prism as
  // a proxy to probe the internal network.
  try {
    validatePublicUrl(source.icalUrl);
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      await db
        .update(calendarSources)
        .set({
          syncErrors: {
            lastError: 'iCal URL points at a private or loopback address; sync skipped.',
            timestamp: new Date().toISOString(),
          },
          updatedAt: new Date(),
        })
        .where(eq(calendarSources.id, sourceId));
      return { synced: 0, errors: ['iCal URL points at a private or loopback address'] };
    }
    throw err;
  }

  let parsed: CalendarResponse;
  try {
    parsed = await icalAsync.fromURL(source.icalUrl);
  } catch (error) {
    const errorStr = error instanceof Error ? error.message : String(error);
    const prevErrors = (source.syncErrors as Record<string, unknown>) || {};
    const prevFailures = typeof prevErrors.consecutiveFailures === 'number' ? prevErrors.consecutiveFailures : 0;
    const consecutiveFailures = prevFailures + 1;
    const shouldAutoDisable = consecutiveFailures >= ICAL_DISABLE_THRESHOLD && !prevErrors.userOverride;

    await db
      .update(calendarSources)
      .set({
        ...(shouldAutoDisable ? { enabled: false, showInEventModal: false } : {}),
        syncErrors: {
          lastError: `Failed to fetch iCal feed: ${errorStr}`,
          consecutiveFailures,
          ...(shouldAutoDisable ? { autoDisabled: true, autoDisabledAt: new Date().toISOString() } : {}),
          ...(prevErrors.userOverride ? { userOverride: true } : {}),
          timestamp: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(calendarSources.id, sourceId));

    return { synced: 0, errors: [`Failed to fetch iCal feed: ${errorStr}`] };
  }

  const externalIds = new Set<string>();

  for (const item of Object.values(parsed)) {
    if (!item || item.type !== 'VEVENT') continue;
    const vevent = item as VEvent;

    // node-ical may surface UID as a PropertyWithArgs object on feeds whose
    // UID property carries parameters (rare but observed). The downstream
    // instanceExternalId() does string concatenation on uid, so an object
    // would produce "[object Object]_<ts>" and collide across instances.
    // Read through the same unwrap helper used for summary / description /
    // location and skip the VEVENT entirely if uid cannot be coerced.
    const uid = readIcalString(vevent.uid);
    if (!uid) {
      errors.push('Skipped VEVENT with missing or non-string UID');
      continue;
    }

    try {
      if (vevent.status === 'CANCELLED') continue;
      if (!vevent.start || !vevent.end) continue;

      const allDay = vevent.datetype === 'date';
      const baseDurationMs = vevent.end.getTime() - vevent.start.getTime();

      // exdate is keyed by ISO-ish date string but we only need the values for comparison
      const exdates = new Set<number>();
      if (vevent.exdate && typeof vevent.exdate === 'object') {
        for (const ex of Object.values(vevent.exdate as Record<string, Date | undefined>)) {
          if (ex instanceof Date) exdates.add(ex.getTime());
        }
      }

      const instances: Array<{ start: Date; end: Date; externalId: string }> = [];
      const isRecurring = !!vevent.rrule;

      if (vevent.rrule) {
        // Expand recurring instances within the sync window
        const occurrences = vevent.rrule.between(timeMin, timeMax, true);
        for (const occ of occurrences) {
          if (exdates.has(occ.getTime())) continue;
          instances.push({
            start: occ,
            end: new Date(occ.getTime() + baseDurationMs),
            externalId: instanceExternalId(uid, occ),
          });
        }
      } else {
        // Single event — only sync if it overlaps the window at all
        if (vevent.end >= timeMin && vevent.start <= timeMax) {
          instances.push({
            start: vevent.start,
            end: vevent.end,
            externalId: uid,
          });
        }
      }

      // Per-instance rows are keyed on the expanded externalEventId, so the
      // RRULE string would be repeated identically across every occurrence.
      // That shape misleads consumers that try to read recurrenceRule as
      // "this row is the recurring master." Leave recurrenceRule null on
      // expanded instances and let `recurring: true` carry the boolean
      // signal. Preserves Google's per-row shape (which uses singleEvents:
      // true and never carries an RRULE on individual instances either).
      const recurrenceRule = null;
      const title = readIcalString(vevent.summary) || '(no title)';
      const description = readIcalString(vevent.description);
      const location = readIcalString(vevent.location);

      for (const inst of instances) {
        externalIds.add(inst.externalId);
        await db
          .insert(events)
          .values({
            calendarSourceId: sourceId,
            externalEventId: inst.externalId,
            title,
            description,
            location,
            startTime: inst.start,
            endTime: inst.end,
            allDay,
            recurring: isRecurring,
            recurrenceRule,
            lastSynced: new Date(),
          })
          .onConflictDoUpdate({
            target: [events.calendarSourceId, events.externalEventId],
            set: {
              title,
              description,
              location,
              startTime: inst.start,
              endTime: inst.end,
              allDay,
              recurring: isRecurring,
              recurrenceRule,
              lastSynced: new Date(),
              updatedAt: new Date(),
            },
          });

        synced++;
      }
    } catch (error) {
      errors.push(`Failed to sync VEVENT ${uid}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Cleanup: delete Prism events for this source whose external id is no
  // longer present upstream (within the sync window).
  const prismEvents = await db.query.events.findMany({
    where: and(
      eq(events.calendarSourceId, sourceId),
      gte(events.startTime, timeMin),
      lte(events.startTime, timeMax)
    ),
  });
  for (const ev of prismEvents) {
    if (ev.externalEventId && !externalIds.has(ev.externalEventId)) {
      await db.delete(events).where(eq(events.id, ev.id));
    }
  }

  const currentErrors = (source.syncErrors as Record<string, unknown>) || {};
  await db
    .update(calendarSources)
    .set({
      lastSynced: new Date(),
      syncErrors: currentErrors.userOverride ? { userOverride: true } : null,
      updatedAt: new Date(),
    })
    .where(eq(calendarSources.id, sourceId));

  return { synced, errors };
}

/**
 * Sync all enabled iCal calendar sources, isolating per-source errors so one
 * bad feed does not block the rest.
 */
export async function syncAllIcalCalendars(
  options: {
    timeMin?: Date;
    timeMax?: Date;
  } = {}
): Promise<{ total: number; errors: string[] }> {
  const allErrors: string[] = [];
  let total = 0;

  const sources = await db.query.calendarSources.findMany({
    where: and(
      eq(calendarSources.provider, 'ical'),
      eq(calendarSources.enabled, true)
    ),
  });

  for (const source of sources) {
    try {
      const result = await syncIcalCalendarSource(source.id, options);
      total += result.synced;
      allErrors.push(...result.errors);
    } catch (error) {
      const errorMsg = `Failed to sync iCal calendar "${source.dashboardCalendarName}": ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[Sync] ${errorMsg}`);
      allErrors.push(errorMsg);
    }
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

// ─── CalDAV sync ───────────────────────────────────────────────────────────
//
// Read-only sync from any CalDAV server (Apple iCloud, Nextcloud, Radicale,
// Baikal, Synology). Two-way write (createCalendarObject) isn't wired up yet
// — that lives in a follow-up branch. Events from CalDAV land in the same
// `events` table as Google + iCal; VTODO items land in `tasks`.

/**
 * Sync events from a single CalDAV calendar source.
 */
export async function syncCalDAVCalendarSource(
  sourceId: string,
  options: { timeMin?: Date; timeMax?: Date } = {}
): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;

  const source = await db.query.calendarSources.findFirst({
    where: eq(calendarSources.id, sourceId),
  });

  if (!source || source.provider !== 'caldav') {
    return { synced: 0, errors: ['Not a CalDAV source'] };
  }

  if (!source.accessToken) {
    return { synced: 0, errors: ['No credentials available'] };
  }

  let password: string;
  try {
    password = decrypt(source.accessToken);
  } catch {
    return { synced: 0, errors: ['Failed to decrypt credentials — may need to reconnect'] };
  }

  const config = source.providerConfig as CalDAVConnectionConfig | null;
  if (!config?.serverUrl || !config?.username) {
    return { synced: 0, errors: ['Missing CalDAV connection config'] };
  }

  // Skip event sync for sources whose discovery flagged them as VTODO-only.
  // (undefined === legacy row from before flags were stored, so default to
  // running the sync — back-compatible.)
  if (config.supportsEvents === false) {
    return { synced: 0, errors: [] };
  }

  const timeMin = options.timeMin || new Date(Date.now() - DEFAULT_TIME_MIN_MS);
  const timeMax = options.timeMax || new Date(Date.now() + DEFAULT_TIME_MAX_MS);

  try {
    const caldavEvents = await fetchCalDAVEvents(
      config.serverUrl,
      config.username,
      password,
      source.sourceCalendarId,
      timeMin,
      timeMax,
    );

    for (const event of caldavEvents) {
      const existing = await db.query.events.findFirst({
        where: and(
          eq(events.calendarSourceId, sourceId),
          eq(events.externalEventId, event.uid),
        ),
      });

      const eventData = {
        title: event.title,
        description: event.description,
        location: event.location,
        startTime: event.startTime,
        endTime: event.endTime,
        allDay: event.allDay,
        color: event.color || source.color,
        recurring: event.recurring,
        recurrenceRule: event.recurrenceRule,
        calendarSourceId: sourceId,
        externalEventId: event.uid,
        updatedAt: new Date(),
      };

      if (existing) {
        await db.update(events).set(eventData).where(eq(events.id, existing.id));
      } else {
        await db.insert(events).values(eventData);
      }

      synced++;
    }

    // Drop events that no longer exist upstream (within the sync window only —
    // matches the behavior of the Google + iCal paths in this file).
    const upstreamUids = new Set(caldavEvents.map((e) => e.uid));
    const localEvents = await db.query.events.findMany({
      where: and(
        eq(events.calendarSourceId, sourceId),
        gte(events.startTime, timeMin),
        lte(events.startTime, timeMax),
      ),
    });

    for (const local of localEvents) {
      if (local.externalEventId && !upstreamUids.has(local.externalEventId)) {
        await db.delete(events).where(eq(events.id, local.id));
      }
    }

    await db
      .update(calendarSources)
      .set({ lastSynced: new Date(), syncErrors: config })
      .where(eq(calendarSources.id, sourceId));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors.push(`CalDAV sync failed: ${msg}`);

    await db
      .update(calendarSources)
      .set({
        syncErrors: { ...config, lastError: msg, lastErrorAt: new Date().toISOString() },
      })
      .where(eq(calendarSources.id, sourceId));
  }

  return { synced, errors };
}

/**
 * Sync tasks (VTODO) from a CalDAV calendar source into Prism tasks.
 */
export async function syncCalDAVTasks(
  sourceId: string,
): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;

  const source = await db.query.calendarSources.findFirst({
    where: eq(calendarSources.id, sourceId),
  });

  if (!source || source.provider !== 'caldav') {
    return { synced: 0, errors: ['Not a CalDAV source'] };
  }
  if (!source.accessToken) {
    return { synced: 0, errors: ['No credentials available'] };
  }

  let password: string;
  try {
    password = decrypt(source.accessToken);
  } catch {
    return { synced: 0, errors: ['Failed to decrypt credentials'] };
  }

  const config = source.providerConfig as CalDAVConnectionConfig | null;
  if (!config?.serverUrl || !config?.username) {
    return { synced: 0, errors: ['Missing CalDAV connection config'] };
  }

  // Skip task sync for sources whose discovery flagged them as VEVENT-only.
  if (config.supportsTasks === false) {
    return { synced: 0, errors: [] };
  }

  try {
    const caldavTasks = await fetchCalDAVTasks(
      config.serverUrl,
      config.username,
      password,
      source.sourceCalendarId,
    );

    // Apple iCloud injects metadata VTODOs into reminder lists whose data
    // has migrated to the CloudKit-only Reminders system. Those don't
    // represent real tasks — they're nag messages telling the user where
    // their data went. Skip them so Prism doesn't show them as real tasks.
    const APPLE_PLACEHOLDER_TITLES = new Set([
      'Where are my reminders?',
      'The creator of this list has upgraded these reminders.',
    ]);

    const realTasks = caldavTasks.filter(
      t => !APPLE_PLACEHOLDER_TITLES.has(t.title.trim())
    );

    // Lazy task-list creation: if a CalDAV source returns only Apple's
    // placeholder VTODOs (the common case for modern iCloud Reminders, whose
    // real data lives in CloudKit and isn't reachable over CalDAV), don't
    // pollute Settings with an empty task_list that the user can't populate.
    // Only materialize a Prism task_list once we actually have real content
    // to put in it, or once we already created one on a prior sync.
    let taskListId: string | null = config.taskListId ?? null;
    if (!taskListId && realTasks.length > 0) {
      const existingTaskForSource = await db.query.tasks.findFirst({
        where: sql`${tasks.externalId} LIKE ${`caldav:${source.id}:%`}`,
        columns: { listId: true },
      });
      taskListId = existingTaskForSource?.listId ?? null;
    }
    if (!taskListId && realTasks.length > 0) {
      const [newList] = await db
        .insert(taskLists)
        .values({
          name: source.displayName || 'CalDAV Reminders',
          color: source.color || '#6366f1',
        })
        .returning();
      if (newList) {
        taskListId = newList.id;
        await db.update(calendarSources)
          .set({ providerConfig: { ...config, taskListId: newList.id } })
          .where(eq(calendarSources.id, source.id));
      }
    }

    if (taskListId) {
      await db.update(tasks)
        .set({ listId: taskListId })
        .where(and(
          sql`${tasks.externalId} LIKE ${`caldav:${source.id}:%`}`,
          sql`${tasks.listId} IS NULL`,
        ));
    }

    const seenExternalIds = new Set<string>();

    for (const task of realTasks) {
      const externalId = `caldav:${source.id}:${task.uid}`;
      seenExternalIds.add(externalId);

      const existing = await db.query.tasks.findFirst({
        where: eq(tasks.externalId, externalId),
      });

      const taskData = {
        title: task.title,
        description: task.description,
        dueDate: task.dueDate || null,
        completed: task.completed,
        completedAt: task.completedAt,
        priority: (task.priority || 'medium') as 'high' | 'medium' | 'low',
        category: task.categories[0] || null,
        listId: taskListId,
        externalId,
        externalUpdatedAt: new Date(),
        lastSynced: new Date(),
        updatedAt: new Date(),
      };

      if (existing) {
        await db.update(tasks).set(taskData).where(eq(tasks.id, existing.id));
      } else {
        await db.insert(tasks).values(taskData);
      }

      synced++;
    }

    // Mirror upstream deletions: any caldav-prefixed task for this source
    // that wasn't in the fetch round-trips out of Prism too. Also catches
    // existing placeholder rows that pre-date the title filter above.
    const allLocal = await db.query.tasks.findMany({
      where: sql`${tasks.externalId} LIKE ${`caldav:${source.id}:%`}`,
      columns: { id: true, externalId: true },
    });
    const stale = allLocal.filter(t => t.externalId && !seenExternalIds.has(t.externalId));
    if (stale.length > 0) {
      await db.delete(tasks).where(inArray(tasks.id, stale.map(t => t.id)));
    }

    // Refresh the source's health signal on success. For task-only sources
    // (supportsEvents === false) the event path never runs, so this is the ONLY
    // thing that advances last_synced and clears a stale error — without it they
    // look perpetually stuck even while syncing cleanly every cycle. For
    // event-capable sources the event path owns syncErrors, so only bump the
    // timestamp there to avoid clobbering a real event-sync error.
    const taskOnly = config.supportsEvents === false;
    await db.update(calendarSources)
      .set({ lastSynced: new Date(), ...(taskOnly ? { syncErrors: {} } : {}) })
      .where(eq(calendarSources.id, source.id));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors.push(`CalDAV task sync failed: ${msg}`);
    // Surface task-sync failures on the source itself for task-only sources
    // (event-capable sources have syncErrors managed by the event path).
    if (config.supportsEvents === false) {
      await db.update(calendarSources)
        .set({ syncErrors: { lastError: msg, lastErrorAt: new Date().toISOString() } })
        .where(eq(calendarSources.id, source.id));
    }
  }

  return { synced, errors };
}

/**
 * Sync all enabled CalDAV calendar sources (events + tasks).
 */
export async function syncAllCalDAVCalendars(
  options: { timeMin?: Date; timeMax?: Date } = {}
): Promise<{ total: number; errors: string[] }> {
  const allErrors: string[] = [];
  let total = 0;

  const sources = await db.query.calendarSources.findMany({
    where: and(
      eq(calendarSources.provider, 'caldav'),
      eq(calendarSources.enabled, true),
    ),
  });

  for (const source of sources) {
    const eventResult = await syncCalDAVCalendarSource(source.id, options);
    total += eventResult.synced;
    allErrors.push(...eventResult.errors);

    const taskResult = await syncCalDAVTasks(source.id);
    total += taskResult.synced;
    allErrors.push(...taskResult.errors);
  }

  return { total, errors: allErrors };
}

/**
 * Two-way write helpers — push event mutations from Prism back to the
 * remote CalDAV calendar. Each function loads the source's credentials
 * (provider_config + accessToken), decrypts the password, and delegates
 * to the low-level write functions in @/lib/integrations/caldav.
 *
 * These functions do NOT touch the local `events` table — the calling
 * route is responsible for mirroring the change locally so the user
 * sees their edit immediately. This split keeps the local + remote
 * writes from drifting on partial failures (e.g. CalDAV server times
 * out after we already wrote locally).
 */

async function loadCalDAVAuth(sourceId: string): Promise<{
  serverUrl: string;
  username: string;
  password: string;
  sourceCalendarId: string;
} | { error: string }> {
  const source = await db.query.calendarSources.findFirst({
    where: eq(calendarSources.id, sourceId),
  });
  if (!source || source.provider !== 'caldav') {
    return { error: 'Not a CalDAV source' };
  }
  if (!source.accessToken) return { error: 'No credentials available' };
  const config = source.providerConfig as CalDAVConnectionConfig | null;
  if (!config?.serverUrl || !config?.username) {
    return { error: 'Missing CalDAV connection config' };
  }
  let password: string;
  try {
    password = decrypt(source.accessToken);
  } catch {
    return { error: 'Failed to decrypt credentials' };
  }
  return {
    serverUrl: config.serverUrl,
    username: config.username,
    password,
    sourceCalendarId: source.sourceCalendarId,
  };
}

export async function pushCalDAVEventCreate(
  sourceId: string,
  ev: { uid: string; title: string; description?: string | null; location?: string | null; startTime: Date; endTime: Date; allDay?: boolean },
): Promise<{ ok: true; href: string } | { ok: false; error: string }> {
  const auth = await loadCalDAVAuth(sourceId);
  if ('error' in auth) return { ok: false, error: auth.error };
  try {
    const { createCalDAVEvent } = await import('@/lib/integrations/caldav');
    const { href } = await createCalDAVEvent(auth.serverUrl, auth.username, auth.password, auth.sourceCalendarId, ev);
    return { ok: true, href };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function pushCalDAVEventUpdate(
  sourceId: string,
  calendarObjectHref: string,
  etag: string | undefined,
  ev: { uid: string; title: string; description?: string | null; location?: string | null; startTime: Date; endTime: Date; allDay?: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await loadCalDAVAuth(sourceId);
  if ('error' in auth) return { ok: false, error: auth.error };
  try {
    const { updateCalDAVEvent } = await import('@/lib/integrations/caldav');
    await updateCalDAVEvent(auth.serverUrl, auth.username, auth.password, calendarObjectHref, etag, ev);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function pushCalDAVEventDelete(
  sourceId: string,
  calendarObjectHref: string,
  etag?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await loadCalDAVAuth(sourceId);
  if ('error' in auth) return { ok: false, error: auth.error };
  try {
    const { deleteCalDAVEvent } = await import('@/lib/integrations/caldav');
    await deleteCalDAVEvent(auth.serverUrl, auth.username, auth.password, calendarObjectHref, etag);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
