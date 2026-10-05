/**
 * CalDAV calendar integration for Prism.
 *
 * Supports Nextcloud, Radicale, Baikal, Synology, and any standard CalDAV server.
 * Uses tsdav for protocol handling and ical.js for event parsing.
 */

import { createDAVClient, type DAVCalendar, type DAVObject } from 'tsdav';
import ICAL from 'ical.js';
import { validatePublicUrl, UnsafeUrlError } from '@/lib/utils/safeFetch';
import { dueFromInstant, wallDue, type TaskDue } from '@/lib/utils/taskDue';
import { isValidTimezone } from '@/lib/utils/timezone';
import { todayKey, wallTimeAt, zonedWallTimeToUtc } from '@/lib/utils/zonedDate';

/**
 * Guard a user-supplied CalDAV server URL before handing it to tsdav.
 *
 * Every exported entry point below forwards `serverUrl` straight into tsdav,
 * which performs the outbound request — so without this an authenticated
 * parent could paste a loopback / RFC1918 / 169.254.169.254 address into the
 * server-URL field and use Prism to probe the internal network (the /test
 * endpoint's distinct connect-vs-401 errors make it a clean existence oracle).
 *
 * tsdav owns the fetch and follows HTTP redirects internally, so — like the
 * caveat documented in safeFetch.ts — this validates only the initial host
 * literal, not redirect targets or the DNS-resolved IP. That still closes the
 * primary vector. Throws UnsafeUrlError on a private / non-http(s) target.
 */
function assertSafeCalDAVUrl(serverUrl: string): void {
  validatePublicUrl(serverUrl);
}

export interface CalDAVCalendar {
  href: string;
  displayName: string;
  color: string | null;
  description: string | null;
  ctag: string | null;
  supportsEvents: boolean;
  supportsTasks: boolean;
}

export interface CalDAVEvent {
  uid: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  color: string | null;
  recurring: boolean;
  recurrenceRule: string | null;
  /** href (path) of the CalDAV object this event was parsed from, plus its
   *  ETag. Needed to propagate a delete/update back to the server, which
   *  addresses objects by href, not UID. Recurring instances share the parent
   *  object's href — write-back is single-event-only, so that's acceptable. */
  href: string | null;
  etag: string | null;
  /** A recurring instance's id as older builds keyed it, when it differs
   *  from `uid`: the sync renames a row stored under it rather than deleting
   *  and recreating it. */
  legacyUid?: string;
  /** The master VEVENT's UID for every occurrence of a recurring series,
   *  edited ones included; null for a single event. Lets Prism hide a whole
   *  series (#592). */
  seriesKey: string | null;
}

export interface CalDAVTask {
  uid: string;
  title: string;
  description: string | null;
  /** YYYY-MM-DD */
  dueDate: string | null;
  /** HH:mm in the household zone, or null for a date-only DUE. */
  dueTime: string | null;
  completed: boolean;
  completedAt: Date | null;
  priority: 'high' | 'medium' | 'low' | null;
  categories: string[];
}

export interface CalDAVConnectionConfig {
  serverUrl: string;
  username: string;
  authMethod: 'basic';
  /** True when the source calendar advertises VEVENT support. Persisted at
   *  connect time so sync + UI can route this source correctly (a Reminders
   *  list won't appear in the Calendar UI, an event-only calendar won't
   *  spawn a task list). Undefined on legacy rows from before this field
   *  was stored — treat as "true" for backward compatibility. */
  supportsEvents?: boolean;
  /** True when the source calendar advertises VTODO support. */
  supportsTasks?: boolean;
  /** Durable mapping from this CalDAV source to a Prism task_lists row.
   *  Written on first task-list creation so subsequent syncs reuse the
   *  same list instead of creating orphans every tick. */
  taskListId?: string;
}

/**
 * Test connectivity to a CalDAV server.
 */
export async function testCalDAVConnection(
  serverUrl: string,
  username: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Reject private/loopback/metadata targets *before* the fetch so this
    // endpoint can't be used as an internal-host existence oracle (the
    // rejection is identical whether or not the internal host exists).
    assertSafeCalDAVUrl(serverUrl);

    const client = await createDAVClient({
      serverUrl,
      credentials: { username, password },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
    });

    // Try to fetch calendars — if this works, the connection is good
    await client.fetchCalendars();

    return { success: true };
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      return { success: false, error: 'Server URL is not allowed (points at a private or local address).' };
    }
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('401') || msg.includes('Unauthorized')) {
      return { success: false, error: 'Authentication failed. Check username and password.' };
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
      return { success: false, error: 'Could not connect to server. Check the URL.' };
    }
    return { success: false, error: `Connection failed: ${msg}` };
  }
}

/**
 * Discover available calendars on a CalDAV server.
 */
export async function discoverCalendars(
  serverUrl: string,
  username: string,
  password: string,
): Promise<CalDAVCalendar[]> {
  assertSafeCalDAVUrl(serverUrl);

  const client = await createDAVClient({
    serverUrl,
    credentials: { username, password },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });

  const calendars = await client.fetchCalendars();

  return calendars
    .filter((cal: DAVCalendar) => {
      // Include calendars that support VEVENT or VTODO
      const components = cal.components as string[] | undefined;
      if (components && !components.includes('VEVENT') && !components.includes('VTODO')) return false;
      return true;
    })
    .map((cal: DAVCalendar) => {
      const components = cal.components as string[] | undefined;
      return {
        href: cal.url,
        displayName: String(cal.displayName || 'Unnamed Calendar'),
        color: normalizeCalDAVColor((cal as Record<string, unknown>).calendarColor),
        description: cal.description ? String(cal.description) : null,
        ctag: (cal as Record<string, unknown>).ctag ? String((cal as Record<string, unknown>).ctag) : null,
        supportsEvents: !components || components.includes('VEVENT'),
        supportsTasks: !!components && components.includes('VTODO'),
      };
    });
}

/**
 * Coerce a CalDAV-reported color string to the #RRGGBB form our schema
 * stores (varchar(7)). Apple iCloud returns colors as `#RRGGBBAA` with an
 * alpha channel appended — that's 9 chars and overflows the column. Strip
 * the alpha when present, accept #RRGGBB and #RGB as-is, drop anything
 * that doesn't parse so callers can fall back to their default color.
 */
function normalizeCalDAVColor(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (/^#[0-9a-fA-F]{8}$/.test(s)) return s.slice(0, 7); // #RRGGBBAA → #RRGGBB
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return s;
  return null;
}

/**
 * Fetch events from a CalDAV calendar within a time range.
 */
export async function fetchCalDAVEvents(
  serverUrl: string,
  username: string,
  password: string,
  calendarHref: string,
  timeMin: Date,
  timeMax: Date,
  timeZone: string,
): Promise<CalDAVEvent[]> {
  assertSafeCalDAVUrl(serverUrl);

  const client = await createDAVClient({
    serverUrl,
    credentials: { username, password },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });

  const calendars = await client.fetchCalendars();
  const calendar = calendars.find((c: DAVCalendar) => c.url === calendarHref);

  if (!calendar) {
    throw new Error(`Calendar not found: ${calendarHref}`);
  }

  // tsdav's timeRange expects standard ISO8601 (with hyphens + colons);
  // formatICalDate strips those for basic-format iCal DTSTART use only,
  // so pass toISOString() directly here.
  const objects = await client.fetchCalendarObjects({
    calendar,
    timeRange: {
      start: timeMin.toISOString(),
      end: timeMax.toISOString(),
    },
  });

  const events: CalDAVEvent[] = [];

  for (const obj of objects) {
    try {
      const parsed = parseICalObject(obj, timeMin, timeMax, timeZone);
      events.push(...parsed);
    } catch (error) {
      console.error('Failed to parse CalDAV event:', error instanceof Error ? error.message : error);
    }
  }

  return events;
}

/** Most instances one recurring event contributes to a sync range. */
const MAX_INSTANCES_IN_RANGE = 5_000;
/** Most iterator steps spent on one recurring event, in or out of range. */
const MAX_EXPANSION_STEPS = 10_000;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Where to start expanding a recurring event, or undefined for its DTSTART.
 *
 * Iterating from DTSTART costs one step per instance since the series began,
 * so a daily series from decades ago is slow to reach the range. A DAILY or
 * WEEKLY rule repeats with a fixed period in wall-clock days, so moving the
 * start forward by whole periods (keeping its wall time, so DST does not
 * shift it) yields the same instances. The moved start is kept at least one
 * period plus the event's length before the range, so an instance that ends
 * inside the range is not skipped, and the moved start itself, which the
 * iterator always returns first, falls before the range and is dropped.
 *
 * Not applied to a COUNT rule (instances are counted from DTSTART), to RDATE
 * or several RRULEs, or to other frequencies, which are cheap to walk.
 */
function recurrenceAnchor(
  event: ICAL.Event,
  vevent: ICAL.Component,
  allDay: boolean,
  rangeStart: Date,
  timeZone: string,
): ICAL.Time | undefined {
  const rules = vevent.getAllProperties('rrule');
  if (rules.length !== 1 || vevent.hasProperty('rdate')) return undefined;
  const rule = rules[0]!.getFirstValue() as ICAL.Recur;
  if (rule.count) return undefined;
  if (rule.freq !== 'DAILY' && rule.freq !== 'WEEKLY') return undefined;

  const periodDays = (rule.interval || 1) * (rule.freq === 'WEEKLY' ? 7 : 1);
  const startMs = icalTimeToDate(event.startDate, allDay, timeZone).getTime();
  const lengthMs = Math.max(0, icalTimeToDate(event.endDate, allDay, timeZone).getTime() - startMs);
  // Two spare days cover DST and zone offsets between wall and UTC days.
  const latest = rangeStart.getTime() - lengthMs - (periodDays + 2) * DAY_MS;
  const periods = Math.floor((latest - startMs) / (periodDays * DAY_MS));
  if (periods <= 0) return undefined;

  const anchor = event.startDate.clone();
  anchor.adjust(periods * periodDays, 0, 0, 0);
  return anchor;
}

/**
 * Parse a single iCalendar object into one or more events.
 * Handles recurring events by expanding instances within the time range.
 */
function parseICalObject(
  obj: DAVObject,
  rangeStart: Date,
  rangeEnd: Date,
  timeZone: string,
): CalDAVEvent[] {
  const data = obj.data;
  if (!data) return [];

  const jcal = ICAL.parse(data);
  const comp = new ICAL.Component(jcal);
  const vevents = comp.getAllSubcomponents('vevent');
  const events: CalDAVEvent[] = [];

  // Object identity on the server: the href addresses the .ics resource and
  // the ETag guards a conflict-safe delete/update. Both come from the DAV
  // object, not the iCal body.
  const href = obj.url || null;
  const etag = obj.etag || null;

  // An edited occurrence of a recurring event is its own VEVENT with the
  // master's UID and a RECURRENCE-ID naming the slot it replaces (#593).
  // Relate each to its master so the master's expansion yields the edited
  // details in that slot, instead of the original slot plus a second copy.
  const parsed = vevents.map((vevent) => ({ vevent, event: new ICAL.Event(vevent) }));
  const masters = new Map<string, ICAL.Event>();
  for (const { vevent, event } of parsed) {
    if (!event.isRecurrenceException() && vevent.getFirstPropertyValue('rrule')) masters.set(event.uid, event);
  }
  const related = new Set<ICAL.Event>();
  for (const { event } of parsed) {
    const master = event.isRecurrenceException() ? masters.get(event.uid) : undefined;
    if (master) {
      master.relateException(event);
      related.add(event);
    }
  }

  for (const { vevent, event } of parsed) {
    // Expanded through its master below.
    if (related.has(event)) continue;

    if (event.isRecurrenceException()) {
      // An edited occurrence whose master is not in this object (a server
      // may send it alone). Still keyed on the slot it replaces.
      if (!event.summary || isCancelled(event)) continue;
      const allDay = isAllDay(vevent);
      events.push({
        ...makeEvent(event, vevent, href, etag, timeZone),
        uid: `${event.uid}_${icalTimeToDate(event.recurrenceId, allDay, timeZone).toISOString()}`,
        legacyUid: event.uid,
        recurring: true,
        seriesKey: event.uid,
      });
      continue;
    }

    if (!event.summary) continue;

    if (vevent.getFirstPropertyValue('rrule')) {
      // Expand recurring event instances within the range
      try {
        const allDay = isAllDay(vevent);
        const iterator = event.iterator(
          recurrenceAnchor(event, vevent, allDay, rangeStart, timeZone),
        );
        let next = iterator.next();
        let steps = 0;
        let inRange = 0;

        // Instances before the range are skipped without counting toward
        // the in-range cap, so a series that began long ago still yields
        // its current occurrences.
        while (next) {
          if (++steps > MAX_EXPANSION_STEPS || inRange >= MAX_INSTANCES_IN_RANGE) {
            console.warn(`CalDAV: stopped expanding a recurring event after ${steps - 1} instances`);
            break;
          }
          // For an edited slot, `item` is the edited VEVENT and the dates are
          // its moved ones; the slot itself is `next`, the RECURRENCE-ID.
          const occurrence = event.getOccurrenceDetails(next);
          const slot = icalTimeToDate(next, allDay, timeZone);
          const start = icalTimeToDate(occurrence.startDate, allDay, timeZone);
          const end = icalTimeToDate(occurrence.endDate, allDay, timeZone);
          const item = occurrence.item;
          const edited = item !== event;

          // Slots come in order; an edited one may have moved, so stop on
          // the slot, and include on where the occurrence actually lands.
          if (slot > rangeEnd) break;
          if (end >= rangeStart && start <= rangeEnd && !(edited && isCancelled(item))) {
            inRange++;
            // Keyed on the slot's stored start, which does not depend on the
            // server's zone and stays put when the occurrence is edited, so
            // an edit replaces its slot. Older builds keyed on the parser's
            // instant (server-local midnight for an all-day date), and stored
            // an edited occurrence under the bare UID, so a row may still
            // carry one of those.
            const uid = `${event.uid}_${slot.toISOString()}`;
            const legacyUid = edited ? event.uid : `${event.uid}_${next.toJSDate().toISOString()}`;
            events.push({
              uid,
              ...(legacyUid !== uid ? { legacyUid } : {}),
              title: item.summary || event.summary,
              description: item.description || null,
              location: item.location || null,
              startTime: start,
              endTime: end,
              allDay,
              color: null,
              recurring: true,
              recurrenceRule: vevent.getFirstPropertyValue('rrule')?.toString() || null,
              href,
              etag,
              seriesKey: event.uid,
            });
          }

          next = iterator.next();
        }
      } catch {
        // If recurrence expansion fails, add the base event
        events.push({ ...makeEvent(event, vevent, href, etag, timeZone), seriesKey: event.uid });
      }
    } else {
      events.push(makeEvent(event, vevent, href, etag, timeZone));
    }
  }

  return events;
}

/**
 * A VEVENT DTSTART/DTEND as the Date Prism stores.
 *
 * An all-day date is UTC midnight of that date ("floating"), built from its
 * fields rather than through toJSDate, which would make it midnight in the
 * server's zone. A time in UTC or in a zone the object defines is that
 * instant. A floating time (no TZID, no Z) is a wall time, read in the
 * household zone, as is a TZID naming an IANA zone the object carries no
 * VTIMEZONE for: toJSDate would read both in the server's zone.
 */
export function icalTimeToDate(time: ICAL.Time, allDay: boolean, timeZone: string): Date {
  if (allDay || time.isDate) return new Date(Date.UTC(time.year, time.month - 1, time.day));
  if (time.zone === ICAL.Timezone.utcTimezone) return time.toJSDate();

  const dateKey = `${String(time.year).padStart(4, '0')}-${pad2(time.month)}-${pad2(time.day)}`;
  const wall = (zone: string) =>
    new Date(zonedWallTimeToUtc(dateKey, `${pad2(time.hour)}:${pad2(time.minute)}`, zone).getTime()
      + time.second * 1000);

  // An unregistered TZID leaves the zone floating and the name in `timezone`,
  // which the typings omit.
  const tzid = (time as ICAL.Time & { timezone?: string }).timezone;
  if (tzid && isValidTimezone(tzid) && (!time.zone || time.zone === ICAL.Timezone.localTimezone)) {
    return wall(tzid);
  }
  if (time.zone && time.zone !== ICAL.Timezone.localTimezone) return time.toJSDate();
  return wall(timeZone);
}

function makeEvent(
  event: ICAL.Event,
  vevent: ICAL.Component,
  href: string | null,
  etag: string | null,
  timeZone: string,
): CalDAVEvent {
  const allDay = isAllDay(vevent);
  return {
    uid: event.uid,
    title: event.summary,
    description: event.description || null,
    location: event.location || null,
    startTime: icalTimeToDate(event.startDate, allDay, timeZone),
    endTime: icalTimeToDate(event.endDate, allDay, timeZone),
    allDay,
    color: null,
    recurring: false,
    recurrenceRule: null,
    href,
    etag,
    seriesKey: null,
  };
}

/** STATUS:CANCELLED on an edited occurrence removes that one slot. */
function isCancelled(event: ICAL.Event): boolean {
  const status = event.component.getFirstPropertyValue('status');
  return typeof status === 'string' && status.toUpperCase() === 'CANCELLED';
}

/**
 * Fetch tasks (VTODO) from a CalDAV calendar.
 */
export async function fetchCalDAVTasks(
  serverUrl: string,
  username: string,
  password: string,
  calendarHref: string,
  timeZone: string,
): Promise<CalDAVTask[]> {
  assertSafeCalDAVUrl(serverUrl);

  const client = await createDAVClient({
    serverUrl,
    credentials: { username, password },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });

  const calendars = await client.fetchCalendars();
  const calendar = calendars.find((c: DAVCalendar) => c.url === calendarHref);

  if (!calendar) {
    throw new Error(`Calendar not found: ${calendarHref}`);
  }

  // Fetch all objects (tsdav doesn't filter by component type in time range for VTODOs).
  // Apple iCloud requires an explicit VTODO comp-filter to return reminders —
  // without it the response is empty even for Reminders-list calendars.
  const objects = await client.fetchCalendarObjects({
    calendar,
    filters: [{
      'comp-filter': {
        _attributes: { name: 'VCALENDAR' },
        'comp-filter': {
          _attributes: { name: 'VTODO' },
        },
      },
    }],
  });

  console.log(`[caldav-tasks] ${calendarHref}: fetched ${objects.length} object(s)`);

  const tasks: CalDAVTask[] = [];
  let parsedCount = 0;

  for (const obj of objects) {
    try {
      const parsed = parseVTodoObject(obj, timeZone);
      if (parsed) {
        tasks.push(parsed);
        parsedCount++;
      }
    } catch (error) {
      console.error('Failed to parse CalDAV task:', error instanceof Error ? error.message : error);
    }
  }

  console.log(`[caldav-tasks] ${calendarHref}: parsed ${parsedCount} VTODO(s) into tasks`);

  return tasks;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * A VTODO's DUE as a task due in the household zone.
 *
 * DUE;VALUE=DATE is a date and stays one (toJSDate would make it midnight in
 * the server's zone, a day early for a household west of it). A timed DUE in
 * UTC or a known zone is converted to the household's wall clock; a floating
 * one is a wall time already and is kept as written.
 */
export function vtodoDue(due: unknown, timeZone: string): TaskDue {
  if (!due) return { dueDate: null, dueTime: null };
  if (!(due instanceof ICAL.Time)) {
    const instant = new Date(String(due));
    return Number.isNaN(instant.getTime())
      ? { dueDate: null, dueTime: null }
      : dueFromInstant(instant, timeZone);
  }

  const dateKey = `${String(due.year).padStart(4, '0')}-${pad2(due.month)}-${pad2(due.day)}`;
  if (due.isDate) return { dueDate: dateKey, dueTime: null };

  const hhmm = `${pad2(due.hour)}:${pad2(due.minute)}`;
  const inHousehold = (instant: Date) =>
    wallDue(todayKey(timeZone, instant), wallTimeAt(timeZone, instant));

  if (due.zone === ICAL.Timezone.utcTimezone) {
    return inHousehold(new Date(Date.UTC(due.year, due.month - 1, due.day, due.hour, due.minute)));
  }
  // An unregistered TZID leaves the zone floating and the name in `timezone`,
  // which the typings omit.
  const tzid = (due as ICAL.Time & { timezone?: string }).timezone || due.zone?.tzid;
  if (tzid && isValidTimezone(tzid)) {
    return inHousehold(zonedWallTimeToUtc(dateKey, hhmm, tzid));
  }
  if (due.zone && due.zone !== ICAL.Timezone.localTimezone) {
    // A VTIMEZONE in the object under a non-IANA name ("Central Standard Time").
    return inHousehold(due.toJSDate());
  }
  return wallDue(dateKey, hhmm);
}

/**
 * Parse a VTODO iCalendar object into a task.
 */
function parseVTodoObject(obj: DAVObject, timeZone: string): CalDAVTask | null {
  const data = obj.data;
  if (!data) return null;

  const jcal = ICAL.parse(data);
  const comp = new ICAL.Component(jcal);
  const vtodo = comp.getFirstSubcomponent('vtodo');

  if (!vtodo) return null;

  const summary = vtodo.getFirstPropertyValue('summary');
  if (!summary) return null;

  const description = vtodo.getFirstPropertyValue('description');
  const due = vtodo.getFirstPropertyValue('due');
  const completed = vtodo.getFirstPropertyValue('completed');
  const status = vtodo.getFirstPropertyValue('status');
  const priority = vtodo.getFirstPropertyValue('priority');
  const categories = vtodo.getFirstPropertyValue('categories');
  const uid = vtodo.getFirstPropertyValue('uid');

  // Map iCal priority (1-9) to Prism priority
  let prismPriority: 'high' | 'medium' | 'low' | null = null;
  if (priority) {
    const p = Number(priority);
    if (p >= 1 && p <= 3) prismPriority = 'high';
    else if (p >= 4 && p <= 6) prismPriority = 'medium';
    else if (p >= 7 && p <= 9) prismPriority = 'low';
  }

  return {
    uid: String(uid || `vtodo-${Date.now()}`),
    title: String(summary),
    description: description ? String(description) : null,
    ...vtodoDue(due, timeZone),
    completed: status === 'COMPLETED' || !!completed,
    completedAt: completed ? (completed instanceof ICAL.Time ? completed.toJSDate() : new Date(String(completed))) : null,
    priority: prismPriority,
    categories: categories ? (Array.isArray(categories) ? categories.map(String) : [String(categories)]) : [],
  };
}

function isAllDay(vevent: ICAL.Component): boolean {
  const dtstart = vevent.getFirstProperty('dtstart');
  if (!dtstart) return false;
  // ical.js consumes VALUE=DATE into the property type; it is never left as a
  // parameter, so getParameter('value') is always undefined here.
  return dtstart.type === 'date';
}

function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Two-way write: create / update / delete events back to the CalDAV
 * server. Wraps tsdav's createCalendarObject / updateCalendarObject /
 * deleteCalendarObject. iCal serialization uses ical.js so we share
 * the same parser/serializer the read path already pulls in.
 *
 * NOTE on scope: only single (non-recurring) VEVENTs are supported here.
 * Recurrence + exceptions are intentionally deferred — they need
 * EXDATE / RRULE-edits / split-occurrence semantics that don't fit a
 * naive iCal roundtrip and would need a proper RRULE-aware UI on the
 * Prism side first (issue #59).
 */

export interface CalDAVEventWrite {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startTime: Date;
  endTime: Date;
  allDay?: boolean;
}

/**
 * Strip bare carriage returns from a value bound for an iCalendar property.
 *
 * ical.js escapes `\n`, `;`, `,` and `\\`, but passes a lone `\r` through
 * unchanged. A strict RFC 5545 parser only splits on CRLF and is unaffected,
 * but a lenient server or a client that normalises line endings turns that CR
 * into a line break, and the rest of the value becomes a forged content line:
 * an ATTENDEE, an ORGANIZER, a URL. Descriptions come from whoever wrote the
 * event, so the value is untrusted by the time it reaches here.
 */
function icalSafe(value: string): string {
  return value.replace(/\r/g, '');
}

/** Serialize a single VEVENT into a complete VCALENDAR string. */
function buildVEventICalString(ev: CalDAVEventWrite): string {
  const vcalendar = new ICAL.Component(['vcalendar', [], []]);
  vcalendar.updatePropertyWithValue('prodid', '-//Prism//CalDAV write//EN');
  vcalendar.updatePropertyWithValue('version', '2.0');

  const vevent = new ICAL.Component('vevent');
  vevent.updatePropertyWithValue('uid', icalSafe(ev.uid));
  vevent.updatePropertyWithValue('summary', icalSafe(ev.title));
  if (ev.description) vevent.updatePropertyWithValue('description', icalSafe(ev.description));
  if (ev.location) vevent.updatePropertyWithValue('location', icalSafe(ev.location));

  const dtstamp = ICAL.Time.now();
  dtstamp.zone = ICAL.Timezone.utcTimezone;
  vevent.updatePropertyWithValue('dtstamp', dtstamp);

  // All-day dates are floating UTC midnights (see localDateToFloatingAllDay),
  // so read their UTC fields; local fields would write the previous day west
  // of UTC.
  const start = ICAL.Time.fromJSDate(ev.startTime, true);
  const end = ICAL.Time.fromJSDate(ev.endTime, true);
  if (ev.allDay) {
    start.isDate = true;
    end.isDate = true;
  }
  vevent.updatePropertyWithValue('dtstart', start);
  vevent.updatePropertyWithValue('dtend', end);

  vcalendar.addSubcomponent(vevent);
  return vcalendar.toString();
}

/**
 * Push a new VEVENT to the given CalDAV calendar. Returns the href the
 * server assigned so callers can store it for later update / delete.
 */
export async function createCalDAVEvent(
  serverUrl: string,
  username: string,
  password: string,
  calendarHref: string,
  ev: CalDAVEventWrite,
): Promise<{ href: string }> {
  assertSafeCalDAVUrl(serverUrl);

  const client = await createDAVClient({
    serverUrl,
    credentials: { username, password },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });

  const calendars = await client.fetchCalendars();
  const calendar = calendars.find((c: DAVCalendar) => c.url === calendarHref);
  if (!calendar) throw new Error(`Calendar not found: ${calendarHref}`);

  const iCalString = buildVEventICalString(ev);
  const filename = `${ev.uid}.ics`;
  const response = await client.createCalendarObject({ calendar, iCalString, filename });

  if (!response.ok) {
    throw new Error(`CalDAV create failed: ${response.status} ${response.statusText}`);
  }

  // tsdav returns the raw fetch Response; the Location header carries the
  // server-assigned href. Fall back to the constructed href if absent.
  const loc = response.headers.get('Location') || response.headers.get('location');
  const href = loc || new URL(filename, calendarHref).toString();
  return { href };
}

/**
 * Replace the VEVENT body for an existing CalDAV calendar object. The
 * server identifies the target by its href (path on the calendar).
 */
export async function updateCalDAVEvent(
  serverUrl: string,
  username: string,
  password: string,
  calendarObjectHref: string,
  etag: string | undefined,
  ev: CalDAVEventWrite,
): Promise<void> {
  assertSafeCalDAVUrl(serverUrl);

  const client = await createDAVClient({
    serverUrl,
    credentials: { username, password },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });

  const iCalString = buildVEventICalString(ev);
  const response = await client.updateCalendarObject({
    calendarObject: {
      url: calendarObjectHref,
      etag: etag ?? '',
      data: iCalString,
    },
  });
  if (!response.ok) {
    throw new Error(`CalDAV update failed: ${response.status} ${response.statusText}`);
  }
}

/**
 * Delete a CalDAV calendar object by href. ETag is optional but lets the
 * server reject the delete if the object changed since the caller read it.
 */
export async function deleteCalDAVEvent(
  serverUrl: string,
  username: string,
  password: string,
  calendarObjectHref: string,
  etag?: string,
): Promise<void> {
  assertSafeCalDAVUrl(serverUrl);

  const client = await createDAVClient({
    serverUrl,
    credentials: { username, password },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });

  const response = await client.deleteCalendarObject({
    calendarObject: {
      url: calendarObjectHref,
      etag: etag ?? '',
      data: '',
    },
  });
  if (!response.ok) {
    throw new Error(`CalDAV delete failed: ${response.status} ${response.statusText}`);
  }
}
