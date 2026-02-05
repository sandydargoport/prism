'use client';

import type { useDashboardData } from './useDashboardData';

interface ModalSetters {
  setShowAddTask: (v: boolean) => void;
  setShowAddMessage: (v: boolean) => void;
  setShowAddChore: (v: boolean) => void;
  setShowAddShopping: (v: boolean) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RequireAuthFn = (prompt: string, title?: string) => Promise<any>;

export function buildWidgetProps(
  data: ReturnType<typeof useDashboardData>,
  requireAuth: RequireAuthFn,
  modals: ModalSetters,
  weatherLocation: string,
): Record<string, Record<string, unknown>> {
  return {
    clock: {},
    weather: {
      location: weatherLocation,
      data: data.weather.data || undefined,
      loading: data.weather.loading,
      error: data.weather.error,
    },
    calendar: {
      events: data.calendar.events.length > 0 ? data.calendar.events : undefined,
      loading: data.calendar.loading,
      error: data.calendar.error,
      initialView: '3days',
      maxEventsPerDay: 4,
      onEventClick: (_event: unknown) => {},
      titleHref: '/calendar',
    },
    tasks: {
      tasks: data.tasks.tasks,
      maxTasks: 6,
      loading: data.tasks.loading,
      error: data.tasks.error,
      onTaskToggle: async (taskId: string, completed: boolean) => {
        const user = await requireAuth("Who's completing this task?");
        if (user) data.tasks.toggleTask(taskId, completed);
      },
      onAddClick: async () => {
        const user = await requireAuth("Who's adding a task?");
        if (user) modals.setShowAddTask(true);
      },
      titleHref: '/tasks',
    },
    messages: {
      messages: data.messages.messages,
      maxMessages: 5,
      loading: data.messages.loading,
      error: data.messages.error,
      onAddClick: async () => {
        const user = await requireAuth("Who's posting?");
        if (user) modals.setShowAddMessage(true);
      },
      onMessageClick: (_message: unknown) => {},
      onDeleteClick: async (messageId: string) => {
        const user = await requireAuth("Who's deleting this?");
        if (user) data.messages.deleteMessage(messageId);
      },
    },
    chores: {
      chores: data.chores.chores,
      maxChores: 6,
      loading: data.chores.loading,
      error: data.chores.error,
      onChoreComplete: async (choreId: string) => {
        const user = await requireAuth("Who's completing this chore?");
        if (!user) return;
        try {
          const chore = data.chores.chores.find((c: { id: string }) => c.id === choreId);
          if (chore?.pendingApproval && user.role === 'parent') {
            await data.chores.approveChore(choreId, chore.pendingApproval.completionId);
          } else {
            await data.chores.completeChore(choreId, { completedBy: user.id });
          }
          data.chores.refresh();
        } catch (err) {
          console.error('Failed to complete chore:', err);
        }
      },
      onAddClick: async () => {
        const user = await requireAuth("Who's adding a chore?");
        if (user) modals.setShowAddChore(true);
      },
      titleHref: '/chores',
    },
    shopping: {
      lists: data.shopping.lists,
      loading: data.shopping.loading,
      error: data.shopping.error,
      onItemToggle: (itemId: string, checked: boolean) => data.shopping.toggleItem(itemId, checked),
      onAddClick: async () => {
        const user = await requireAuth("Who's adding an item?");
        if (user) modals.setShowAddShopping(true);
      },
      titleHref: '/shopping',
    },
    birthdays: {
      birthdays: data.birthdays.birthdays,
      loading: data.birthdays.loading,
      error: data.birthdays.error,
      onSyncClick: data.birthdays.syncFromGoogle,
    },
    meals: {
      meals: data.meals.meals,
      loading: data.meals.loading,
      error: data.meals.error,
      onMarkCooked: async (mealId: string) => {
        const user = await requireAuth("Who cooked this?");
        if (user) await data.meals.markCooked(mealId, user.id);
      },
      onUnmarkCooked: async (mealId: string) => {
        try {
          await fetch(`/api/meals/${mealId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookedBy: null }),
          });
          data.meals.refresh();
        } catch { /* ignore */ }
      },
      onAddMeal: async (meal: Record<string, unknown>) => {
        const user = await requireAuth("Who's planning this meal?");
        if (!user) return;
        try {
          await fetch('/api/meals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...meal, createdBy: user.id }),
          });
          data.meals.refresh();
        } catch { /* ignore */ }
      },
      titleHref: '/meals',
    },
  };
}
