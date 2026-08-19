'use client';

import { useMemo } from 'react';
import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import { useCalendarEvents } from './useCalendarEvents';
import { useMeals } from './useMeals';
import { useChores } from './useChores';
import { useTasks } from './useTasks';
import { useWeather } from './useWeather';
import { DAYS_OF_WEEK, type DayOfWeek } from '@/lib/constants/days';
import type { CalendarEvent } from '@/types/calendar';
import type { Chore, Meal } from '@/types';
import type { Task } from '@/components/widgets/TasksWidget';
import type { DayBucket } from './useWeekViewData';
import { useTimeFormat } from '@/components/providers';
import { toDisplayDate } from '@/lib/utils/timeFormat';

export interface OverlayFlags {
  events: boolean;
  meals: boolean;
  chores: boolean;
  tasks: boolean;
}

interface UseDayBucketsForRangeOptions {
  /** Inclusive start date (date-only; time ignored) */
  from: Date;
  /** Inclusive end date (date-only; time ignored) */
  to: Date;
  /** Streams to fetch. Disabled streams are skipped to save polling overhead. */
  overlays: OverlayFlags;
  /** Pre-fetched events from the parent — when provided, skip the events fetch and use these. */
  externalEvents?: CalendarEvent[];
}

interface UseDayBucketsForRangeResult {
  bucketsByDate: Map<string, DayBucket>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// Chronological order matching MEAL_TIME_DEFAULTS in cells/itemTime.ts
// (07:00 → 12:00 → 15:00 → 18:00) and CalendarView.tsx's sortMealsByType.
// Keep these in sync — CalendarWidget passes bucketsByDate straight to its
// views without re-sorting, so the order from this hook is what users see.
const MEAL_TYPE_ORDER: Record<Meal['mealType'], number> = {
  breakfast: 0,
  lunch: 1,
  snack: 2,
  dinner: 3,
};

const EMPTY_EVENTS: CalendarEvent[] = [];
const EMPTY_MEALS: Meal[] = [];
const EMPTY_CHORES: Chore[] = [];
const EMPTY_TASKS: Task[] = [];

function dateKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function eventOnDay(event: CalendarEvent, day: Date, displayTimezone: string): boolean {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  const eventStart = toDisplayDate(event.startTime, displayTimezone);
  const eventEnd = toDisplayDate(event.endTime, displayTimezone);
  return eventStart < dayEnd && eventEnd > dayStart;
}

function choreNextDueOnDay(chore: Chore, day: Date): boolean {
  if (!chore.nextDue) return false;
  // chore.nextDue is a YYYY-MM-DD DATE column; parse as local to avoid the
  // UTC-shift bug that would otherwise put the chore on the previous day.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(chore.nextDue);
  if (!m) return false;
  const due = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(due.getTime())) return false;
  return isSameDay(due, day);
}

/**
 * Returns a Map keyed by `yyyy-MM-dd` of DayBucket objects covering the range
 * [from, to] inclusive. Streams disabled in `overlays` are not fetched.
 *
 * Meals are loaded without a weekOf filter (the API caches the full set), so
 * cross-week ranges (month / multi-week / agenda) all see meals correctly.
 */
export function useDayBucketsForRange({
  from,
  to,
  overlays,
  externalEvents,
}: UseDayBucketsForRangeOptions): UseDayBucketsForRangeResult {
  const { displayTimezone } = useTimeFormat();
  const fromKey = useMemo(() => dateKey(from), [from]);
  const toKey = useMemo(() => dateKey(to), [to]);

  // Use external events when provided (CalendarView already fetches events
  // with its own filter set). Otherwise fetch internally.
  const fetchEvents = externalEvents === undefined && overlays.events;
  const {
    events: ownEvents,
    loading: eventsLoading,
    error: eventsError,
    refresh: refreshEvents,
  } = useCalendarEvents({ daysToShow: 60, enabled: fetchEvents });

  const events = externalEvents ?? (fetchEvents ? ownEvents : EMPTY_EVENTS);

  const {
    meals,
    loading: mealsLoading,
    error: mealsError,
    refresh: refreshMeals,
  } = useMeals({ enabled: overlays.meals });

  const {
    chores,
    loading: choresLoading,
    error: choresError,
    refresh: refreshChores,
  } = useChores({ enabled: overlays.chores, includeFuture: true });

  const {
    tasks,
    loading: tasksLoading,
    error: tasksError,
    refresh: refreshTasks,
  // showCompleted: true — completed tasks render muted/strikethrough via
  // OverlayItemsCell's muted={task.completed} → WeekItemCard styling, matching
  // how cooked meals stay visible. Hiding them outright was a usability gap
  // (a task you completed today disappears entirely from the calendar).
  } = useTasks({ showCompleted: true, enabled: overlays.tasks });

  const { data: weather } = useWeather();

  const bucketsByDate = useMemo<Map<string, DayBucket>>(() => {
    const map = new Map<string, DayBucket>();
    const start = startOfDay(from);
    const end = startOfDay(to);

    const safeMeals = overlays.meals ? meals ?? EMPTY_MEALS : EMPTY_MEALS;
    const safeChores = overlays.chores ? chores ?? EMPTY_CHORES : EMPTY_CHORES;
    const safeTasks = overlays.tasks ? tasks ?? EMPTY_TASKS : EMPTY_TASKS;

    let cursor = start;
    let safety = 0;
    while (cursor <= end && safety < 366) {
      const date = cursor;
      const dayOfWeek = DAYS_OF_WEEK[date.getDay()] as DayOfWeek;
      const key = dateKey(date);

      const dayEvents = overlays.events
        ? events.filter((e) => eventOnDay(e, date, displayTimezone))
        : EMPTY_EVENTS;
      const allDayEvents = dayEvents
        .filter((e) => e.allDay)
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      const timedEvents = dayEvents
        .filter((e) => !e.allDay)
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

      const dayMeals = safeMeals
        .filter((m) => m.dayOfWeek === dayOfWeek)
        .filter((m) => isMealForWeek(m, date))
        .sort((a, b) => MEAL_TYPE_ORDER[a.mealType] - MEAL_TYPE_ORDER[b.mealType]);

      const dayChores = safeChores
        .filter((c) => choreNextDueOnDay(c, date))
        .sort((a, b) => a.title.localeCompare(b.title));

      const dayTasks = safeTasks
        .filter((t) => t.dueDate && isSameDay(t.dueDate, date))
        .sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2 } as const;
          return order[a.priority] - order[b.priority];
        });

      const dayWeather = weather?.forecast.find((f) => isSameDay(f.date, date));

      map.set(key, {
        date,
        dayOfWeek,
        allDayEvents,
        timedEvents,
        meals: dayMeals,
        chores: dayChores,
        tasks: dayTasks,
        weather: dayWeather,
      });

      cursor = addDays(cursor, 1);
      safety += 1;
    }

    return map;
    // fromKey/toKey trigger recompute on actual date changes, not Date identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromKey, toKey, events, meals, chores, tasks, weather, overlays.events, overlays.meals, overlays.chores, overlays.tasks, displayTimezone]);

  const loading =
    (overlays.events && fetchEvents && eventsLoading) ||
    (overlays.meals && mealsLoading) ||
    (overlays.chores && choresLoading) ||
    (overlays.tasks && tasksLoading);

  const error =
    (overlays.events && fetchEvents ? eventsError : null) ||
    (overlays.meals ? mealsError : null) ||
    (overlays.chores ? choresError : null) ||
    (overlays.tasks ? tasksError : null);

  const refresh = async () => {
    const promises: Promise<unknown>[] = [];
    if (fetchEvents && overlays.events) promises.push(refreshEvents());
    if (overlays.meals) promises.push(refreshMeals());
    if (overlays.chores) promises.push(refreshChores());
    if (overlays.tasks) promises.push(refreshTasks());
    await Promise.all(promises);
  };

  return { bucketsByDate, loading: Boolean(loading), error: error ?? null, refresh };
}

/**
 * A meal's `weekOf` is the YYYY-MM-DD of the week start (Sun or Mon, depending
 * on settings). For a given target date we accept the meal if the date falls
 * within the 7-day window starting at `weekOf`.
 */
function isMealForWeek(meal: Meal, date: Date): boolean {
  if (!meal.weekOf) return false;
  // weekOf is a YYYY-MM-DD DATE column. `new Date('YYYY-MM-DD')` parses as
  // UTC midnight, which shifts the day backwards in any negative-UTC timezone
  // and lands the meal in last week. Parse as a LOCAL calendar date instead.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(meal.weekOf);
  if (!m) return false;
  const weekStart = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(weekStart.getTime())) return false;
  const weekEnd = addDays(weekStart, 7);
  return date >= weekStart && date < weekEnd;
}
