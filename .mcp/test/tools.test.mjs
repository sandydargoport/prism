// Calls each MCP tool through a real MCP client and records the request it
// would send to Prism, so a tool whose fields drift from its route's schema
// fails here instead of at a 400 (#532).
// Run after `npm run build`: node --test test/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ApiError, householdTimeSource, registerTools } from '../dist/tools.js';

const ID = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';

/**
 * A client wired to the tools with a fake API. `household` is what
 * GET /api/household-time answers, or null for a server without it (404).
 */
async function connect({ household = { timeZone: 'America/Chicago', today: '2026-09-30', now: '2026-10-01T03:30:00.000Z', weekStartsOn: 0 }, respond } = {}) {
  const calls = [];
  const api = async (method, path, body) => {
    if (path === '/api/household-time') {
      if (!household) throw new ApiError('Prism API GET /api/household-time → 404: Not Found', 404);
      return household;
    }
    calls.push({ method, path, body });
    return respond ? respond(method, path, body) : { ok: true };
  };
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerTools(server, api, householdTimeSource(api));
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(a), client.connect(b)]);
  const call = async (name, args = {}) => client.callTool({ name, arguments: args });
  return { calls, call, last: () => calls.at(-1) };
}

test('list_meals sends from/to, which is what GET /api/meals reads', async () => {
  const t = await connect();
  await t.call('list_meals', { startDate: '2026-10-05', endDate: '2026-10-11' });
  assert.equal(t.last().path, '/api/meals?from=2026-10-05&to=2026-10-11');

  await t.call('list_meals', { startDate: '2026-10-05' });
  assert.equal(t.last().path, '/api/meals?from=2026-10-05&to=2026-10-11');

  await t.call('list_meals', {});
  assert.equal(t.last().path, '/api/meals');
});

test('create_meal sends weekOf and dayOfWeek under the household week start', async () => {
  const sunday = await connect();
  await sunday.call('create_meal', { name: 'Tacos', date: '2026-10-01', mealType: 'dinner' });
  assert.deepEqual(sunday.last(), {
    method: 'POST',
    path: '/api/meals',
    body: { name: 'Tacos', mealType: 'dinner', weekOf: '2026-09-27', dayOfWeek: 'thursday' },
  });

  const monday = await connect({ household: { timeZone: 'Europe/Berlin', today: '2026-09-30', now: '2026-09-30T10:00:00.000Z', weekStartsOn: 1 } });
  await monday.call('create_meal', { name: 'Soup', date: '2026-10-04', mealType: 'lunch', mealTime: '12:30' });
  assert.equal(monday.last().body.weekOf, '2026-09-28');
  assert.equal(monday.last().body.dayOfWeek, 'sunday');
  assert.equal(monday.last().body.mealTime, '12:30');
  assert.equal('date' in monday.last().body, false);
});

test('create_maintenance_item sends nextDue, category and schedule', async () => {
  const t = await connect();
  await t.call('create_maintenance_item', {
    title: 'Replace furnace filter', category: 'home', schedule: 'quarterly', nextDue: '2026-11-15',
  });
  assert.deepEqual(t.last().body, { title: 'Replace furnace filter', category: 'home', schedule: 'quarterly', nextDue: '2026-11-15' });
});

test('complete_chore sends completedBy', async () => {
  const t = await connect();
  await t.call('complete_chore', { id: ID, userId: USER });
  assert.deepEqual(t.last(), { method: 'POST', path: `/api/chores/${ID}/complete`, body: { completedBy: USER } });
});

test('updates use PATCH, the only update method the routes export', async () => {
  const t = await connect();
  await t.call('update_chore', { id: ID, title: 'Dishes' });
  assert.deepEqual(t.last(), { method: 'PATCH', path: `/api/chores/${ID}`, body: { title: 'Dishes' } });
  await t.call('update_shopping_item', { id: ID, checked: true });
  assert.deepEqual(t.last(), { method: 'PATCH', path: `/api/shopping-items/${ID}`, body: { checked: true } });
  await t.call('update_event', { id: ID, title: 'Dentist' });
  assert.deepEqual(t.last(), { method: 'PATCH', path: `/api/events/${ID}`, body: { title: 'Dentist' } });
  await t.call('update_task', { id: ID, completed: true });
  assert.equal(t.last().method, 'PATCH');
});

test('add_shopping_item sends a numeric quantity', async () => {
  const t = await connect();
  await t.call('add_shopping_item', { name: 'Eggs', listId: ID, quantity: 2, unit: 'dozen' });
  assert.deepEqual(t.last().body, { name: 'Eggs', listId: ID, quantity: 2, unit: 'dozen', recurring: false });
  const bad = await t.call('add_shopping_item', { name: 'Flour', listId: ID, quantity: '1 lb' });
  assert.equal(bad.isError, true);
});

test('post_message sends message, and a household expiry as UTC', async () => {
  const t = await connect();
  await t.call('post_message', { content: 'Pizza tonight', authorId: USER, expiresAt: '2026-10-02T21:00' });
  assert.deepEqual(t.last().body, {
    message: 'Pizza tonight', authorId: USER, pinned: false, important: false, expiresAt: '2026-10-03T02:00:00.000Z',
  });
});

test('create_goal sends name and pointCost', async () => {
  const t = await connect();
  await t.call('create_goal', { name: 'Movie night', pointCost: 50 });
  assert.deepEqual(t.last().body, { name: 'Movie night', pointCost: 50, recurring: false });
});

test('create_event reads a wall time in the household zone and sends UTC', async () => {
  const t = await connect({ respond: (_m, _p, body) => ({ id: ID, ...body }) });
  const res = await t.call('create_event', { title: 'Dentist', startTime: '2026-10-01T15:00', endTime: '2026-10-01T16:00' });
  assert.deepEqual(t.last().body, {
    title: 'Dentist', allDay: false, startTime: '2026-10-01T20:00:00.000Z', endTime: '2026-10-01T21:00:00.000Z',
  });
  assert.equal(res.structuredContent.localStart, '2026-10-01T15:00');
});

test('create_event across the fall-back change keeps each end in its own offset', async () => {
  const t = await connect();
  await t.call('create_event', { title: 'Overnight', startTime: '2026-10-31T22:00', endTime: '2026-11-01T08:00' });
  assert.equal(t.last().body.startTime, '2026-11-01T03:00:00.000Z'); // CDT, UTC-5
  assert.equal(t.last().body.endTime, '2026-11-01T14:00:00.000Z'); // CST, UTC-6
});

test('create_event all-day takes dates, last day inclusive', async () => {
  const t = await connect();
  await t.call('create_event', { title: 'Camp', startTime: '2026-10-05', endTime: '2026-10-07', allDay: true });
  assert.equal(t.last().body.startTime, '2026-10-05T00:00:00.000Z');
  assert.equal(t.last().body.endTime, '2026-10-08T00:00:00.000Z');

  const missingEnd = await t.call('create_event', { title: 'Call', startTime: '2026-10-05T09:00' });
  assert.equal(missingEnd.isError, true);
});

test('without the household zone, offsets still work and wall times are refused', async () => {
  const t = await connect({ household: null });
  await t.call('create_event', { title: 'Call', startTime: '2026-10-05T09:00:00-05:00', endTime: '2026-10-05T10:00:00-05:00' });
  assert.equal(t.last().body.startTime, '2026-10-05T14:00:00.000Z');
  const n = t.calls.length;
  const res = await t.call('create_event', { title: 'Call', startTime: '2026-10-05T09:00', endTime: '2026-10-05T10:00' });
  assert.equal(res.isError, true);
  assert.equal(t.calls.length, n, 'nothing was sent');
  const time = await t.call('get_household_time');
  assert.equal(time.isError, true);
});

test('list_events turns household dates into a UTC window and labels results', async () => {
  const t = await connect({
    respond: () => ({ events: [{ id: ID, startTime: '2026-11-01T14:00:00.000Z', endTime: '2026-11-01T15:00:00.000Z', allDay: false }] }),
  });
  const res = await t.call('list_events', { startDate: '2026-11-01', endDate: '2026-11-01' });
  const qs = new URLSearchParams(t.last().path.split('?')[1]);
  assert.equal(qs.get('startDate'), '2026-11-01T05:00:00.000Z');
  assert.equal(qs.get('endDate'), '2026-11-02T05:59:59.999Z');
  assert.equal(res.structuredContent.timeZone, 'America/Chicago');
  assert.equal(res.structuredContent.events[0].localStart, '2026-11-01T08:00');
});

test('get_household_time reports the zone, date and local time', async () => {
  const t = await connect();
  const res = await t.call('get_household_time');
  assert.deepEqual(res.structuredContent, {
    timeZone: 'America/Chicago',
    today: '2026-09-30',
    now: '2026-10-01T03:30:00.000Z',
    weekStartsOn: 0,
    localTime: '22:30',
    weekday: 'wednesday',
  });
});
