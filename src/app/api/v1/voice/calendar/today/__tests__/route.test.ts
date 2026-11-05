/**
 * @jest-environment node
 */

/**
 * GET /api/v1/voice/calendar/today (#816): a repeating event made in Prism is
 * one series row at its first occurrence; today must include its occurrence.
 */
const mockRows = jest.fn();

// Thenable with .orderBy too, so the shape of the query does not decide the test.
jest.mock('@/lib/db/client', () => ({
  db: { select: () => ({ from: () => ({ where: () => {
    const p = mockRows() as Promise<unknown[]> & { orderBy?: () => Promise<unknown[]> };
    p.orderBy = () => p;
    return p;
  } }) }) },
}));
jest.mock('@/lib/db/schema', () => ({ events: {} }));
jest.mock('drizzle-orm', () => {
  const noop = () => ({});
  return { and: noop, eq: noop, gt: noop, lt: noop, lte: noop, or: noop, isNotNull: noop, isNull: noop, asc: noop, desc: noop };
});
jest.mock('@/lib/services/hiddenEvents', () => ({ visibleEventsCondition: () => ({}) }));
jest.mock('@/lib/api/withAuth', () => ({ withAuth: (handler: () => unknown) => handler() }));
jest.mock('@/lib/householdTimezone', () => ({ getHouseholdTimezone: async () => 'UTC' }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

import { GET } from '../route';
import { occurrenceId } from '@/lib/utils/recurrence';

// Every Wednesday at 10:00, since Wednesday 7 October.
const weekly = {
  id: 'series-1', title: 'Piano lesson', location: null, allDay: false,
  startTime: new Date('2026-10-07T10:00:00Z'), endTime: new Date('2026-10-07T11:00:00Z'),
  recurrenceRule: 'FREQ=WEEKLY;BYDAY=WE', seriesKey: null,
};

async function today() {
  const res = await GET();
  return (await (res as Response).json()) as { data: { count: number; events: Array<{ id: string; title: string; startTime: string }> } };
}

describe('GET /api/v1/voice/calendar/today (#816)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("includes this week's occurrence of a series that began last month", async () => {
    jest.setSystemTime(new Date('2026-11-04T08:00:00Z')); // a Wednesday
    mockRows.mockResolvedValue([weekly]);
    const body = await today();
    expect(body.data.events).toEqual([expect.objectContaining({
      id: occurrenceId('series-1', new Date('2026-11-04T10:00:00Z')),
      title: 'Piano lesson',
      startTime: '2026-11-04T10:00:00.000Z',
    })]);
  });

  it('leaves it out on a day it does not repeat', async () => {
    jest.setSystemTime(new Date('2026-11-05T08:00:00Z')); // a Thursday
    mockRows.mockResolvedValue([weekly]);
    expect((await today()).data.count).toBe(0);
  });

  it('keeps plain events as they are, all-day first', async () => {
    jest.setSystemTime(new Date('2026-11-04T08:00:00Z'));
    mockRows.mockResolvedValue([
      weekly,
      { id: 'plain', title: 'Dentist', location: null, allDay: false, startTime: new Date('2026-11-04T09:00:00Z'), endTime: new Date('2026-11-04T09:30:00Z'), recurrenceRule: null, seriesKey: null },
      { id: 'holiday', title: 'Teacher day', location: null, allDay: true, startTime: new Date('2026-11-04T00:00:00Z'), endTime: new Date('2026-11-05T00:00:00Z'), recurrenceRule: null, seriesKey: null },
    ]);
    expect((await today()).data.events.map((e) => e.title)).toEqual(['Teacher day', 'Dentist', 'Piano lesson']);
  });
});
