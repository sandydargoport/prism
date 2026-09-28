/**
 * The Prism MCP tools. Each maps its parameters onto the REST route it calls,
 * so the field names here follow the route's schema (src/lib/validations and
 * the route handlers under src/app/api), not what reads nicest to a client.
 *
 * Registered through `registerTools` with the HTTP helper passed in, so tests
 * can record what each tool would send without a running Prism.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  DAY_NAMES,
  TimeInputError,
  addDaysToKey,
  eventTimes,
  localDateTime,
  parseDateKey,
  parseInstant,
  rangeBound,
  startOfWeekKey,
  weekdayOfKey,
  withLocalTimes,
} from './time.js';

/** A non-2xx response from Prism. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type ApiFn = (method: HttpMethod, path: string, body?: unknown) => Promise<unknown>;

/** What GET /api/household-time returns. */
export type HouseholdTime = {
  timeZone: string;
  today: string;
  now: string;
  weekStartsOn: 0 | 1;
};

/**
 * Reads the household zone from the server, cached briefly. Resolves to null
 * when the server predates /api/household-time, so offset-bearing input still
 * works against it.
 */
export function householdTimeSource(api: ApiFn, ttlMs = 60_000): () => Promise<HouseholdTime | null> {
  let cached: { value: HouseholdTime | null; expiresAt: number } | null = null;
  return async () => {
    const now = Date.now();
    if (cached && cached.expiresAt > now) return cached.value;
    try {
      const value = (await api('GET', '/api/household-time')) as HouseholdTime;
      if (!value || typeof value.timeZone !== 'string') throw new Error('unexpected response');
      cached = { value, expiresAt: now + ttlMs };
      return value;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        cached = { value: null, expiresAt: now + ttlMs };
        return null;
      }
      throw error;
    }
  };
}

/**
 * Wrap a tool's API response into a CallToolResult.
 *
 * Per the 2025-06-18 MCP spec, tools that return structured data should
 * provide both `content` (a serialized text block, for legacy clients) AND
 * `structuredContent` (the parsed object, for modern clients that can avoid
 * re-parsing). Arrays are wrapped under `items` because the spec requires
 * `structuredContent` to be the equivalent of a JSON object.
 *
 * Output schemas (per-tool JSON Schema declarations) are intentionally
 * omitted here: Prism's REST responses vary by endpoint and we don't want to
 * drift from upstream silently.
 */
export function ok(data: unknown) {
  const structured: Record<string, unknown> =
    Array.isArray(data) ? { items: data } :
    data !== null && typeof data === 'object' ? (data as Record<string, unknown>) :
    { value: data };
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: structured,
  };
}

function inputError(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

/** Run a handler, turning a bad time value into a tool error the client can act on. */
async function guarded<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof TimeInputError) return inputError(error.message);
    throw error;
  }
}

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const wallTime = z.string().regex(/^\d{2}:\d{2}$/);

const TIME_HELP =
  'Give YYYY-MM-DDTHH:mm for a time in the household time zone (see get_household_time), ' +
  'or an ISO date-time with an offset such as 2026-10-04T15:00:00-05:00.';

export function registerTools(
  server: McpServer,
  api: ApiFn,
  householdTime: () => Promise<HouseholdTime | null>,
) {
  const zone = async () => (await householdTime())?.timeZone ?? null;

  /** Add localStart/localEnd to an event, or to each event of a list response. */
  async function localiseEvents(data: unknown): Promise<unknown> {
    const tz = await zone().catch(() => null);
    if (!tz || data === null || typeof data !== 'object') return data;
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.events)) {
      return {
        ...record,
        timeZone: tz,
        events: record.events.map((e) => (e && typeof e === 'object' ? withLocalTimes(e as Record<string, unknown>, tz) : e)),
      };
    }
    return withLocalTimes(record, tz);
  }

  // =========================================================================
  // HOUSEHOLD TIME
  // =========================================================================

  server.tool(
    'get_household_time',
    'The household time zone, today\'s date there, the current local time and the first day of the week. ' +
      'Call this before working out a date or time such as "tomorrow at 3 PM": the tools read times without an offset in this zone.',
    {},
    async () => {
      const t = await householdTime();
      if (!t) {
        return inputError(
          'This Prism server does not report its household time zone (it predates /api/household-time). ' +
            'Send times with an explicit UTC offset.',
        );
      }
      return ok({
        ...t,
        localTime: localDateTime(t.now, t.timeZone).slice(11),
        weekday: DAY_NAMES[weekdayOfKey(t.today)],
      });
    },
  );

  // =========================================================================
  // CHORES (/api/chores, /api/chores/[id], /api/chores/[id]/complete)
  // =========================================================================

  server.tool(
    'list_chores',
    'List chores that are due (today or earlier in the household zone), awaiting approval, or recently done. ' +
      'Optionally filter by assignedTo (user UUID) or enabled status.',
    {
      assignedTo: z.string().uuid().optional().describe('Filter by user UUID'),
      enabled: z.boolean().optional().describe('Filter by enabled status (default: true)'),
      includeFuture: z.boolean().optional().describe('Include chores not yet due'),
    },
    async ({ assignedTo, enabled, includeFuture }) => {
      const params = new URLSearchParams();
      if (assignedTo) params.set('assignedTo', assignedTo);
      if (enabled !== undefined) params.set('enabled', String(enabled));
      if (includeFuture) params.set('includeFuture', 'true');
      const qs = params.toString();
      return ok(await api('GET', `/api/chores${qs ? `?${qs}` : ''}`));
    },
  );

  server.tool(
    'create_chore',
    'Create a new chore.',
    {
      title: z.string().min(1).max(255).describe('Chore title'),
      category: z.enum(['cleaning', 'laundry', 'dishes', 'yard', 'pets', 'trash', 'other']),
      frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semi-annually', 'annually', 'custom']),
      description: z.string().optional(),
      assignedTo: z.string().uuid().optional().describe('User UUID to assign the chore to'),
      pointValue: z.number().int().min(0).max(1000).optional().default(0),
      requiresApproval: z.boolean().optional().default(false),
      customIntervalDays: z.number().int().min(1).max(365).optional().describe('Days between occurrences (only for frequency=custom)'),
      nextDue: dateKey.optional().describe('Initial due date YYYY-MM-DD in the household time zone'),
      nextDueTime: wallTime.optional().describe('Time of day HH:mm in the household time zone'),
    },
    async (params) => ok(await api('POST', '/api/chores', params)),
  );

  server.tool(
    'update_chore',
    'Update an existing chore by ID.',
    {
      id: z.string().uuid().describe('Chore UUID'),
      title: z.string().min(1).max(255).optional(),
      category: z.enum(['cleaning', 'laundry', 'dishes', 'yard', 'pets', 'trash', 'other']).optional(),
      frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semi-annually', 'annually', 'custom']).optional(),
      description: z.string().optional(),
      assignedTo: z.string().uuid().optional(),
      pointValue: z.number().int().min(0).max(1000).optional(),
      requiresApproval: z.boolean().optional(),
      enabled: z.boolean().optional(),
      customIntervalDays: z.number().int().min(1).max(365).optional(),
      nextDue: dateKey.nullable().optional().describe('YYYY-MM-DD in the household time zone'),
      nextDueTime: wallTime.nullable().optional().describe('HH:mm in the household time zone; null for any time'),
    },
    // The route has PATCH only.
    async ({ id, ...body }) => ok(await api('PATCH', `/api/chores/${id}`, body)),
  );

  server.tool(
    'delete_chore',
    'Delete a chore by ID.',
    { id: z.string().uuid().describe('Chore UUID') },
    async ({ id }) => ok(await api('DELETE', `/api/chores/${id}`)),
  );

  server.tool(
    'complete_chore',
    'Mark a chore as completed by a specific user.',
    {
      id: z.string().uuid().describe('Chore UUID'),
      userId: z.string().uuid().describe('UUID of the user completing the chore'),
      notes: z.string().max(1000).optional(),
    },
    async ({ id, userId, notes }) =>
      ok(await api('POST', `/api/chores/${id}/complete`, { completedBy: userId, ...(notes ? { notes } : {}) })),
  );

  // =========================================================================
  // TASKS (/api/tasks, /api/tasks/[id])
  // =========================================================================

  server.tool(
    'list_tasks',
    'List tasks with optional filters.',
    {
      userId: z.string().uuid().optional().describe('Filter by assigned user UUID'),
      completed: z.boolean().optional().describe('Filter by completion status'),
      priority: z.enum(['high', 'medium', 'low']).optional(),
      dueBefore: dateKey.optional().describe('Due on or before this date, YYYY-MM-DD'),
      dueAfter: dateKey.optional().describe('Due on or after this date, YYYY-MM-DD'),
      limit: z.number().int().min(1).max(100).optional().default(50),
      offset: z.number().int().min(0).optional().default(0),
    },
    async ({ userId, completed, priority, dueBefore, dueAfter, limit, offset }) => {
      const params = new URLSearchParams();
      if (userId) params.set('userId', userId);
      if (completed !== undefined) params.set('completed', String(completed));
      if (priority) params.set('priority', priority);
      if (dueBefore) params.set('dueBefore', dueBefore);
      if (dueAfter) params.set('dueAfter', dueAfter);
      if (limit !== undefined) params.set('limit', String(limit));
      if (offset !== undefined) params.set('offset', String(offset));
      return ok(await api('GET', `/api/tasks?${params}`));
    },
  );

  server.tool(
    'create_task',
    'Create a new task.',
    {
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      assignedTo: z.string().uuid().optional().describe('User UUID'),
      dueDate: dateKey.optional().describe('Due date, YYYY-MM-DD'),
      dueTime: wallTime.optional().describe('Due time HH:mm in the household time zone; omit for any time that day'),
      priority: z.enum(['high', 'medium', 'low']).optional(),
      listId: z.string().uuid().nullable().optional().describe('Task list UUID'),
    },
    async (params) => ok(await api('POST', '/api/tasks', params)),
  );

  server.tool(
    'update_task',
    'Update an existing task by ID.',
    {
      id: z.string().uuid(),
      title: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      assignedTo: z.string().uuid().nullable().optional(),
      dueDate: dateKey.nullable().optional().describe('YYYY-MM-DD; null clears the due date and time'),
      dueTime: wallTime.nullable().optional().describe('HH:mm; null for any time that day; omit to keep'),
      priority: z.enum(['high', 'medium', 'low']).nullable().optional(),
      completed: z.boolean().optional(),
      listId: z.string().uuid().nullable().optional(),
    },
    // The route has no PUT; PATCH is the partial update this tool describes.
    async ({ id, ...body }) => ok(await api('PATCH', `/api/tasks/${id}`, body)),
  );

  server.tool(
    'delete_task',
    'Delete a task by ID.',
    { id: z.string().uuid() },
    async ({ id }) => ok(await api('DELETE', `/api/tasks/${id}`)),
  );

  // =========================================================================
  // CALENDAR EVENTS (/api/events, /api/events/[id])
  // =========================================================================

  server.tool(
    'list_events',
    'List calendar events within a date range. Each event carries startTime/endTime in UTC and ' +
      'localStart/localEnd in the household time zone (for all-day events, the first and last dates).',
    {
      startDate: z.string().describe(`Start of the range. A date YYYY-MM-DD means from the start of that household day. ${TIME_HELP}`),
      endDate: z.string().describe(`End of the range. A date YYYY-MM-DD means through the end of that household day. ${TIME_HELP}`),
      calendarId: z.string().uuid().optional().describe('Filter by calendar source UUID'),
      limit: z.number().int().min(1).max(500).optional().default(100),
    },
    async ({ startDate, endDate, calendarId, limit }) => guarded(async () => {
      const tz = await zone();
      const params = new URLSearchParams({
        startDate: rangeBound(startDate, tz, 'start', 'startDate'),
        endDate: rangeBound(endDate, tz, 'end', 'endDate'),
      });
      if (calendarId) params.set('calendarId', calendarId);
      if (limit !== undefined) params.set('limit', String(limit));
      return ok(await localiseEvents(await api('GET', `/api/events?${params}`)));
    }),
  );

  const eventTimeHelp =
    `${TIME_HELP} For an all-day event (allDay: true) give dates YYYY-MM-DD: startTime is the first day and endTime the last day, inclusive.`;

  server.tool(
    'create_event',
    'Create a new calendar event.',
    {
      title: z.string().min(1).max(255),
      startTime: z.string().describe(eventTimeHelp),
      endTime: z.string().optional().describe('Required for a timed event. For an all-day event, the last day; omit for a one-day event.'),
      description: z.string().optional(),
      location: z.string().max(5000).optional(),
      allDay: z.boolean().optional().default(false),
      calendarSourceId: z.string().uuid().optional(),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe('Hex color e.g. #3B82F6'),
      createdBy: z.string().uuid().optional().describe('User UUID'),
    },
    async ({ startTime, endTime, allDay, ...rest }) => guarded(async () => {
      if (endTime === undefined && !(allDay && parseDateKey(startTime))) {
        throw new TimeInputError('endTime is required, except for an all-day event given as a date.');
      }
      const times = eventTimes({ startTime, endTime, allDay }, await zone(), true);
      return ok(await localiseEvents(await api('POST', '/api/events', { ...rest, allDay, ...times })));
    }),
  );

  server.tool(
    'update_event',
    'Update an existing calendar event. Only the fields given change.',
    {
      id: z.string().uuid(),
      title: z.string().min(1).max(255).optional(),
      startTime: z.string().optional().describe(eventTimeHelp),
      endTime: z.string().optional().describe('For an all-day event, the last day (inclusive).'),
      description: z.string().nullable().optional(),
      location: z.string().max(5000).nullable().optional(),
      allDay: z.boolean().optional().describe('Pass true alongside dates when moving an all-day event'),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
    },
    // The route has PATCH only.
    async ({ id, startTime, endTime, allDay, ...rest }) => guarded(async () => {
      const times = eventTimes({ startTime, endTime, allDay }, await zone());
      const body = { ...rest, ...(allDay !== undefined ? { allDay } : {}), ...times };
      return ok(await localiseEvents(await api('PATCH', `/api/events/${id}`, body)));
    }),
  );

  server.tool(
    'delete_event',
    'Delete a calendar event by ID.',
    { id: z.string().uuid() },
    async ({ id }) => ok(await api('DELETE', `/api/events/${id}`)),
  );

  // =========================================================================
  // SHOPPING (/api/shopping-lists, /api/shopping-items, /api/shopping-items/[id])
  // =========================================================================

  server.tool(
    'list_shopping_lists',
    'List all shopping lists.',
    {},
    async () => ok(await api('GET', '/api/shopping-lists')),
  );

  server.tool(
    'list_shopping_items',
    'List shopping items, optionally filtered by list.',
    {
      listId: z.string().uuid().optional().describe('Shopping list UUID'),
      checked: z.boolean().optional().describe('Filter by checked/unchecked status'),
    },
    async ({ listId, checked }) => {
      const params = new URLSearchParams();
      if (listId) params.set('listId', listId);
      if (checked !== undefined) params.set('checked', String(checked));
      return ok(await api('GET', `/api/shopping-items?${params}`));
    },
  );

  server.tool(
    'add_shopping_item',
    'Add an item to a shopping list.',
    {
      name: z.string().min(1).max(255),
      listId: z.string().uuid().describe('Shopping list UUID'),
      quantity: z.number().int().positive().optional().describe('A whole number, e.g. 2; put the measure in unit'),
      unit: z.string().max(50).optional().describe('e.g. "lb", "dozen"'),
      category: z.string().max(50).optional().describe('Aisle / category label'),
      notes: z.string().max(500).optional(),
      recurring: z.boolean().optional().default(false),
    },
    async (params) => ok(await api('POST', '/api/shopping-items', params)),
  );

  server.tool(
    'update_shopping_item',
    'Update a shopping item (e.g. check it off).',
    {
      id: z.string().uuid(),
      name: z.string().min(1).max(255).optional(),
      checked: z.boolean().optional(),
      quantity: z.number().int().positive().optional(),
      unit: z.string().max(50).optional(),
      category: z.string().max(50).optional(),
      notes: z.string().max(500).optional(),
    },
    // The route has PATCH only.
    async ({ id, ...body }) => ok(await api('PATCH', `/api/shopping-items/${id}`, body)),
  );

  server.tool(
    'delete_shopping_item',
    'Remove an item from a shopping list.',
    { id: z.string().uuid() },
    async ({ id }) => ok(await api('DELETE', `/api/shopping-items/${id}`)),
  );

  // =========================================================================
  // MESSAGES (/api/messages, /api/messages/[id])
  // =========================================================================

  server.tool(
    'list_messages',
    'List family messages from the message board.',
    {
      limit: z.number().int().min(1).max(100).optional().default(20),
      pinned: z.boolean().optional().describe('Filter by pinned status'),
      includeExpired: z.boolean().optional().default(false),
    },
    async ({ limit, pinned, includeExpired }) => {
      const params = new URLSearchParams();
      if (limit !== undefined) params.set('limit', String(limit));
      if (pinned !== undefined) params.set('pinned', String(pinned));
      if (includeExpired) params.set('includeExpired', 'true');
      return ok(await api('GET', `/api/messages?${params}`));
    },
  );

  server.tool(
    'post_message',
    'Post a new message to the family message board.',
    {
      content: z.string().min(1).max(1000).describe('Message text'),
      authorId: z.string().uuid().describe('User UUID of the author'),
      pinned: z.boolean().optional().default(false),
      important: z.boolean().optional().default(false),
      expiresAt: z.string().optional().describe(`When the message auto-expires; must be in the future. ${TIME_HELP}`),
    },
    async ({ content, expiresAt, ...rest }) => guarded(async () => {
      const body: Record<string, unknown> = { message: content, ...rest };
      if (expiresAt !== undefined) body.expiresAt = parseInstant(expiresAt, await zone(), 'expiresAt').toISOString();
      return ok(await api('POST', '/api/messages', body));
    }),
  );

  server.tool(
    'delete_message',
    'Delete a message by ID.',
    { id: z.string().uuid() },
    async ({ id }) => ok(await api('DELETE', `/api/messages/${id}`)),
  );

  // =========================================================================
  // FAMILY (/api/family)
  // =========================================================================

  server.tool(
    'list_family',
    'List all family members with their UUIDs, roles, and colors.',
    {},
    async () => ok(await api('GET', '/api/family')),
  );

  // =========================================================================
  // MEALS (/api/meals, /api/meals/[id])
  // =========================================================================

  server.tool(
    'list_meals',
    'List meal plan entries between two dates (inclusive). With neither date, lists every meal. ' +
      'With only startDate, the week from it; with only endDate, from today in the household zone.',
    {
      startDate: dateKey.optional().describe('YYYY-MM-DD'),
      endDate: dateKey.optional().describe('YYYY-MM-DD'),
    },
    async ({ startDate, endDate }) => {
      const params = new URLSearchParams();
      if (startDate || endDate) {
        const from = startDate ?? (await householdTime())?.today ?? endDate!;
        const to = endDate ?? addDaysToKey(from, 6);
        // The route filters on a range only when it gets both from and to.
        params.set('from', from);
        params.set('to', to);
      }
      const qs = params.toString();
      return ok(await api('GET', `/api/meals${qs ? `?${qs}` : ''}`));
    },
  );

  server.tool(
    'create_meal',
    'Add a meal to the meal plan on a date.',
    {
      name: z.string().min(1).max(255),
      date: dateKey.describe('YYYY-MM-DD'),
      mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
      mealTime: wallTime.optional().describe('HH:mm in the household time zone'),
      description: z.string().max(5000).optional(),
      recipeId: z.string().uuid().optional().describe('Link to a saved recipe UUID'),
    },
    async ({ date, ...rest }) => guarded(async () => {
      const key = parseDateKey(date);
      if (!key) throw new TimeInputError(`date: not a calendar date: ${date}`);
      // The route stores a meal as (weekOf, dayOfWeek) and derives its date
      // from them; weekOf is the start of the week under the household setting,
      // as the app's own meal planner sends it.
      const weekStartsOn = (await householdTime().catch(() => null))?.weekStartsOn ?? 0;
      const body = {
        ...rest,
        weekOf: startOfWeekKey(key, weekStartsOn),
        dayOfWeek: DAY_NAMES[weekdayOfKey(key)],
      };
      return ok(await api('POST', '/api/meals', body));
    }),
  );

  server.tool(
    'delete_meal',
    'Remove a meal from the plan.',
    { id: z.string().uuid() },
    async ({ id }) => ok(await api('DELETE', `/api/meals/${id}`)),
  );

  // =========================================================================
  // GOALS (/api/goals)
  // =========================================================================

  server.tool(
    'list_goals',
    'List family goals (rewards bought with chore points), with progress.',
    {},
    async () => ok(await api('GET', '/api/goals')),
  );

  server.tool(
    'create_goal',
    'Create a new family goal: a reward that costs chore points.',
    {
      name: z.string().min(1).max(255).describe('The reward, e.g. "Movie night"'),
      pointCost: z.number().int().min(1).max(10000).describe('Points needed'),
      description: z.string().max(2000).optional(),
      emoji: z.string().max(10).optional(),
      recurring: z.boolean().optional().default(false),
      recurrencePeriod: z.enum(['weekly', 'monthly', 'yearly']).optional().describe('Only for recurring goals'),
    },
    async (params) => ok(await api('POST', '/api/goals', params)),
  );

  // =========================================================================
  // WEATHER (/api/weather)
  // =========================================================================

  server.tool(
    'get_weather',
    'Get current weather conditions and today\'s forecast.',
    {},
    async () => ok(await api('GET', '/api/weather')),
  );

  // =========================================================================
  // RECIPES (/api/recipes, /api/recipes/import-url)
  // =========================================================================

  server.tool(
    'list_recipes',
    'List saved recipes.',
    {},
    async () => ok(await api('GET', '/api/recipes')),
  );

  server.tool(
    'import_recipe_url',
    'Import a recipe from a URL.',
    {
      url: z.string().url().describe('URL of the recipe page to import'),
    },
    async ({ url }) => ok(await api('POST', '/api/recipes/import-url', { url })),
  );

  // =========================================================================
  // MAINTENANCE (/api/maintenance)
  // =========================================================================

  server.tool(
    'list_maintenance',
    'List home maintenance reminders.',
    {
      category: z.enum(['car', 'home', 'appliance', 'yard', 'other']).optional(),
      upcoming: z.boolean().optional().describe('Only reminders due within the next 30 days'),
    },
    async ({ category, upcoming }) => {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (upcoming) params.set('upcoming', 'true');
      const qs = params.toString();
      return ok(await api('GET', `/api/maintenance${qs ? `?${qs}` : ''}`));
    },
  );

  server.tool(
    'create_maintenance_item',
    'Create a home maintenance reminder.',
    {
      title: z.string().min(1).max(255),
      category: z.enum(['car', 'home', 'appliance', 'yard', 'other']),
      schedule: z.enum(['monthly', 'quarterly', 'annually', 'custom']),
      customIntervalDays: z.number().int().positive().optional().describe('Days between occurrences (only for schedule=custom)'),
      nextDue: dateKey.describe('Next due date, YYYY-MM-DD'),
      description: z.string().max(2000).optional(),
      assignedTo: z.string().uuid().optional().describe('User UUID'),
      notes: z.string().max(2000).optional(),
    },
    async (params) => ok(await api('POST', '/api/maintenance', params)),
  );

  // =========================================================================
  // POINTS (/api/points)
  // =========================================================================

  server.tool(
    'get_points',
    'Get current chore point totals for all family members.',
    {},
    async () => ok(await api('GET', '/api/points')),
  );
}
