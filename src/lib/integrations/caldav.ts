/**
 * CalDAV calendar integration for Prism.
 *
 * Supports Nextcloud, Radicale, Baikal, Synology, and any standard CalDAV server.
 * Uses tsdav for protocol handling and ical.js for event parsing.
 */

import { createDAVClient, type DAVCalendar, type DAVObject } from 'tsdav';
import ICAL from 'ical.js';

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
}

export interface CalDAVTask {
  uid: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
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
): Promise<CalDAVEvent[]> {
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
      const parsed = parseICalObject(obj, timeMin, timeMax);
      events.push(...parsed);
    } catch (error) {
      console.error('Failed to parse CalDAV event:', error instanceof Error ? error.message : error);
    }
  }

  return events;
}

/**
 * Parse a single iCalendar object into one or more events.
 * Handles recurring events by expanding instances within the time range.
 */
function parseICalObject(
  obj: DAVObject,
  rangeStart: Date,
  rangeEnd: Date,
): CalDAVEvent[] {
  const data = obj.data;
  if (!data) return [];

  const jcal = ICAL.parse(data);
  const comp = new ICAL.Component(jcal);
  const vevents = comp.getAllSubcomponents('vevent');
  const events: CalDAVEvent[] = [];

  for (const vevent of vevents) {
    const event = new ICAL.Event(vevent);

    if (!event.summary) continue;

    const isRecurring = event.isRecurrenceException() || !!vevent.getFirstPropertyValue('rrule');

    if (isRecurring && !event.isRecurrenceException()) {
      // Expand recurring event instances within the range
      try {
        const iterator = event.iterator();
        let next = iterator.next();
        let count = 0;
        const maxInstances = 100;

        while (next && count < maxInstances) {
          const occurrence = event.getOccurrenceDetails(next);
          const start = occurrence.startDate.toJSDate();
          const end = occurrence.endDate.toJSDate();

          if (start > rangeEnd) break;
          if (end >= rangeStart) {
            events.push({
              uid: `${event.uid}_${start.toISOString()}`,
              title: event.summary,
              description: event.description || null,
              location: event.location || null,
              startTime: start,
              endTime: end,
              allDay: isAllDay(vevent),
              color: null,
              recurring: true,
              recurrenceRule: vevent.getFirstPropertyValue('rrule')?.toString() || null,
            });
          }

          next = iterator.next();
          count++;
        }
      } catch {
        // If recurrence expansion fails, add the base event
        events.push(makeEvent(event, vevent));
      }
    } else {
      events.push(makeEvent(event, vevent));
    }
  }

  return events;
}

function makeEvent(event: ICAL.Event, vevent: ICAL.Component): CalDAVEvent {
  return {
    uid: event.uid,
    title: event.summary,
    description: event.description || null,
    location: event.location || null,
    startTime: event.startDate.toJSDate(),
    endTime: event.endDate.toJSDate(),
    allDay: isAllDay(vevent),
    color: null,
    recurring: false,
    recurrenceRule: null,
  };
}

/**
 * Fetch tasks (VTODO) from a CalDAV calendar.
 */
export async function fetchCalDAVTasks(
  serverUrl: string,
  username: string,
  password: string,
  calendarHref: string,
): Promise<CalDAVTask[]> {
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
      const parsed = parseVTodoObject(obj);
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

/**
 * Parse a VTODO iCalendar object into a task.
 */
function parseVTodoObject(obj: DAVObject): CalDAVTask | null {
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
    dueDate: due ? (due instanceof ICAL.Time ? due.toJSDate() : new Date(String(due))) : null,
    completed: status === 'COMPLETED' || !!completed,
    completedAt: completed ? (completed instanceof ICAL.Time ? completed.toJSDate() : new Date(String(completed))) : null,
    priority: prismPriority,
    categories: categories ? (Array.isArray(categories) ? categories.map(String) : [String(categories)]) : [],
  };
}

function isAllDay(vevent: ICAL.Component): boolean {
  const dtstart = vevent.getFirstProperty('dtstart');
  if (!dtstart) return false;
  const type = dtstart.getParameter('value');
  return type === 'date' || type === 'DATE';
}

function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
