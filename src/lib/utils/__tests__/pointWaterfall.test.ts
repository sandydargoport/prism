import { computeWaterfall, getGoalPeriodKey } from '../pointWaterfall';
import { zonedWallTimeToUtc } from '../zonedDate';

// Week, month and year boundaries are the household's, so every call passes
// the zone and every fixture is a wall time in it. The result is the same in
// whatever zone the tests run.
const TZ = 'America/Chicago';
/** The instant the wall clock in TZ reads `YYYY-MM-DDTHH:mm`. */
function at(wall: string): Date {
  const [date, time] = wall.split('T');
  return zonedWallTimeToUtc(date!, time!.slice(0, 5), TZ);
}
const NOW = at('2026-02-16T18:00'); // a Monday
const THIS_WEEK_MON = at('2026-02-16T15:00');
const LAST_WEEK_MON = at('2026-02-09T15:00');

function makeGoal(overrides: Partial<{
  id: string;
  pointCost: number;
  priority: number;
  recurring: boolean;
  recurrencePeriod: 'weekly' | 'monthly' | 'yearly' | null;
  lastResetAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? 'goal-1',
    pointCost: overrides.pointCost ?? 10,
    priority: overrides.priority ?? 1,
    recurring: overrides.recurring ?? false,
    recurrencePeriod: overrides.recurrencePeriod ?? null,
    lastResetAt: overrides.lastResetAt ?? at('2026-01-01T00:00'),
  };
}

function makeCompletion(points: number, date: Date) {
  return { pointsAwarded: points, completedAt: date };
}

describe('computeWaterfall', () => {
  describe('earned counters', () => {
    it('counts weekly/monthly/yearly earned points from completions', () => {
      const completions = [
        makeCompletion(5, at('2026-02-16T10:00')),  // this week + month + year
        makeCompletion(3, at('2026-02-10T10:00')),  // last week but this month + year
        makeCompletion(7, at('2026-01-15T10:00')),  // last month but this year
      ];

      const result = computeWaterfall([makeGoal()], completions, NOW, 0, TZ);

      expect(result.weeklyEarned).toBe(5);
      expect(result.monthlyEarned).toBe(8);   // 5 + 3
      expect(result.yearlyEarned).toBe(15);   // 5 + 3 + 7
    });

    it('treats null pointsAwarded as 0', () => {
      const completions = [
        { pointsAwarded: null, completedAt: at('2026-02-16T10:00') },
        makeCompletion(5, at('2026-02-16T11:00')),
      ];

      const result = computeWaterfall([makeGoal()], completions, NOW, 0, TZ);
      expect(result.weeklyEarned).toBe(5);
    });

    it('returns zeros when no completions exist', () => {
      const result = computeWaterfall([makeGoal()], [], NOW, 0, TZ);
      expect(result.weeklyEarned).toBe(0);
      expect(result.monthlyEarned).toBe(0);
      expect(result.yearlyEarned).toBe(0);
    });
  });

  describe('non-recurring goals', () => {
    it('accumulates points across weeks toward a non-recurring goal', () => {
      const goal = makeGoal({ pointCost: 20, priority: 1, recurring: false });
      const completions = [
        makeCompletion(8, LAST_WEEK_MON),      // week 1: 8 pts
        makeCompletion(7, THIS_WEEK_MON),       // week 2: 7 pts → total 15
      ];

      const result = computeWaterfall([goal], completions, NOW, 0, TZ);
      expect(result.goals[0]!.allocated).toBe(15);
      expect(result.goals[0]!.achieved).toBe(false);
    });

    it('marks goal as achieved when accumulated points >= cost', () => {
      const goal = makeGoal({ pointCost: 10, priority: 1, recurring: false });
      const completions = [
        makeCompletion(6, LAST_WEEK_MON),
        makeCompletion(5, THIS_WEEK_MON),
      ];

      const result = computeWaterfall([goal], completions, NOW, 0, TZ);
      expect(result.goals[0]!.allocated).toBe(10);
      expect(result.goals[0]!.achieved).toBe(true);
    });

    it('caps allocation at pointCost (no over-allocation)', () => {
      const goal = makeGoal({ pointCost: 5, priority: 1, recurring: false });
      const completions = [makeCompletion(20, THIS_WEEK_MON)];

      const result = computeWaterfall([goal], completions, NOW, 0, TZ);
      expect(result.goals[0]!.allocated).toBe(5);
    });
  });

  describe('recurring goals', () => {
    it('only uses current week points for recurring weekly goal progress', () => {
      const goal = makeGoal({ pointCost: 10, priority: 1, recurring: true, recurrencePeriod: 'weekly' });
      const completions = [
        makeCompletion(100, LAST_WEEK_MON),  // old week, doesn't count for progress display
        makeCompletion(7, THIS_WEEK_MON),
      ];

      const result = computeWaterfall([goal], completions, NOW, 0, TZ);
      expect(result.goals[0]!.allocated).toBe(7);
      expect(result.goals[0]!.achieved).toBe(false);
    });

    it('marks recurring goal achieved when current week points >= cost', () => {
      const goal = makeGoal({ pointCost: 5, priority: 1, recurring: true, recurrencePeriod: 'weekly' });
      const completions = [makeCompletion(5, THIS_WEEK_MON)];

      const result = computeWaterfall([goal], completions, NOW, 0, TZ);
      expect(result.goals[0]!.achieved).toBe(true);
    });
  });

  describe('priority ordering', () => {
    it('fills higher-priority goals first (lower priority number)', () => {
      const goals = [
        makeGoal({ id: 'low', pointCost: 10, priority: 2, recurring: false }),
        makeGoal({ id: 'high', pointCost: 10, priority: 1, recurring: false }),
      ];
      const completions = [makeCompletion(12, THIS_WEEK_MON)];

      const result = computeWaterfall(goals, completions, NOW, 0, TZ);
      const high = result.goals.find(g => g.goalId === 'high')!;
      const low = result.goals.find(g => g.goalId === 'low')!;

      expect(high.allocated).toBe(10);
      expect(high.achieved).toBe(true);
      expect(low.allocated).toBe(2);
      expect(low.achieved).toBe(false);
    });

    it('overflow from filled goals spills to next priority', () => {
      const goals = [
        makeGoal({ id: 'first', pointCost: 3, priority: 1, recurring: false }),
        makeGoal({ id: 'second', pointCost: 5, priority: 2, recurring: false }),
      ];
      const completions = [makeCompletion(7, THIS_WEEK_MON)];

      const result = computeWaterfall(goals, completions, NOW, 0, TZ);
      expect(result.goals.find(g => g.goalId === 'first')!.allocated).toBe(3);
      expect(result.goals.find(g => g.goalId === 'second')!.allocated).toBe(4);
    });
  });

  describe('priority ties and ordering', () => {
    it('processes goals with same priority in stable input order', () => {
      const goals = [
        makeGoal({ id: 'a', pointCost: 5, priority: 1, recurring: false }),
        makeGoal({ id: 'b', pointCost: 5, priority: 1, recurring: false }),
        makeGoal({ id: 'c', pointCost: 5, priority: 1, recurring: false }),
      ];
      // Only 7 points — should fill in order: a gets 5, b gets 2, c gets 0
      const completions = [makeCompletion(7, THIS_WEEK_MON)];

      const result = computeWaterfall(goals, completions, NOW, 0, TZ);
      const a = result.goals.find(g => g.goalId === 'a')!;
      const b = result.goals.find(g => g.goalId === 'b')!;
      const c = result.goals.find(g => g.goalId === 'c')!;

      expect(a.allocated).toBe(5);
      expect(a.achieved).toBe(true);
      expect(b.allocated).toBe(2);
      expect(b.achieved).toBe(false);
      expect(c.allocated).toBe(0);
      expect(c.achieved).toBe(false);
    });
  });

  describe('recurring before non-recurring waterfall', () => {
    it('recurring goals consume points first, overflow goes to non-recurring', () => {
      const goals = [
        makeGoal({ id: 'recurring', pointCost: 6, priority: 1, recurring: true, recurrencePeriod: 'weekly' }),
        makeGoal({ id: 'savings', pointCost: 20, priority: 2, recurring: false }),
      ];
      // 10 points this week: recurring takes 6, 4 overflows to savings
      const completions = [makeCompletion(10, THIS_WEEK_MON)];

      const result = computeWaterfall(goals, completions, NOW, 0, TZ);
      const recurring = result.goals.find(g => g.goalId === 'recurring')!;
      const savings = result.goals.find(g => g.goalId === 'savings')!;

      expect(recurring.allocated).toBe(6);
      expect(recurring.achieved).toBe(true);
      expect(savings.allocated).toBe(4);
      expect(savings.achieved).toBe(false);
    });

    it('non-recurring goals accumulate overflow across multiple weeks', () => {
      const goals = [
        makeGoal({ id: 'weekly-chore', pointCost: 5, priority: 1, recurring: true, recurrencePeriod: 'weekly' }),
        makeGoal({ id: 'bike', pointCost: 10, priority: 2, recurring: false }),
      ];
      // Week 1: 8 pts (5 to recurring, 3 overflow to bike)
      // Week 2: 8 pts (5 to recurring, 3 overflow to bike → bike total = 6)
      const completions = [
        makeCompletion(8, LAST_WEEK_MON),
        makeCompletion(8, THIS_WEEK_MON),
      ];

      const result = computeWaterfall(goals, completions, NOW, 0, TZ);
      const bike = result.goals.find(g => g.goalId === 'bike')!;

      expect(bike.allocated).toBe(6); // 3 + 3
      expect(bike.achieved).toBe(false);
    });
  });

  describe('zero and edge point values', () => {
    it('skips completions with 0 points in week buckets', () => {
      const goal = makeGoal({ pointCost: 10, recurring: false });
      const completions = [
        makeCompletion(0, THIS_WEEK_MON),
        makeCompletion(5, THIS_WEEK_MON),
      ];

      const result = computeWaterfall([goal], completions, NOW, 0, TZ);
      expect(result.goals[0]!.allocated).toBe(5);
      // weeklyEarned still counts 0-point completions (they add 0)
      expect(result.weeklyEarned).toBe(5);
    });

    it('skips completions with negative points in week buckets', () => {
      const goal = makeGoal({ pointCost: 10, recurring: false });
      const completions = [
        makeCompletion(-3, THIS_WEEK_MON),
        makeCompletion(5, THIS_WEEK_MON),
      ];

      const result = computeWaterfall([goal], completions, NOW, 0, TZ);
      // weekBuckets skips pts <= 0, so only 5 goes into waterfall
      expect(result.goals[0]!.allocated).toBe(5);
      // But weeklyEarned counter includes negative points
      expect(result.weeklyEarned).toBe(2); // 5 + (-3)
    });

    it('handles goal with pointCost of 0 (always achieved)', () => {
      const goal = makeGoal({ pointCost: 0, recurring: false });
      const completions = [makeCompletion(5, THIS_WEEK_MON)];

      const result = computeWaterfall([goal], completions, NOW, 0, TZ);
      expect(result.goals[0]!.achieved).toBe(true);
      expect(result.goals[0]!.allocated).toBe(0);
    });
  });

  describe('many goals scenario', () => {
    it('distributes points across many goals by priority', () => {
      // 5 goals, priorities 1-5, each costing 3 points
      const goals = Array.from({ length: 5 }, (_, i) =>
        makeGoal({ id: `goal-${i + 1}`, pointCost: 3, priority: i + 1, recurring: false })
      );
      // 10 points: fills goal-1 (3), goal-2 (3), goal-3 (3), goal-4 gets 1
      const completions = [makeCompletion(10, THIS_WEEK_MON)];

      const result = computeWaterfall(goals, completions, NOW, 0, TZ);

      expect(result.goals.find(g => g.goalId === 'goal-1')!.achieved).toBe(true);
      expect(result.goals.find(g => g.goalId === 'goal-2')!.achieved).toBe(true);
      expect(result.goals.find(g => g.goalId === 'goal-3')!.achieved).toBe(true);
      expect(result.goals.find(g => g.goalId === 'goal-4')!.allocated).toBe(1);
      expect(result.goals.find(g => g.goalId === 'goal-5')!.allocated).toBe(0);
    });
  });

  describe('empty inputs', () => {
    it('handles no goals gracefully', () => {
      const result = computeWaterfall([], [makeCompletion(10, THIS_WEEK_MON)], NOW, 0, TZ);
      expect(result.goals).toEqual([]);
      expect(result.weeklyEarned).toBe(10);
    });

    it('handles no completions and no goals', () => {
      const result = computeWaterfall([], [], NOW, 0, TZ);
      expect(result.goals).toEqual([]);
      expect(result.weeklyEarned).toBe(0);
    });
  });

  describe('weekStartsOn parameter', () => {
    // NOW = 2026-02-16 (Monday)
    // With weekStartsOn=0 (Sunday): week runs Sun Feb 15 – Sat Feb 21
    // With weekStartsOn=1 (Monday): week runs Mon Feb 16 – Sun Feb 22

    it('weekStartsOn=0: Saturday completion counts in current week (Sun-Sat)', () => {
      // Saturday Feb 21 is within the Sun Feb 15 – Sat Feb 21 week
      const saturdayCompletion = at('2026-02-21T12:00');
      const completions = [makeCompletion(5, saturdayCompletion)];
      const goal = makeGoal({ pointCost: 10, recurring: false });

      // Use a "now" that is also in that week but after Saturday
      const nowSat = at('2026-02-21T18:00'); // Saturday evening
      const result = computeWaterfall([goal], completions, nowSat, 0, TZ);

      expect(result.weeklyEarned).toBe(5);
      expect(result.goals[0]!.allocated).toBe(5);
    });

    it('weekStartsOn=1: Sunday completion counts in current week (Mon-Sun)', () => {
      // Sunday Feb 22 is the last day of the Mon Feb 16 – Sun Feb 22 week
      const sundayCompletion = at('2026-02-22T12:00');
      const completions = [makeCompletion(5, sundayCompletion)];
      const goal = makeGoal({ pointCost: 10, recurring: false });

      const nowSun = at('2026-02-22T18:00'); // Sunday evening
      const result = computeWaterfall([goal], completions, nowSun, 1, TZ);

      expect(result.weeklyEarned).toBe(5);
      expect(result.goals[0]!.allocated).toBe(5);
    });

    it('weekly earned respects weekStartsOn boundary across different weeks', () => {
      // With weekStartsOn=0 (Sunday): Sun Feb 15 starts a new week
      // So Sat Feb 14 is in the PREVIOUS week, Sun Feb 15 starts the current week
      const satFeb14 = at('2026-02-14T12:00'); // Saturday
      const sunFeb15 = at('2026-02-15T12:00'); // Sunday

      const completions = [
        makeCompletion(3, satFeb14),
        makeCompletion(7, sunFeb15),
      ];
      const goal = makeGoal({ pointCost: 20, recurring: false });

      const result = computeWaterfall([goal], completions, NOW, 0, TZ);

      // With Sunday start: Sun Feb 15 is current week (7 pts), Sat Feb 14 is previous week (3 pts)
      expect(result.weeklyEarned).toBe(7);

      // With weekStartsOn=1 (Monday): Mon Feb 16 starts the current week
      // Both Sat Feb 14 and Sun Feb 15 are in the PREVIOUS week
      const result1 = computeWaterfall([goal], completions, NOW, 1, TZ);
      expect(result1.weeklyEarned).toBe(0);
    });

    it('recurring weekly goal resets based on weekStartsOn boundary', () => {
      // With weekStartsOn=0 (Sunday): week starts Sun Feb 15
      // With weekStartsOn=1 (Monday): week starts Mon Feb 16
      const sunFeb15 = at('2026-02-15T12:00'); // Sunday
      const monFeb16 = at('2026-02-16T12:00'); // Monday

      const goal = makeGoal({
        pointCost: 5,
        priority: 1,
        recurring: true,
        recurrencePeriod: 'weekly',
      });

      // weekStartsOn=0: Both Sunday and Monday are in the same current week (starting Sun Feb 15)
      const completions = [
        makeCompletion(3, sunFeb15),
        makeCompletion(3, monFeb16),
      ];
      const result0 = computeWaterfall([goal], completions, NOW, 0, TZ);
      // Both completions fall in the same week bucket (Sun Feb 15), total 6 pts, capped at 5
      expect(result0.goals[0]!.allocated).toBe(5);
      expect(result0.goals[0]!.achieved).toBe(true);

      // weekStartsOn=1: Sunday is PREVIOUS week, Monday is current week
      const result1 = computeWaterfall([goal], completions, NOW, 1, TZ);
      // Only Monday's 3 pts are in the current week bucket
      expect(result1.goals[0]!.allocated).toBe(3);
      expect(result1.goals[0]!.achieved).toBe(false);
    });
  });
});

describe('getGoalPeriodKey', () => {
  it('returns weekly period start for recurring weekly goal', () => {
    const goal = makeGoal({ recurring: true, recurrencePeriod: 'weekly' });
    const key = getGoalPeriodKey(goal, NOW, 0, TZ);
    expect(key).toBe('2026-02-15'); // Sunday (default weekStartsOn=0)
  });

  it('returns monthly period start for recurring monthly goal', () => {
    const goal = makeGoal({ recurring: true, recurrencePeriod: 'monthly' });
    const key = getGoalPeriodKey(goal, NOW, 0, TZ);
    expect(key).toBe('2026-02-01');
  });

  it('returns yearly period start for recurring yearly goal', () => {
    const goal = makeGoal({ recurring: true, recurrencePeriod: 'yearly' });
    const key = getGoalPeriodKey(goal, NOW, 0, TZ);
    expect(key).toBe('2026-01-01');
  });

  it('returns lastResetAt for non-recurring goal', () => {
    const resetDate = at('2026-01-15T10:00');
    const goal = makeGoal({ recurring: false, lastResetAt: resetDate });
    const key = getGoalPeriodKey(goal, NOW, 0, TZ);
    expect(key).toBe('2026-01-15');
  });
});

describe('household zone boundaries', () => {
  it('counts a Saturday-evening completion in that week, though it is Sunday in UTC', () => {
    // 20:00 CST on Saturday 21 Feb is 02:00 UTC on Sunday 22 Feb.
    const completions = [makeCompletion(5, at('2026-02-21T20:00'))];
    const result = computeWaterfall([makeGoal()], completions, at('2026-02-21T21:00'), 0, TZ);
    expect(result.weeklyEarned).toBe(5);
  });

  it('starts a new week at the household midnight, not UTC midnight', () => {
    // Sunday 22 Feb 00:30 in Tokyo is still Saturday in UTC.
    const tokyo = 'Asia/Tokyo';
    const now = zonedWallTimeToUtc('2026-02-22', '00:30', tokyo);
    const lastWeek = zonedWallTimeToUtc('2026-02-21', '23:30', tokyo);
    const thisWeek = zonedWallTimeToUtc('2026-02-22', '00:10', tokyo);
    const result = computeWaterfall(
      [makeGoal()],
      [makeCompletion(3, lastWeek), makeCompletion(4, thisWeek)],
      now,
      0,
      tokyo,
    );
    expect(result.weeklyEarned).toBe(4);
  });

  it('keys a goal period by the household date', () => {
    // 20:00 CST on 31 Jan is already 1 Feb in UTC: still January's period.
    const goal = makeGoal({ recurring: true, recurrencePeriod: 'monthly' });
    expect(getGoalPeriodKey(goal, at('2026-01-31T20:00'), 0, TZ)).toBe('2026-01-01');
  });
});
