'use client';

import { useCallback } from 'react';
import { format, startOfWeek } from 'date-fns';
import { DAYS_OF_WEEK, type DayOfWeek } from '@/lib/constants/days';
import { useWeekStartsOn } from '@/lib/hooks/useWeekStartsOn';
import { useTimeFormat } from '@/components/providers';
import { moveEventToDay } from '@/lib/utils/eventMove';

interface UseWeekMutationsOptions {
  /** Called after a successful mutation to re-fetch upstream data. */
  refresh: () => Promise<void>;
}

interface UseWeekMutationsResult {
  moveChore: (choreId: string, targetDate: Date) => Promise<void>;
  moveTask: (taskId: string, targetDate: Date) => Promise<void>;
  moveMeal: (mealId: string, targetDate: Date) => Promise<void>;
  moveEvent: (
    event: { id: string; startTime: Date; endTime: Date; allDay: boolean },
    targetDate: Date,
  ) => Promise<void>;
}

async function patchJson(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `PATCH ${url} failed: ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data?.error === 'string') message = data.error;
    } catch { /* swallow */ }
    throw new Error(message);
  }
}

export function useWeekMutations({ refresh }: UseWeekMutationsOptions): UseWeekMutationsResult {
  const { weekStartsOn } = useWeekStartsOn();
  const { displayTimezone } = useTimeFormat();

  const moveChore = useCallback(
    async (choreId: string, targetDate: Date) => {
      await patchJson(`/api/chores/${choreId}`, {
        nextDue: format(targetDate, 'yyyy-MM-dd'),
      });
      await refresh();
    },
    [refresh],
  );

  const moveTask = useCallback(
    async (taskId: string, targetDate: Date) => {
      // A date alone: the server keeps the task's due time, if it has one.
      await patchJson(`/api/tasks/${taskId}`, {
        dueDate: format(targetDate, 'yyyy-MM-dd'),
      });
      await refresh();
    },
    [refresh],
  );

  const moveMeal = useCallback(
    async (mealId: string, targetDate: Date) => {
      const dayOfWeek = DAYS_OF_WEEK[targetDate.getDay()] as DayOfWeek;
      // Send weekOf alongside dayOfWeek so cross-week drags land on the
      // dropped date instead of snapping to the same dayOfWeek in the
      // meal's original week.
      const weekOf = format(startOfWeek(targetDate, { weekStartsOn }), 'yyyy-MM-dd');
      await patchJson(`/api/meals/${mealId}`, { dayOfWeek, weekOf });
      await refresh();
    },
    [refresh, weekStartsOn],
  );

  const moveEvent = useCallback(
    async (
      event: { id: string; startTime: Date; endTime: Date; allDay: boolean },
      targetDate: Date,
    ) => {
      // The grid day is a date; keep the event's time of day (see eventMove.ts).
      const moved = moveEventToDay(event, format(targetDate, 'yyyy-MM-dd'), displayTimezone);
      await patchJson(`/api/events/${event.id}`, {
        startTime: moved.startTime.toISOString(),
        endTime: moved.endTime.toISOString(),
      });
      await refresh();
    },
    [refresh, displayTimezone],
  );

  return { moveChore, moveTask, moveMeal, moveEvent };
}
