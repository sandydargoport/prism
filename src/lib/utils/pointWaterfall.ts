import { startOfWeek, startOfMonth, startOfYear, isBefore, addWeeks, addMonths, addYears, format } from 'date-fns';

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

function getPeriodStart(date: Date, period: 'weekly' | 'monthly' | 'yearly'): Date {
  switch (period) {
    case 'weekly': return startOfWeek(date, { weekStartsOn: 1 });
    case 'monthly': return startOfMonth(date);
    case 'yearly': return startOfYear(date);
  }
}

function getNextPeriodStart(date: Date, period: 'weekly' | 'monthly' | 'yearly'): Date {
  switch (period) {
    case 'weekly': return addWeeks(date, 1);
    case 'monthly': return addMonths(date, 1);
    case 'yearly': return addYears(date, 1);
  }
}

/**
 * Compute the point waterfall for a single child.
 *
 * Goals are processed in ascending priority order. Each week's earned points
 * fill recurring goals first (they reset each period), then overflow into
 * non-recurring goals (which accumulate across weeks).
 */
export function computeWaterfall(
  goals: GoalDef[],
  completions: Completion[],
  now: Date = new Date(),
): WaterfallResult {
  const sorted = [...goals].sort((a, b) => a.priority - b.priority);

  // Compute counters
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);

  let weeklyEarned = 0;
  let monthlyEarned = 0;
  let yearlyEarned = 0;

  for (const c of completions) {
    const pts = c.pointsAwarded ?? 0;
    if (c.completedAt >= weekStart) weeklyEarned += pts;
    if (c.completedAt >= monthStart) monthlyEarned += pts;
    if (c.completedAt >= yearStart) yearlyEarned += pts;
  }

  // Group completions by week (Monday-based)
  const weekBuckets = new Map<string, number>();
  for (const c of completions) {
    const pts = c.pointsAwarded ?? 0;
    if (pts <= 0) continue;
    const wk = format(startOfWeek(c.completedAt, { weekStartsOn: 1 }), 'yyyy-MM-dd');
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
  const currentWeekKey = format(weekStart, 'yyyy-MM-dd');
  const currentWeekPts = weekBuckets.get(currentWeekKey) || 0;

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
 * Get the period start string for a goal (used for achievement records).
 */
export function getGoalPeriodKey(goal: GoalDef, now: Date = new Date()): string {
  if (goal.recurring && goal.recurrencePeriod) {
    return format(getPeriodStart(now, goal.recurrencePeriod), 'yyyy-MM-dd');
  }
  return format(goal.lastResetAt, 'yyyy-MM-dd');
}
