/**
 * Reminders (#1109): a reminder is a chore with a time and no points or
 * approval. These rules are shared by the API and the pages.
 */

import { getDisplayDateKey } from './timeFormat';
import { wallTimeAt } from './zonedDate';

export type ChoreKind = 'chore' | 'reminder';

interface RuleInput {
  kind?: ChoreKind;
  pointValue?: number;
  requiresApproval?: boolean;
  nextDueTime?: string | null;
}

/**
 * What to save for a create or update: a reminder always gets 0 points and
 * no approval, whatever was sent, and must have a time. `stored` is the row
 * being updated, for the fields the update leaves out.
 */
export function applyReminderRules<T extends RuleInput>(
  data: T,
  stored?: { kind: string; nextDueTime: string | null },
): { ok: true; data: T } | { ok: false; error: string } {
  const kind = data.kind ?? stored?.kind ?? 'chore';
  if (kind !== 'reminder') return { ok: true, data };
  const time = 'nextDueTime' in data && data.nextDueTime !== undefined ? data.nextDueTime : stored?.nextDueTime;
  if (!time) return { ok: false, error: 'A reminder needs a time' };
  return { ok: true, data: { ...data, pointValue: 0, requiresApproval: false } };
}

/**
 * Late: a chore or reminder with a time, still open, whose time has passed
 * today or whose day has gone. `today` is YYYY-MM-DD and `now` HH:mm, both
 * in the household's time zone. Open means not done for the day and not
 * waiting for approval; the caller passes only open ones.
 */
export function isLate(
  c: { nextDue?: string | null; nextDueTime?: string | null },
  today: string,
  now: string,
): boolean {
  if (!c.nextDue || !c.nextDueTime) return false;
  const due = c.nextDue.slice(0, 10);
  return due < today || (due === today && now >= c.nextDueTime);
}

/**
 * The household's date (YYYY-MM-DD) and time (HH:mm) at `now`, for isLate.
 * `timeZone` is the display zone from useTimeFormat; without one, or with one
 * that is not valid, the device's clock.
 */
export function householdClock(timeZone?: string, now: Date = new Date()): { today: string; now: string } {
  return { today: getDisplayDateKey(now, timeZone), now: wallTime(now, timeZone) };
}

/** HH:mm of `instant` in `timeZone`, or on the device clock. */
function wallTime(instant: Date, timeZone?: string): string {
  if (timeZone) {
    try {
      return wallTimeAt(timeZone, instant);
    } catch {
      // An unknown zone name: fall through to the device's clock.
    }
  }
  return `${String(instant.getHours()).padStart(2, '0')}:${String(instant.getMinutes()).padStart(2, '0')}`;
}

/** "7:00 PM" from "19:00". */
export function formatReminderTime(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * A pet chore's ticks today as one line (#856): "Emma 7:40 AM, Jordan 5:15 PM",
 * on the household's wall clock (`timeZone`, the display zone). Empty when nobody has done it yet today.
 */
export function petTickLine(
  ticks: Array<{ at: string; by: { name: string } }> | undefined,
  timeZone?: string,
): string {
  return (ticks ?? []).map((k) => `${k.by.name} ${formatReminderTime(wallTime(new Date(k.at), timeZone))}`).join(', ');
}
