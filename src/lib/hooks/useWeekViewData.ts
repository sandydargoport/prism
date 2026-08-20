'use client';

import { useMemo } from 'react';
import { addDays, format, isSameDay, startOfWeek } from 'date-fns';
import { useCalendarEvents } from './useCalendarEvents';
import { useMeals } from './useMeals';
import { useChores } from './useChores';
import { useTasks } from './useTasks';
import { useWeather } from './useWeather';
import { DAYS_OF_WEEK, type DayOfWeek } from '@/lib/constants/days';
import type { CalendarEvent } from '@/types/calendar';
import type { Chore, Meal } from '@/types';
import type { Task } from '@/components/widgets/TasksWidget';
import type { ForecastDay } from '@/components/widgets/WeatherWidget';
import { useTimeFormat } from '@/components/providers';
import { eventOccursOnDisplayDay } from '@/lib/utils/timeFormat';

export interface DayBucket {
  date: Date;
  /** Lowercased day name, e.g. 'monday' */
  dayOfWeek: DayOfWeek;
  /** Calendar events that span the entire day (or multi-day) */
  allDayEvents: CalendarEvent[];
  /** Calendar events with a specific time */
  timedEvents: CalendarEvent[];
  /** Meals planned for this day, sorted by mealType (breakfast → snack) */
  meals: Meal[];
  /** Chores due on this day */
  chores: Chore[];
  /** Tasks due on this day */
  tasks: Task[];
  /** Weather forecast for this day, if available */
  weather?: ForecastDay;
}

interface UseWeekViewDataOptions {
  /** Start date of the week (date-only; time is ignored) */
  weekStart: Date;
  /** First day of the week: 0 = Sunday, 1 = Monday */
  weekStartsOn: 0 | 1;
}

interface UseWeekViewDataResult {
  days: DayBucket[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const MEAL_TYPE_ORDER: Record<Meal['mealType'], number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
  snack: 3,
};

function eventOnDay(event: CalendarEvent, day: Date, displayTimezone: string): boolean {
  return eventOccursOnDisplayDay(
    event.startTime,
    event.endTime,
    event.allDay,
    day,
    displayTimezone,
  );
}

function choreNextDueOnDay(chore: Chore, day: Date): boolean {
  if (!chore.nextDue) return false;
  // nextDue is stored as YYYY-MM-DD or ISO; compare on date-only basis
  const due = new Date(chore.nextDue);
  if (Number.isNaN(due.getTime())) return false;
  return isSameDay(due, day);
}

export function useWeekViewData({
  weekStart,
  weekStartsOn,
}: UseWeekViewDataOptions): UseWeekViewDataResult {
  const { displayTimezone } = useTimeFormat();
  // Normalize to start-of-week for stable identity
  const normalizedStart = useMemo(
    () => startOfWeek(weekStart, { weekStartsOn }),
    [weekStart, weekStartsOn],
  );

  const weekOfString = useMemo(
    () => format(normalizedStart, 'yyyy-MM-dd'),
    [normalizedStart],
  );

  const { events, loading: eventsLoading, error: eventsError, refresh: refreshEvents } =
    useCalendarEvents({ daysToShow: 14 });
  const { meals, loading: mealsLoading, error: mealsError, refresh: refreshMeals } =
    useMeals({ weekOf: weekOfString });
  const { chores, loading: choresLoading, error: choresError, refresh: refreshChores } =
    useChores({ enabled: true });
  const { tasks, loading: tasksLoading, error: tasksError, refresh: refreshTasks } =
    useTasks({ showCompleted: true });
  const { data: weather } = useWeather();

  const days = useMemo<DayBucket[]>(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(normalizedStart, i);
      const dayOfWeek = DAYS_OF_WEEK[date.getDay()] as DayOfWeek;

      const dayEvents = events.filter((e) => eventOnDay(e, date, displayTimezone));
      const allDayEvents = dayEvents.filter((e) => e.allDay).sort((a, b) =>
        a.startTime.getTime() - b.startTime.getTime(),
      );
      const timedEvents = dayEvents.filter((e) => !e.allDay).sort((a, b) =>
        a.startTime.getTime() - b.startTime.getTime(),
      );

      const dayMeals = (meals ?? [])
        .filter((m) => m.dayOfWeek === dayOfWeek)
        .sort((a, b) => MEAL_TYPE_ORDER[a.mealType] - MEAL_TYPE_ORDER[b.mealType]);

      const dayChores = chores
        .filter((c) => choreNextDueOnDay(c, date))
        .sort((a, b) => a.title.localeCompare(b.title));

      const dayTasks = (tasks ?? [])
        .filter((t) => t.dueDate && isSameDay(t.dueDate, date))
        .sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2 } as const;
          return order[a.priority] - order[b.priority];
        });

      const dayWeather = weather?.forecast.find((f) => isSameDay(f.date, date));

      return {
        date,
        dayOfWeek,
        allDayEvents,
        timedEvents,
        meals: dayMeals,
        chores: dayChores,
        tasks: dayTasks,
        weather: dayWeather,
      };
    });
  }, [normalizedStart, events, meals, chores, tasks, weather, displayTimezone]);

  const loading = eventsLoading || mealsLoading || choresLoading || tasksLoading;
  const error = eventsError || mealsError || choresError || tasksError;

  const refresh = async () => {
    await Promise.all([refreshEvents(), refreshMeals(), refreshChores(), refreshTasks()]);
  };

  return { days, loading, error, refresh };
}
