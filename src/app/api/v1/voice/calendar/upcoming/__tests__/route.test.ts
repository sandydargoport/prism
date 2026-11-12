/**
 * @jest-environment node
 */

/**
 * GET /api/v1/voice/calendar/upcoming (#816): the next occurrence of a
 * repeating event made in Prism comes up, once.
 */
import { NextRequest } from 'next/server';

// Three queries: timed, all-day, then the series rows.
const results: unknown[][] = [];
const chain = () => {
  const rows = results.shift() ?? [];
  const p = Promise.resolve(rows) as Promise<unknown[]> & { orderBy: () => { limit: () => Promise<unknown[]> } };
  p.orderBy = () => ({ limit: () => Promise.resolve(rows) });
  return p;
};

jest.mock('@/lib/db/client', () => ({ db: { select: () => ({ from: () => ({ where: () => chain() }) }) } }));
jest.mock('@/lib/db/schema', () => ({ events: {} }));
jest.mock('drizzle-orm', () => {
  const noop = () => ({});
  return { and: noop, eq: noop, gte: noop, lt: noop, asc: noop, isNotNull: noop, isNull: noop, or: noop };
});
jest.mock('@/lib/services/hiddenEvents', () => ({ visibleEventsCondition: () => ({}) }));
jest.mock('@/lib/api/withAuth', () => ({ withAuth: (handler: () => unknown) => handler() }));
jest.mock('@/lib/householdTimezone', () => ({ getHouseholdTimezone: async () => 'UTC' }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

import { GET } from '../route';
import { occurrenceId } from '@/lib/utils/recurrence';

const weekly = {
  id: 'series-1', title: 'Piano lesson', location: null, allDay: false,
  startTime: new Date('2026-10-07T10:00:00Z'), endTime: new Date('2026-10-07T11:00:00Z'),
  recurrenceRule: 'FREQ=WEEKLY;BYDAY=WE',
};

async function upcoming(count = 3) {
  const res = await GET(new NextRequest(`http://localhost/api/v1/voice/calendar/upcoming?count=${count}`));
  return (await (res as Response).json()) as { data: { events: Array<{ id: string; title: string; startTime: string }> } };
}

describe('GET /api/v1/voice/calendar/upcoming (#816)', () => {
  beforeEach(() => { jest.useFakeTimers(); results.length = 0; });
  afterEach(() => jest.useRealTimers());

  it('brings up the next occurrence of a series that began last month', async () => {
    jest.setSystemTime(new Date('2026-11-05T12:00:00Z')); // Thursday
    results.push([], [], [weekly]);
    const body = await upcoming(1);
    expect(body.data.events).toEqual([expect.objectContaining({
      id: occurrenceId('series-1', new Date('2026-11-11T10:00:00Z')),
      startTime: '2026-11-11T10:00:00.000Z',
    })]);
  });

  it('sorts its occurrences in with plain events', async () => {
    jest.setSystemTime(new Date('2026-11-05T12:00:00Z'));
    const plain = { id: 'plain', title: 'Dentist', location: null, allDay: false, startTime: new Date('2026-11-09T09:00:00Z'), endTime: new Date('2026-11-09T09:30:00Z') };
    results.push([plain], [], [weekly]);
    const body = await upcoming(3);
    expect(body.data.events.map((e) => e.startTime)).toEqual([
      '2026-11-09T09:00:00.000Z', '2026-11-11T10:00:00.000Z', '2026-11-18T10:00:00.000Z',
    ]);
  });
});
