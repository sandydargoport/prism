import type { Meal, Chore, Task } from '@/types/models';
import type { TimeFormat } from '@/lib/utils/timeFormat';

/** Default times for each meal type when meal.mealTime is null. */
export const MEAL_TIME_DEFAULTS: Record<Meal['mealType'], string> = {
  breakfast: '07:00',
  lunch: '12:00',
  snack: '15:00',
  dinner: '18:00',
};

/**
 * Effective HH:mm time-of-day for a meal in time-grid views.
 * Falls back to a per-mealType default when the user hasn't set one.
 */
export function getMealTime(meal: Meal): string {
  return meal.mealTime ?? MEAL_TIME_DEFAULTS[meal.mealType];
}

/**
 * Effective HH:mm for a chore, or null when the chore has no time-of-day
 * (renders at the top of the day like an all-day item).
 */
export function getChoreTime(chore: Chore): string | null {
  return chore.nextDueTime ?? null;
}

/**
 * Effective HH:mm for a task. Tasks store a full timestamp; tasks moved
 * via the legacy 23:59:59 path are treated as "no time" so they don't all
 * stack in the last hour of the day.
 */
export function getTaskTime(task: Task): string | null {
  if (!task.dueDate) return null;
  const d = task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate);
  const h = d.getHours();
  const m = d.getMinutes();
  // 23:59 sentinel = "due today, no specific time" — treat as floating.
  if (h === 23 && m >= 58) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Parse "HH:mm" → minutes since midnight. Returns null on invalid input.
 */
export function parseTimeOfDay(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  return h * 60 + min;
}

/**
 * Format an "HH:mm" value for display using the family-wide time preference.
 * In 12-hour mode, on-the-hour times drop ":00" so the label remains compact.
 */
export function formatTimeOfDay(
  hhmm: string | null | undefined,
  timeFormat: TimeFormat = '12h',
): string {
  if (!hhmm) return '';
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min)) return hhmm;
  if (timeFormat === '24h') return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return min === 0 ? `${hour12} ${period}` : `${hour12}:${String(min).padStart(2, '0')} ${period}`;
}
