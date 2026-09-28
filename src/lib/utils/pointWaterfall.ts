import {
  startOfMonthKey,
  startOfWeekKey,
  startOfYearKey,
  todayKey,
  zonedWallTimeToUtc,
} from './zonedDate';

interface GoalDef {
  id: string;
  pointCost: number;
  priority: number;
  recurring: boolean;
  recurrencePeriod?: 'weekly' | 'monthly' | 'yearly' | null;
  lastResetAt: Date;
}

interface Completion {
  pointsAwarded: number | null;
  completedAt: Date;
}

export interface GoalProgress {
  goalId: string;
  allocated: number;
  achieved: boolean;
}

export interface WaterfallResult {
  goals: GoalProgress[];
  weeklyEarned: number;
  monthlyEarned: number;
  yearlyEarned: number;
}

function periodStartKey(dateKey: string, period: 'weekly' | 'monthly' | 'yearly', weekStartsOn: 0 | 1): string {
  switch (period) {
    case 'weekly': return startOfWeekKey(dateKey, weekStartsOn);
    case 'monthly': return startOfMonthKey(dateKey);
    case 'yearly': return startOfYearKey(dateKey);
  }
}

export interface PeriodStarts {
  /** Date key of the first day of the current week. */
  weekKey: string;
  week: Date;
  month: Date;
  year: Date;
}

/**
 * The instants the current week, month and year began in `timeZone`: the
 * household's midnight, not the server's. Points earned at 20:00 on a
 * Saturday in Chicago belong to that week, though it is already Sunday UTC.
 */
export function currentPeriodStarts(now: Date, weekStartsOn: 0 | 1, timeZone: string): PeriodStarts {
  const today = todayKey(timeZone, now);
  const midnight = (key: string) => zonedWallTimeToUtc(key, '00:00', timeZone);
  const weekKey = startOfWeekKey(today, weekStartsOn);
  return {
    weekKey,
    week: midnight(weekKey),
    month: midnight(startOfMonthKey(today)),
    year: midnight(startOfYearKey(today)),
  };
}

/**
 * Compute the point waterfall for a single child.
 *
 * Goals are processed in ascending priority order. Each week's earned points
 * fill recurring goals first (they reset each period), then overflow into
 * non-recurring goals (which accumulate across weeks).
 *
 * Weeks, months and years are the household's, in `timeZone`.
 */
export function computeWaterfall(
  goals: GoalDef[],
  completions: Completion[],
  now: Date,
  weekStartsOn: 0 | 1,
  timeZone: string,
): WaterfallResult {
  const sorted = [...goals].sort((a, b) => a.priority - b.priority);

  // Compute counters
  const { weekKey, week: weekStart, month: monthStart, year: yearStart } =
    currentPeriodStarts(now, weekStartsOn, timeZone);

  let weeklyEarned = 0;
  let monthlyEarned = 0;
  let yearlyEarned = 0;

  for (const c of completions) {
    const pts = c.pointsAwarded ?? 0;
    if (c.completedAt >= weekStart) weeklyEarned += pts;
    if (c.completedAt >= monthStart) monthlyEarned += pts;
    if (c.completedAt >= yearStart) yearlyEarned += pts;
  }

  // Group completions by the household week they fell in
  const weekBuckets = new Map<string, number>();
  for (const c of completions) {
    const pts = c.pointsAwarded ?? 0;
    if (pts <= 0) continue;
    const wk = startOfWeekKey(todayKey(timeZone, c.completedAt), weekStartsOn);
    weekBuckets.set(wk, (weekBuckets.get(wk) || 0) + pts);
  }

  // Sort weeks chronologically
  const weeks = [...weekBuckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]));

  // Track non-recurring goal accumulation
  const nonRecurringAccum: Record<string, number> = {};
  for (const g of sorted) {
    if (!g.recurring) nonRecurringAccum[g.id] = 0;
  }

  // Process each week through the waterfall
  for (const [, weekPts] of weeks) {
    let remaining = weekPts;

    for (const goal of sorted) {
      if (remaining <= 0) break;

      if (goal.recurring) {
        // Recurring goals take from this week, reset each period
        const take = Math.min(remaining, goal.pointCost);
        remaining -= take;
      } else {
        // Non-recurring: accumulate across weeks, capped at pointCost
        const accum = nonRecurringAccum[goal.id] ?? 0;
        const needed = Math.max(0, goal.pointCost - accum);
        const take = Math.min(remaining, needed);
        remaining -= take;
        nonRecurringAccum[goal.id] = accum + take;
      }
    }
  }

  // Build result: current period progress for recurring, cumulative for non-recurring
  const currentWeekPts = weekBuckets.get(weekKey) || 0;

  // Re-run waterfall just for current week to get recurring goal progress
  let currentRemaining = currentWeekPts;
  const goalProgress: GoalProgress[] = [];

  for (const goal of sorted) {
    if (goal.recurring) {
      const take = Math.min(currentRemaining, goal.pointCost);
      currentRemaining -= take;
      goalProgress.push({
        goalId: goal.id,
        allocated: take,
        achieved: take >= goal.pointCost,
      });
    } else {
      const accum = nonRecurringAccum[goal.id] ?? 0;
      // Non-recurring also gets overflow from current week recurring goals
      // But this was already computed in the full loop above.
      goalProgress.push({
        goalId: goal.id,
        allocated: accum,
        achieved: accum >= goal.pointCost,
      });
    }
  }

  return { goals: goalProgress, weeklyEarned, monthlyEarned, yearlyEarned };
}

/**
 * Get the period start string for a goal (used for achievement records): a
 * date key in the household zone.
 */
export function getGoalPeriodKey(goal: GoalDef, now: Date, weekStartsOn: 0 | 1, timeZone: string): string {
  if (goal.recurring && goal.recurrencePeriod) {
    return periodStartKey(todayKey(timeZone, now), goal.recurrencePeriod, weekStartsOn);
  }
  return todayKey(timeZone, goal.lastResetAt);
}
