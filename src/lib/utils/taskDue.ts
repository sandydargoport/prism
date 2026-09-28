/**
 * A task's due is a calendar date with an optional wall-clock time, the way a
 * chore's next_due and next_due_time are: `dueDate` is a `YYYY-MM-DD` date key
 * (a `date` column) and `dueTime` is `HH:mm` or null. Neither is an instant,
 * so a task due on the 28th is due on the 28th in whatever zone it is read.
 *
 * Usable on the server and the client (no DOM, no DB).
 */

import { format } from 'date-fns';
import { parseDateOnly, todayKey, wallTimeAt } from './zonedDate';

export type TaskDue = {
  dueDate: string | null;
  dueTime: string | null;
};

const TIME_RE = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;

/** `HH:mm` from `H:mm`, `HH:mm` or `HH:mm:ss`, or null if it is not a time. */
export function parseDueTime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = TIME_RE.exec(value.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${m[2]}`;
}

/**
 * Times that meant "no particular time" when the due was a timestamp: the
 * edit form and calendar drag wrote 23:59 or 23:59:59 for a date-only task,
 * and date-only values from providers arrived as midnight.
 */
export function isNoTimeSentinel(hhmm: string): boolean {
  return hhmm === '00:00' || hhmm >= '23:58';
}

/** The due for a wall-clock date and time, dropping a "no time" sentinel. */
export function wallDue(dateKey: string, hhmm: string | null): TaskDue {
  return { dueDate: dateKey, dueTime: hhmm && !isNoTimeSentinel(hhmm) ? hhmm : null };
}

/**
 * The due an instant means in `timeZone`, for values that still arrive as
 * timestamps: older API clients, and providers that send date-times.
 *
 * Exactly UTC midnight is a date-only value written as a timestamp (Google
 * Tasks does this, and so did Prism's add-task form), so it keeps the date
 * as written rather than moving to the previous evening west of UTC.
 */
export function dueFromInstant(instant: Date, timeZone: string): TaskDue {
  if (
    instant.getUTCHours() === 0 &&
    instant.getUTCMinutes() === 0 &&
    instant.getUTCSeconds() === 0 &&
    instant.getUTCMilliseconds() === 0
  ) {
    return { dueDate: instant.toISOString().slice(0, 10), dueTime: null };
  }
  return wallDue(todayKey(timeZone, instant), wallTimeAt(timeZone, instant));
}

export type TaskDueInput =
  | { ok: true; due: Partial<TaskDue> }
  | { ok: false; error: string };

/**
 * Read `dueDate` and `dueTime` from a request body. Only the fields the body
 * sets come back, so a PATCH can tell "leave it" (absent) from "clear it"
 * (null).
 *
 * `dueDate` is a date key, or null to clear the due (and its time). An ISO
 * date-time with an offset is still accepted from older clients and read as
 * a wall-clock due in `timeZone`. `dueTime` is `HH:mm` or null.
 */
export function parseTaskDueInput(
  body: { dueDate?: unknown; dueTime?: unknown },
  timeZone: string,
): TaskDueInput {
  const due: Partial<TaskDue> = {};

  if ('dueDate' in body && body.dueDate !== undefined) {
    const raw = body.dueDate;
    if (raw === null || raw === '') {
      return { ok: true, due: { dueDate: null, dueTime: null } };
    }
    if (typeof raw !== 'string') return { ok: false, error: 'Invalid dueDate format' };

    const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(raw.trim()) ? parseDateOnly(raw) : null;
    if (dateKey) {
      due.dueDate = dateKey;
    } else {
      const instant = /T.*(Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? new Date(raw) : null;
      if (!instant || Number.isNaN(instant.getTime())) {
        return { ok: false, error: 'Invalid dueDate format' };
      }
      Object.assign(due, dueFromInstant(instant, timeZone));
    }
  }

  if ('dueTime' in body && body.dueTime !== undefined) {
    if (body.dueTime === null || body.dueTime === '') {
      due.dueTime = null;
    } else {
      const time = parseDueTime(body.dueTime);
      if (!time) return { ok: false, error: 'Invalid dueTime format' };
      due.dueTime = time;
    }
  }

  return { ok: true, due };
}

/**
 * The due as a Date on the device's clock: the due time, or local midnight
 * for a date-only task. For display and comparison in the browser.
 */
export function dueLocalDate(dueDate: string, dueTime?: string | null): Date {
  const [y, m, d] = dueDate.split('-').map(Number);
  const [hh, mm] = (dueTime ?? '00:00').split(':').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0);
}

/**
 * Past due: a timed task once its time has passed, a date-only task from the
 * day after its date. A date-only task is not overdue on its own day.
 *
 * Read on the wall clock of `timeZone` (normally the display zone), or on the
 * device's clock without one.
 */
export function isTaskOverdue(
  task: { dueDate?: string | null; dueTime?: string | null },
  now: Date = new Date(),
  timeZone?: string,
): boolean {
  if (!task.dueDate) return false;
  if (timeZone) {
    try {
      const today = todayKey(timeZone, now);
      if (task.dueDate !== today) return task.dueDate < today;
      return task.dueTime ? task.dueTime < wallTimeAt(timeZone, now) : false;
    } catch {
      // An unknown zone name: fall through to the device's clock.
    }
  }
  if (task.dueTime) return dueLocalDate(task.dueDate, task.dueTime).getTime() < now.getTime();
  return task.dueDate < format(now, 'yyyy-MM-dd');
}

/**
 * Order by due: earlier dates first, timed tasks before date-only ones on the
 * same day, and tasks with no due last.
 */
export function compareTaskDue(
  a: { dueDate?: string | null; dueTime?: string | null },
  b: { dueDate?: string | null; dueTime?: string | null },
): number {
  if (!a.dueDate || !b.dueDate) return (a.dueDate ? 0 : 1) - (b.dueDate ? 0 : 1);
  const ka = `${a.dueDate} ${a.dueTime ?? '24:00'}`;
  const kb = `${b.dueDate} ${b.dueTime ?? '24:00'}`;
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}
