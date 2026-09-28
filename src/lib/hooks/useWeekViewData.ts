'use client';

import { useMemo } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
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
import { floatingUtcToDateKey } from '@/lib/utils/zonedDate';
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
  // nextDue is a YYYY-MM-DD date column. Compare it as a date key: parsed with
  // new Date() it is UTC midnight, the previous evening west of UTC.
  return !!chore.nextDue && chore.nextDue.slice(0, 10) === format(day, 'yyyy-MM-dd');
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
        .filter((t) => t.dueDate === format(date, 'yyyy-MM-dd'))
        .sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2 } as const;
          return order[a.priority] - order[b.priority];
        });

      // forecast.date is UTC midnight of the forecast's date: compare dates,
      // not local days, or the weather sits a column early west of UTC.
      const dayWeather = weather?.forecast.find((f) => floatingUtcToDateKey(f.date) === format(date, 'yyyy-MM-dd'));

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
