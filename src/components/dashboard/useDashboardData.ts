import { useCalendarEvents, useWeather, useMessages, useTasks, useChores, useShoppingLists, useMeals, useBirthdays, useLayouts, useGoals, usePoints } from '@/lib/hooks';

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
