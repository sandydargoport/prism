/**
 * Today's meals for the Babysitter Mode screen (#638): nothing while the mode
 * is off, and while it is on only today's meals, by household date, with no
 * field beyond the name and the slot.
 */
const mockModeState = jest.fn();
const mockTimezone = jest.fn();
const mockWhere = jest.fn();
const mockSelect = jest.fn();
const mockGetCached = jest.fn();

jest.mock('@/lib/services/babysitterMode', () => ({
  getBabysitterModeState: () => mockModeState(),
}));
jest.mock('@/lib/householdTimezone', () => ({
  getHouseholdTimezone: () => mockTimezone(),
}));
jest.mock('@/lib/cache/redis', () => ({
  getCached: (key: string, fn: () => Promise<unknown>) => {
    mockGetCached(key);
    return fn();
  },
}));
jest.mock('drizzle-orm', () => ({
  eq: (column: unknown, value: unknown) => ({ column, value }),
}));
jest.mock('@/lib/db/client', () => ({
  db: {
    select: (fields: unknown) => {
      mockSelect(fields);
      return { from: () => ({ where: (cond: unknown) => mockWhere(cond) }) };
    },
  },
}));
jest.mock('@/lib/db/schema', () => ({
  meals: { name: 'meals.name', mealType: 'meals.meal_type', date: 'meals.date' },
}));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

import { GET } from '../route';

const ON = { enabled: true, enabledAt: '2026-10-03T18:00:00Z', enabledBy: 'p1' };
const OFF = { enabled: false, enabledAt: null, enabledBy: null };

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockModeState.mockResolvedValue(ON);
  mockTimezone.mockResolvedValue('America/Chicago');
  mockWhere.mockResolvedValue([]);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('GET /api/guest-meals', () => {
  it('returns no meals while Babysitter Mode is off, and reads nothing', async () => {
    mockModeState.mockResolvedValue(OFF);
    const res = await GET();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.meals).toBeUndefined();
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockGetCached).not.toHaveBeenCalled();
  });

  it("asks only for today's meals, by the household's date", async () => {
    // 03:00 UTC on the 4th is still the evening of the 3rd in Chicago.
    jest.setSystemTime(new Date('2026-10-04T03:00:00Z'));
    const res = await GET();
    expect(res.status).toBe(200);
    expect(mockWhere).toHaveBeenCalledWith({ column: 'meals.date', value: '2026-10-03' });
    expect(mockGetCached).toHaveBeenCalledWith('meals:guest:2026-10-03');
    expect((await res.json()).date).toBe('2026-10-03');
  });

  it('selects only the name and the slot', async () => {
    jest.setSystemTime(new Date('2026-10-03T15:00:00Z'));
    await GET();
    expect(mockSelect).toHaveBeenCalledWith({ name: 'meals.name', mealType: 'meals.meal_type' });
  });

  it('returns the meals in the order of the day, with nothing else attached', async () => {
    jest.setSystemTime(new Date('2026-10-03T15:00:00Z'));
    mockWhere.mockResolvedValue([
      { name: 'Tacos', mealType: 'dinner', recipe: 'Brown the beans first.' },
      { name: 'Apple slices', mealType: 'snack' },
      { name: 'Pancakes', mealType: 'breakfast' },
      { name: 'Grilled cheese', mealType: 'lunch' },
    ]);
    const res = await GET();
    expect(await res.json()).toEqual({
      date: '2026-10-03',
      meals: [
        { name: 'Pancakes', mealType: 'breakfast' },
        { name: 'Grilled cheese', mealType: 'lunch' },
        { name: 'Apple slices', mealType: 'snack' },
        { name: 'Tacos', mealType: 'dinner' },
      ],
    });
  });

  it('returns an empty list when nothing is planned today', async () => {
    jest.setSystemTime(new Date('2026-10-03T15:00:00Z'));
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).meals).toEqual([]);
  });
});
