/**
 * Pure functions that turn structured data into natural-language strings
 * for the Voice API's `spoken` field. Kept separate from route handlers so
 * they can be unit-tested without HTTP/DB plumbing.
 *
 * Times and days are spoken in the household zone, passed in by the route:
 * the server's own zone is UTC on a default install, which would read a 9 AM
 * Chicago event as "2 PM".
 */

import {
  calendarDaysBetween,
  dateOnlyToFloatingUtc,
  floatingUtcToDateKey,
  todayKey,
  wallTimeAt,
} from '@/lib/utils/zonedDate';

type SpeakableEvent = {
  title: string;
  /** An instant, or for an all-day event UTC midnight of its date. */
  startTime: Date;
  allDay: boolean;
};

/** "4 PM" or "12:30 PM" on the wall clock in `timeZone`. */
function formatTime(d: Date, timeZone: string): string {
  const [h, m] = wallTimeAt(timeZone, d).split(':').map(Number);
  const hour12 = ((h! + 11) % 12) + 1;
  const period = h! >= 12 ? 'PM' : 'AM';
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

/** The household date an event falls on: its own date if all-day. */
function eventDateKey(e: SpeakableEvent, timeZone: string): string {
  return e.allDay ? floatingUtcToDateKey(e.startTime) : todayKey(timeZone, e.startTime);
}

/** "Tuesday" or "May 5" for a date key, read without any zone. */
function dateKeyLabel(dateKey: string, style: 'weekday' | 'monthDay'): string {
  const options: Intl.DateTimeFormatOptions = style === 'weekday'
    ? { weekday: 'long', timeZone: 'UTC' }
    : { month: 'long', day: 'numeric', timeZone: 'UTC' };
  return dateOnlyToFloatingUtc(dateKey).toLocaleDateString('en-US', options);
}

/** Days of week for labels relative to today. */
function relativeDayLabel(targetKey: string, todayDateKey: string): string {
  const diffDays = calendarDaysBetween(todayDateKey, targetKey);

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays < 7) return `on ${dateKeyLabel(targetKey, 'weekday')}`;
  return `on ${dateKeyLabel(targetKey, 'monthDay')}`;
}

/** Joins a list with Oxford commas: ["a","b","c"] → "a, b, and c". */
function oxfordJoin(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  const last = parts[parts.length - 1];
  return `${parts.slice(0, -1).join(', ')}, and ${last}`;
}

export function phraseEventList(items: SpeakableEvent[], timeZone: string): string {
  if (items.length === 0) return 'You have no events today.';

  const parts = items.map((e) =>
    e.allDay ? `${e.title}, all day` : `${e.title} at ${formatTime(e.startTime, timeZone)}`
  );

  return `Today you have ${oxfordJoin(parts)}.`;
}

export function phraseUpcomingEvents(items: SpeakableEvent[], now: Date, timeZone: string): string {
  if (items.length === 0) return 'You have no upcoming events.';

  const today = todayKey(timeZone, now);
  const parts = items.map((e) => {
    const day = relativeDayLabel(eventDateKey(e, timeZone), today);
    if (e.allDay) return `${e.title} ${day}, all day`;
    return `${e.title} ${day} at ${formatTime(e.startTime, timeZone)}`;
  });

  return `Coming up: ${oxfordJoin(parts)}.`;
}

export function phraseTaskList(titles: string[]): string {
  if (titles.length === 0) return 'You have no tasks due today.';
  if (titles.length === 1) return `You have one task today: ${titles[0]}.`;
  return `You have ${titles.length} tasks today: ${oxfordJoin(titles)}.`;
}

export function phraseFamilyMembers(names: string[]): string {
  if (names.length === 0) return 'No family members are configured.';
  if (names.length === 1) return `Your family has ${names[0]}.`;
  return `Your family has ${oxfordJoin(names)}.`;
}

interface WeatherTodayInput {
  location: string;
  currentTemp: number;
  feelsLike: number;
  description: string;
  high: number | null;
  low: number | null;
  precipProbability: number | null;
}

export function phraseWeatherToday(w: WeatherTodayInput): string {
  const parts: string[] = [];
  parts.push(`${w.location}: currently ${w.currentTemp} degrees`);
  if (Math.abs(w.feelsLike - w.currentTemp) >= 3) parts.push(`feels like ${w.feelsLike}`);
  parts.push(w.description);
  if (w.high !== null && w.low !== null) parts.push(`high ${w.high}, low ${w.low}`);
  if (w.precipProbability !== null && w.precipProbability >= 30) {
    parts.push(`${w.precipProbability} percent chance of precipitation`);
  }
  return `${parts.join('. ')}.`;
}

interface SpeakableBusRoute {
  studentName: string;
  direction: 'AM' | 'PM';
  scheduledTime: string;
  prediction: {
    status: string;
    etaMinutes: number | null;
    lastCheckpointName: string | null;
  };
}

export function phraseBusStatus(routes: SpeakableBusRoute[], opts: { student?: string } = {}): string {
  if (routes.length === 0) {
    if (opts.student) return `No bus routes are scheduled for ${opts.student} today.`;
    return 'No bus routes are scheduled today.';
  }

  const lines = routes.map((r) => {
    const who = `${r.studentName} ${r.direction}`;
    switch (r.prediction.status) {
      case 'at_stop':
        return `${who}: arrived at the stop`;
      case 'at_school':
        return `${who}: arrived at school`;
      case 'overdue':
        return `${who}: overdue, scheduled ${r.scheduledTime}`;
      case 'in_transit':
        if (r.prediction.etaMinutes !== null) {
          return `${who}: ${r.prediction.etaMinutes} minutes away`;
        }
        return `${who}: in transit, last seen at ${r.prediction.lastCheckpointName ?? 'unknown'}`;
      case 'cold_start':
      case 'no_data':
      default:
        return `${who}: scheduled ${r.scheduledTime}, no live data yet`;
    }
  });

  return oxfordJoin(lines) + '.';
}

interface SpeakableBirthday {
  name: string;
  eventType: string;
  /** Date key (YYYY-MM-DD) of the next occurrence. */
  next: string;
  /** Whole calendar days from today to `next`. */
  daysUntil: number;
  turning: number | null;
}

/**
 * relativeDayLabel for a date key. Reads the date with the UTC getters so the
 * label names the date as stored, whatever zone the server runs in.
 */
function relativeDateKeyLabel(dateKey: string, daysUntil: number): string {
  if (daysUntil === 0) return 'today';
  if (daysUntil === 1) return 'tomorrow';
  const date = new Date(`${dateKey}T00:00:00Z`);
  if (daysUntil < 7) {
    return `on ${date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })}`;
  }
  return `on ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}`;
}

export function phraseUpcomingBirthdays(items: SpeakableBirthday[]): string {
  if (items.length === 0) return 'No upcoming birthdays.';

  const parts = items.map((b) => {
    const day = relativeDateKeyLabel(b.next, b.daysUntil);
    const what = b.eventType === 'birthday' ? 'birthday' : b.eventType;
    const turning = b.turning ? `, turning ${b.turning}` : '';
    return `${b.name}'s ${what} ${day}${turning}`;
  });

  if (items.length === 1) return `Coming up: ${parts[0]}.`;
  return `Coming up: ${oxfordJoin(parts)}.`;
}

type SpeakableMeal = {
  name: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
};

export function phraseTodayMeals(items: SpeakableMeal[]): string {
  if (items.length === 0) return 'No meals are planned for today.';

  const parts = items.map((m) => `${m.mealType}: ${m.name}`);
  if (items.length === 1) return `Today's plan is ${parts[0]}.`;
  return `Today's meals: ${oxfordJoin(parts)}.`;
}

export function phraseTodayChores(titles: string[], assigneeName: string | null = null): string {
  const who = assigneeName ?? 'You';
  if (titles.length === 0) {
    return assigneeName
      ? `${assigneeName} has no chores due today.`
      : 'No chores are due today.';
  }
  if (titles.length === 1) {
    return `${who} ${who === 'You' ? 'have' : 'has'} one chore today: ${titles[0]}.`;
  }
  const verb = who === 'You' ? 'have' : 'has';
  return `${who} ${verb} ${titles.length} chores today: ${oxfordJoin(titles)}.`;
}

type SpeakableMessage = {
  message: string;
  authorName: string | null;
  createdAt: Date;
};

/**
 * Past-leaning version of relativeDayLabel: messages are always already
 * sent, so "yesterday" / "on Friday" reads better than "tomorrow."
 */
function pastDayLabel(targetKey: string, todayDateKey: string): string {
  const diffDays = calendarDaysBetween(targetKey, todayDateKey);

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `on ${dateKeyLabel(targetKey, 'weekday')}`;
  return `on ${dateKeyLabel(targetKey, 'monthDay')}`;
}

export function phraseRecentMessages(items: SpeakableMessage[], now: Date, timeZone: string): string {
  if (items.length === 0) return 'No recent family messages.';

  const today = todayKey(timeZone, now);
  const lines = items.map((m) => {
    const day = pastDayLabel(todayKey(timeZone, m.createdAt), today);
    const who = m.authorName ? `${m.authorName} ${day}` : day;
    return `${who}: ${m.message}`;
  });

  if (items.length === 1) return `Latest message from ${lines[0]}.`;
  return `Recent messages: ${oxfordJoin(lines)}.`;
}
