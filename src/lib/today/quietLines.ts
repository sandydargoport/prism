/**
 * The quiet lines on Today (#911): what is left to do, and a birthday nudge.
 * Pure, so the rules are tested without a screen.
 */

export interface ChoreLike {
  id: string;
  title: string;
  enabled: boolean;
  nextDue?: string | null;
  pendingApproval?: unknown;
  assignedTo?: { id: string; name: string; color: string } | null;
}

/**
 * Chores left today: enabled, due today or earlier, and not already waiting
 * for a parent. A done chore has moved its next due date on, so it drops out.
 */
export function choresLeft<T extends ChoreLike>(chores: T[], todayKey: string): T[] {
  return chores.filter((c) => c.enabled && !c.pendingApproval && !!c.nextDue && c.nextDue.slice(0, 10) <= todayKey);
}

export interface BirthdayLike {
  id: string;
  name: string;
  eventType: string;
  age: number | null;
  daysUntil: number;
  nextBirthday: string;
}

export const NUDGE = {
  /** How far ahead a birthday is offered. */
  daysAhead: 7,
  /** The card is due this many days before the day. */
  cardDaysBefore: 3,
  /** Not offered from this hour; back in the morning. */
  quietFromHour: 20,
} as const;

export interface Nudge {
  birthdayId: string;
  name: string;
  age: number | null;
  /** Days until the birthday. */
  daysUntil: number;
  /** Days from today until the card should be in the mail (at least 1). */
  mailInDays: number;
}

/**
 * The one birthday to nudge about: the nearest within a week that has not been
 * put off, while there is still time to mail a card (two days or more), and
 * not in the evening.
 */
export function birthdayNudge(
  birthdays: BirthdayLike[],
  opts: { hour: number; putOff: (b: BirthdayLike) => boolean },
): Nudge | null {
  if (opts.hour >= NUDGE.quietFromHour) return null;
  const next = birthdays
    .filter((b) => b.eventType === 'birthday' && b.daysUntil >= 2 && b.daysUntil <= NUDGE.daysAhead && !opts.putOff(b))
    .sort((a, b) => a.daysUntil - b.daysUntil)[0];
  if (!next) return null;
  return {
    birthdayId: next.id,
    name: next.name,
    age: next.age,
    daysUntil: next.daysUntil,
    mailInDays: Math.max(1, next.daysUntil - NUDGE.cardDaysBefore),
  };
}
