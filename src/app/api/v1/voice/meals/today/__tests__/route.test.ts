/**
 * @jest-environment node
 */

const mockWhere = jest.fn();
const mockGetHouseholdTimezone = jest.fn();

jest.mock('@/lib/db/client', () => ({
  db: { select: () => ({ from: () => ({ where: (...a: unknown[]) => mockWhere(...a) }) }) },
}));
jest.mock('@/lib/db/schema', () => ({
  meals: { id: 'id', name: 'name', mealType: 'mealType', mealTime: 'mealTime', date: 'date' },
}));
jest.mock('drizzle-orm', () => ({ eq: (column: unknown, value: unknown) => ({ column, value }) }));
jest.mock('@/lib/api/withAuth', () => ({ withAuth: (handler: () => unknown) => handler() }));
jest.mock('@/lib/householdTimezone', () => ({
  getHouseholdTimezone: () => mockGetHouseholdTimezone(),
}));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

import { GET } from '../route';

describe('GET /api/v1/voice/meals/today', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockWhere.mockReset().mockResolvedValue([]);
  });
  afterEach(() => jest.useRealTimers());

  it("asks for the household's date, not the server's", async () => {
    // 20:30 on Sep 28 in Chicago is already Sep 29 in UTC.
    jest.setSystemTime(new Date('2026-09-29T01:30:00Z'));
    mockGetHouseholdTimezone.mockResolvedValue('America/Chicago');

    await GET();

    expect(mockWhere).toHaveBeenCalledWith({ column: 'date', value: '2026-09-28' });
  });

  it('orders the meals for speaking and counts them', async () => {
    jest.setSystemTime(new Date('2026-09-28T12:00:00Z'));
    mockGetHouseholdTimezone.mockResolvedValue('UTC');
    mockWhere.mockResolvedValue([
      { id: 'b', name: 'Tacos', mealType: 'dinner', mealTime: null },
      { id: 'a', name: 'Oatmeal', mealType: 'breakfast', mealTime: null },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.data.count).toBe(2);
    expect(body.data.meals.map((m: { name: string }) => m.name)).toEqual(['Oatmeal', 'Tacos']);
  });
});
