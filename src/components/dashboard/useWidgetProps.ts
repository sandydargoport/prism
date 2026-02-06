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
          const chore = data.chores.chores.find((c: { id: string; pendingApproval?: { completionId: string; completedBy: { name: string } }; assignedTo?: { id: string; name: string }; pointValue: number; title: string }) => c.id === choreId);
          if (!chore) return;

          // Parent approving a pending completion
          if (chore.pendingApproval && user.role === 'parent') {
            await data.chores.approveChore(choreId, chore.pendingApproval.completionId);
            alert(`Approved! ${chore.pendingApproval.completedBy.name} earned ${chore.pointValue} points for "${chore.title}".`);
            data.chores.refresh();
            return;
          }

          // Determine who should get credit
          let completedById = user.id;
          const isParent = user.role === 'parent';

          // If parent is completing a chore assigned to someone else, ask who did it
          if (isParent && chore.assignedTo && chore.assignedTo.id !== user.id) {
            const assigneeName = chore.assignedTo.name;
            const choice = confirm(
              `This chore is assigned to ${assigneeName}.\n\n` +
              `Click OK to record ${assigneeName} as completing it (they'll get the points).\n\n` +
              `Click Cancel to cancel.`
            );
            if (choice) {
              completedById = chore.assignedTo.id;
            } else {
              return; // Cancel the action entirely
            }
          }

          const result = await data.chores.completeChore(choreId, { completedBy: completedById });
          if (result?.requiresApproval) {
            alert(`Great job! "${chore.title}" is now pending parental approval.`);
          } else {
            alert(`Chore completed! ${chore.pointValue} points awarded.`);
          }
          data.chores.refresh();
        } catch (err) {
          console.error('Failed to complete chore:', err);
          alert('Failed to complete chore. Please try again.');
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
    },
    points: {
      goals: data.points.goals,
      progress: data.points.progress,
      goalChildren: data.points.goalChildren,
      loading: data.points.loading,
      error: data.points.error,
      titleHref: '/goals',
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
