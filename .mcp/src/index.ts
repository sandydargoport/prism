#!/usr/bin/env node
/**
 * Prism MCP Server
 *
 * Exposes the Prism family dashboard REST API as MCP tools so AI agents
 * (Claude Desktop, Cursor, VS Code Copilot Chat, etc.) can read and write
 * chores, tasks, events, shopping lists, messages, meals, goals, and more.
 *
 * SDK: @modelcontextprotocol/sdk v1.29+ — uses the stdio transport and
 *   returns structured tool outputs (`structuredContent` alongside `content`)
 *   per the 2025-06-18 spec.
 *
 * Configuration (environment variables):
 *   PRISM_BASE_URL   Base URL of your Prism instance (e.g. https://prism.example.com)
 *   PRISM_API_TOKEN  Bearer token generated in Settings → Security → API Tokens
 *
 * Remote / hosted variant (Streamable HTTP transport + OAuth 2.1) is a
 * future addition — current build targets a local subprocess launched by
 * the AI client.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = (process.env.PRISM_BASE_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.PRISM_API_TOKEN ?? '';

if (!BASE_URL || !TOKEN) {
  process.stderr.write(
    'Error: PRISM_BASE_URL and PRISM_API_TOKEN environment variables are required.\n'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function api(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown
): Promise<unknown> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(`Prism API ${method} ${path} → ${res.status}: ${text}`);
  }
  return data;
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
 * omitted here — Prism's REST responses vary by endpoint and we don't
 * want to drift from upstream silently. Clients that need stricter typing
 * can validate against the documented API.
 */
function ok(data: unknown) {
  const structured: Record<string, unknown> =
    Array.isArray(data) ? { items: data } :
    data !== null && typeof data === 'object' ? (data as Record<string, unknown>) :
    { value: data };
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: structured,
  };
}

// ---------------------------------------------------------------------------
// MCP server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: 'prism',
  version: '1.0.0',
});

// ===========================================================================
// CHORES
// ===========================================================================

server.tool(
  'list_chores',
  'List all chores. Optionally filter by assignedTo (user UUID) or enabled status.',
  {
    assignedTo: z.string().uuid().optional().describe('Filter by user UUID'),
    enabled: z.boolean().optional().describe('Filter by enabled status (default: true)'),
    includeFuture: z.boolean().optional().describe('Include future-dated chores'),
  },
  async ({ assignedTo, enabled, includeFuture }) => {
    const params = new URLSearchParams();
    if (assignedTo) params.set('assignedTo', assignedTo);
    if (enabled !== undefined) params.set('enabled', String(enabled));
    if (includeFuture) params.set('includeFuture', 'true');
    const qs = params.toString();
    return ok(await api('GET', `/api/chores${qs ? `?${qs}` : ''}`));
  }
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
    nextDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Initial due date YYYY-MM-DD'),
    nextDueTime: z.string().regex(/^\d{2}:\d{2}$/).optional().describe('Time of day HH:mm'),
  },
  async (params) => ok(await api('POST', '/api/chores', params))
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
    assignedTo: z.string().uuid().nullable().optional(),
    pointValue: z.number().int().min(0).max(1000).optional(),
    requiresApproval: z.boolean().optional(),
    enabled: z.boolean().optional(),
    nextDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    nextDueTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  },
  async ({ id, ...body }) => ok(await api('PUT', `/api/chores/${id}`, body))
);

server.tool(
  'delete_chore',
  'Delete a chore by ID.',
  { id: z.string().uuid().describe('Chore UUID') },
  async ({ id }) => ok(await api('DELETE', `/api/chores/${id}`))
);

server.tool(
  'complete_chore',
  'Mark a chore as completed by a specific user.',
  {
    id: z.string().uuid().describe('Chore UUID'),
    userId: z.string().uuid().describe('UUID of the user completing the chore'),
  },
  async ({ id, userId }) => ok(await api('POST', `/api/chores/${id}/complete`, { userId }))
);

// ===========================================================================
// TASKS
// ===========================================================================

server.tool(
  'list_tasks',
  'List tasks with optional filters.',
  {
    userId: z.string().uuid().optional().describe('Filter by assigned user UUID'),
    completed: z.boolean().optional().describe('Filter by completion status'),
    priority: z.enum(['high', 'medium', 'low']).optional(),
    dueBefore: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Due on or before this date, YYYY-MM-DD'),
    dueAfter: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Due on or after this date, YYYY-MM-DD'),
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
  }
);

server.tool(
  'create_task',
  'Create a new task.',
  {
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    assignedTo: z.string().uuid().optional().describe('User UUID'),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Due date, YYYY-MM-DD'),
    dueTime: z.string().regex(/^\d{2}:\d{2}$/).optional().describe('Due time HH:mm in the household time zone; omit for any time that day'),
    priority: z.enum(['high', 'medium', 'low']).optional(),
    listId: z.string().uuid().nullable().optional().describe('Task list UUID'),
  },
  async (params) => ok(await api('POST', '/api/tasks', params))
);

server.tool(
  'update_task',
  'Update an existing task by ID.',
  {
    id: z.string().uuid(),
    title: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    assignedTo: z.string().uuid().nullable().optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().describe('YYYY-MM-DD; null clears the due date and time'),
    dueTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional().describe('HH:mm; null for any time that day; omit to keep'),
    priority: z.enum(['high', 'medium', 'low']).nullable().optional(),
    completed: z.boolean().optional(),
    listId: z.string().uuid().nullable().optional(),
  },
  // The route has no PUT; PATCH is the partial update this tool describes.
  async ({ id, ...body }) => ok(await api('PATCH', `/api/tasks/${id}`, body))
);

server.tool(
  'delete_task',
  'Delete a task by ID.',
  { id: z.string().uuid() },
  async ({ id }) => ok(await api('DELETE', `/api/tasks/${id}`))
);

// ===========================================================================
// CALENDAR EVENTS
// ===========================================================================

server.tool(
  'list_events',
  'List calendar events within a date range.',
  {
    startDate: z.string().datetime().describe('Start of date range (ISO)'),
    endDate: z.string().datetime().describe('End of date range (ISO)'),
    calendarId: z.string().uuid().optional().describe('Filter by calendar source UUID'),
    limit: z.number().int().min(1).max(500).optional().default(100),
  },
  async ({ startDate, endDate, calendarId, limit }) => {
    const params = new URLSearchParams({ startDate, endDate });
    if (calendarId) params.set('calendarId', calendarId);
    if (limit !== undefined) params.set('limit', String(limit));
    return ok(await api('GET', `/api/events?${params}`));
  }
);

server.tool(
  'create_event',
  'Create a new calendar event.',
  {
    title: z.string().min(1).max(255),
    startTime: z.string().datetime().describe('ISO datetime'),
    endTime: z.string().datetime().describe('ISO datetime'),
    description: z.string().optional(),
    location: z.string().max(255).optional(),
    allDay: z.boolean().optional().default(false),
    calendarSourceId: z.string().uuid().optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe('Hex color e.g. #3B82F6'),
    createdBy: z.string().uuid().optional().describe('User UUID'),
  },
  async (params) => ok(await api('POST', '/api/events', params))
);

server.tool(
  'update_event',
  'Update an existing calendar event.',
  {
    id: z.string().uuid(),
    title: z.string().min(1).max(255).optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    description: z.string().optional(),
    location: z.string().max(255).optional(),
    allDay: z.boolean().optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  },
  async ({ id, ...body }) => ok(await api('PUT', `/api/events/${id}`, body))
);

server.tool(
  'delete_event',
  'Delete a calendar event by ID.',
  { id: z.string().uuid() },
  async ({ id }) => ok(await api('DELETE', `/api/events/${id}`))
);

// ===========================================================================
// SHOPPING
// ===========================================================================

server.tool(
  'list_shopping_lists',
  'List all shopping lists.',
  {},
  async () => ok(await api('GET', '/api/shopping-lists'))
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
  }
);

server.tool(
  'add_shopping_item',
  'Add an item to a shopping list.',
  {
    name: z.string().min(1).max(255),
    listId: z.string().uuid().describe('Shopping list UUID'),
    quantity: z.string().optional().describe('e.g. "2", "1 lb"'),
    unit: z.string().optional(),
    category: z.string().optional().describe('Aisle / category label'),
    notes: z.string().optional(),
    recurring: z.boolean().optional().default(false),
  },
  async (params) => ok(await api('POST', '/api/shopping-items', params))
);

server.tool(
  'update_shopping_item',
  'Update a shopping item (e.g. check it off).',
  {
    id: z.string().uuid(),
    name: z.string().min(1).max(255).optional(),
    checked: z.boolean().optional(),
    quantity: z.string().optional(),
    unit: z.string().optional(),
    category: z.string().optional(),
    notes: z.string().optional(),
  },
  async ({ id, ...body }) => ok(await api('PUT', `/api/shopping-items/${id}`, body))
);

server.tool(
  'delete_shopping_item',
  'Remove an item from a shopping list.',
  { id: z.string().uuid() },
  async ({ id }) => ok(await api('DELETE', `/api/shopping-items/${id}`))
);

// ===========================================================================
// MESSAGES (family message board)
// ===========================================================================

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
  }
);

server.tool(
  'post_message',
  'Post a new message to the family message board.',
  {
    content: z.string().min(1).max(1000).describe('Message text'),
    authorId: z.string().uuid().describe('User UUID of the author'),
    pinned: z.boolean().optional().default(false),
    important: z.boolean().optional().default(false),
    expiresAt: z.string().datetime().optional().describe('ISO datetime when message auto-expires'),
  },
  async (params) => ok(await api('POST', '/api/messages', params))
);

server.tool(
  'delete_message',
  'Delete a message by ID.',
  { id: z.string().uuid() },
  async ({ id }) => ok(await api('DELETE', `/api/messages/${id}`))
);

// ===========================================================================
// FAMILY
// ===========================================================================

server.tool(
  'list_family',
  'List all family members with their UUIDs, roles, and colors.',
  {},
  async () => ok(await api('GET', '/api/family'))
);

// ===========================================================================
// MEALS
// ===========================================================================

server.tool(
  'list_meals',
  'List meal plan entries.',
  {
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('YYYY-MM-DD'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('YYYY-MM-DD'),
  },
  async ({ startDate, endDate }) => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return ok(await api('GET', `/api/meals?${params}`));
  }
);

server.tool(
  'create_meal',
  'Add a meal to the meal plan.',
  {
    name: z.string().min(1).max(255),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('YYYY-MM-DD'),
    mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
    notes: z.string().optional(),
    recipeId: z.string().uuid().optional().describe('Link to a saved recipe UUID'),
  },
  async (params) => ok(await api('POST', '/api/meals', params))
);

server.tool(
  'delete_meal',
  'Remove a meal from the plan.',
  { id: z.string().uuid() },
  async ({ id }) => ok(await api('DELETE', `/api/meals/${id}`))
);

// ===========================================================================
// GOALS
// ===========================================================================

server.tool(
  'list_goals',
  'List family goals (chore-point reward targets).',
  {},
  async () => ok(await api('GET', '/api/goals'))
);

server.tool(
  'create_goal',
  'Create a new goal.',
  {
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    targetPoints: z.number().int().min(1),
    assignedTo: z.string().uuid().optional().describe('User UUID this goal belongs to'),
    reward: z.string().optional().describe('Description of the reward'),
    recurring: z.boolean().optional().default(false),
  },
  async (params) => ok(await api('POST', '/api/goals', params))
);

// ===========================================================================
// WEATHER
// ===========================================================================

server.tool(
  'get_weather',
  'Get current weather conditions and today\'s forecast.',
  {},
  async () => ok(await api('GET', '/api/weather'))
);

// ===========================================================================
// RECIPES
// ===========================================================================

server.tool(
  'list_recipes',
  'List saved recipes.',
  {},
  async () => ok(await api('GET', '/api/recipes'))
);

server.tool(
  'import_recipe_url',
  'Import a recipe from a URL.',
  {
    url: z.string().url().describe('URL of the recipe page to import'),
  },
  async ({ url }) => ok(await api('POST', '/api/recipes/import-url', { url }))
);

// ===========================================================================
// MAINTENANCE
// ===========================================================================

server.tool(
  'list_maintenance',
  'List home maintenance items.',
  {},
  async () => ok(await api('GET', '/api/maintenance'))
);

server.tool(
  'create_maintenance_item',
  'Create a home maintenance item.',
  {
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('YYYY-MM-DD'),
    frequency: z.enum(['one-time', 'monthly', 'quarterly', 'semi-annually', 'annually']).optional(),
  },
  async (params) => ok(await api('POST', '/api/maintenance', params))
);

// ===========================================================================
// POINTS
// ===========================================================================

server.tool(
  'get_points',
  'Get current chore point totals for all family members.',
  {},
  async () => ok(await api('GET', '/api/points'))
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
