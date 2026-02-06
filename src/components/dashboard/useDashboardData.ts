import { useEffect, useCallback, useRef } from 'react';
import { useCalendarEvents, useWeather, useMessages, useTasks, useChores, useShoppingLists, useMeals, useBirthdays, useLayouts, useGoals, usePoints } from '@/lib/hooks';

const AUTO_SYNC_STALE_MINUTES = 5;
const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

export function useDashboardData() {
  const {
    events: calendarEvents,
    loading: calendarLoading,
    error: calendarError,
  } = useCalendarEvents({ daysToShow: 30 });

  const {
    data: weatherData,
    loading: weatherLoading,
    error: weatherError,
  } = useWeather({});

  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    refresh: refreshMessages,
    deleteMessage,
  } = useMessages({ limit: 10 });

  const {
    tasks,
    loading: tasksLoading,
    error: tasksError,
    refresh: refreshTasks,
    toggleTask,
  } = useTasks({ showCompleted: true, limit: 20 });

  const {
    chores,
    loading: choresLoading,
    error: choresError,
    refresh: refreshChores,
    completeChore,
    approveChore,
  } = useChores({ showDisabled: false });

  const {
    lists: shoppingLists,
    loading: shoppingLoading,
    error: shoppingError,
    refresh: refreshShopping,
    toggleItem: toggleShoppingItem,
  } = useShoppingLists({});

  const {
    meals,
    loading: mealsLoading,
    error: mealsError,
    refresh: refreshMeals,
    markCooked,
  } = useMeals({});

  const {
    birthdays: birthdaysList,
    loading: birthdaysLoading,
    error: birthdaysError,
    syncFromGoogle: syncBirthdays,
  } = useBirthdays({ limit: 8 });

  const {
    goals: goalsList,
    progress: goalsProgress,
    goalChildren,
    loading: goalsLoading,
    error: goalsError,
  } = useGoals();

  const {
    points: pointsList,
    loading: pointsLoading,
    error: pointsError,
  } = usePoints();

  const {
    layouts: allLayouts,
    activeLayout: savedLayout,
    saveLayout,
    deleteLayout,
    loading: layoutsLoading,
  } = useLayouts();

  // Auto-sync task sources when dashboard is visible
  const lastAutoSyncRef = useRef<number>(0);

  const autoSyncTasks = useCallback(async () => {
    const now = Date.now();
    if (now - lastAutoSyncRef.current < AUTO_SYNC_INTERVAL_MS) return;

    try {
      const res = await fetch(`/api/task-sources/sync-all?staleMinutes=${AUTO_SYNC_STALE_MINUTES}`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.synced > 0) {
          refreshTasks();
        }
        lastAutoSyncRef.current = now;
      }
    } catch {
      // Silently fail auto-sync
    }
  }, [refreshTasks]);

  // Auto-sync on mount and periodically
  useEffect(() => {
    autoSyncTasks();

    const interval = setInterval(() => {
      if (!document.hidden) {
        autoSyncTasks();
      }
    }, AUTO_SYNC_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        autoSyncTasks();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [autoSyncTasks]);

  return {
    calendar: { events: calendarEvents, loading: calendarLoading, error: calendarError },
    weather: { data: weatherData, loading: weatherLoading, error: weatherError },
    messages: { messages, loading: messagesLoading, error: messagesError, refresh: refreshMessages, deleteMessage },
    tasks: { tasks, loading: tasksLoading, error: tasksError, refresh: refreshTasks, toggleTask },
    chores: { chores, loading: choresLoading, error: choresError, refresh: refreshChores, completeChore, approveChore },
    shopping: { lists: shoppingLists, loading: shoppingLoading, error: shoppingError, refresh: refreshShopping, toggleItem: toggleShoppingItem },
    meals: { meals, loading: mealsLoading, error: mealsError, refresh: refreshMeals, markCooked },
    birthdays: { birthdays: birthdaysList, loading: birthdaysLoading, error: birthdaysError, syncFromGoogle: syncBirthdays },
    points: { points: pointsList, goals: goalsList, progress: goalsProgress, goalChildren, loading: pointsLoading || goalsLoading, error: pointsError || goalsError },
    layouts: { allLayouts, savedLayout, saveLayout, deleteLayout, loading: layoutsLoading },
  };
}
