/**
 * A daily chore done more than once a day (#1107): it stays due today until it
 * has that many approved ticks today, then moves on as any chore does.
 */
jest.mock('@/lib/db/client', () => ({ db: {} }));
jest.mock('@/lib/auth', () => ({ requireRole: jest.fn() }));
jest.mock('@/lib/householdTimezone', () => ({ getHouseholdTimezone: jest.fn() }));
jest.mock('@/lib/cache/cacheKeys', () => ({ invalidateEntity: jest.fn() }));
jest.mock('@/lib/services/auditLog', () => ({ logActivity: jest.fn() }));

import { dueAfterApprovedTick, type CompletableChore } from '../choreCompletion';

const TODAY = '2026-11-08';
const TOMORROW = '2026-11-09';

/** A reader whose count of today's approved ticks is `n`. */
function ticksToday(n: number) {
  const where = jest.fn().mockResolvedValue([{ n }]);
  const select = jest.fn(() => ({ from: () => ({ where }) }));
  return { reader: { select } as never, select };
}

const chore = (over: Partial<CompletableChore>): CompletableChore => ({
  id: 'c1', title: 'Feed the cat', pointValue: 0, frequency: 'daily', customIntervalDays: null, startDay: null, ...over,
});

describe('dueAfterApprovedTick', () => {
  it('keeps a twice-a-day chore due today after its first tick', async () => {
    const { reader } = ticksToday(1);
    expect(await dueAfterApprovedTick(reader, chore({ timesPerDay: 2 }), TODAY, 'America/Chicago')).toBe(TODAY);
  });

  it('moves it to tomorrow after its second', async () => {
    const { reader } = ticksToday(2);
    expect(await dueAfterApprovedTick(reader, chore({ timesPerDay: 2 }), TODAY, 'America/Chicago')).toBe(TOMORROW);
  });

  it('leaves a once-a-day chore as before, without counting', async () => {
    const { reader, select } = ticksToday(0);
    expect(await dueAfterApprovedTick(reader, chore({ timesPerDay: 1 }), TODAY, 'America/Chicago')).toBe(TOMORROW);
    expect(await dueAfterApprovedTick(reader, chore({}), TODAY, 'America/Chicago')).toBe(TOMORROW);
    expect(select).not.toHaveBeenCalled();
  });

  it('ignores times a day on a chore that is not daily', async () => {
    const { reader, select } = ticksToday(0);
    expect(await dueAfterApprovedTick(reader, chore({ frequency: 'weekly', timesPerDay: 3 }), TODAY, 'America/Chicago')).not.toBe(TODAY);
    expect(select).not.toHaveBeenCalled();
  });
});
