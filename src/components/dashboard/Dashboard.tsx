'use client';

import * as React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardGrid, DashboardLayout, DashboardHeader } from '@/components/layout/DashboardGrid';
import { GridLayout } from '@/components/layout/GridLayout';
import { LayoutEditor } from '@/components/layout/LayoutEditor';
import { useAuth } from '@/components/providers';
import { AddTaskModal, AddMessageModal, AddChoreModal, AddShoppingItemModal } from '@/components/modals';
import { DEFAULT_TEMPLATE } from '@/lib/constants/layoutTemplates';
import { ScreensaverEditor } from '@/components/screensaver/ScreensaverEditor';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import { WidgetErrorBoundary } from '@/components/dashboard/WidgetErrorBoundary';
import { getGreeting } from '@/components/dashboard/greetings';
import { useDashboardData } from './useDashboardData';

export interface DashboardProps {
  weatherLocation?: string;
  className?: string;
}

export function Dashboard({
  weatherLocation = 'Springfield, IL',
  className,
}: DashboardProps) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { activeUser, requireAuth, clearActiveUser } = useAuth();

  const handleLogin = async () => {
    await requireAuth('Login', 'Select your profile and enter your PIN');
  };

  const data = useDashboardData();

  const [showAddMessage, setShowAddMessage] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddChore, setShowAddChore] = useState(false);
  const [showAddShopping, setShowAddShopping] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingWidgets, setEditingWidgets] = useState<WidgetConfig[]>([]);
  const preEditWidgetsRef = useRef<WidgetConfig[]>([]);
  const [editingScreensaver, setEditingScreensaver] = useState(false);

  const activeWidgets = isEditing
    ? editingWidgets
    : data.layouts.savedLayout?.widgets ?? DEFAULT_TEMPLATE.widgets;

  const handleEditStart = useCallback(() => {
    const current = data.layouts.savedLayout?.widgets ?? DEFAULT_TEMPLATE.widgets;
    preEditWidgetsRef.current = current;
    setEditingWidgets(current);
    setIsEditing(true);
  }, [data.layouts.savedLayout]);

  const handleSave = useCallback(async (name?: string) => {
    try {
      await data.layouts.saveLayout({
        ...(data.layouts.savedLayout ? { id: data.layouts.savedLayout.id } : {}),
        name: name || data.layouts.savedLayout?.name || 'My Layout',
        widgets: editingWidgets,
        isDefault: true,
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save layout:', err);
    }
  }, [data.layouts.savedLayout, editingWidgets, data.layouts.saveLayout]);

  const handleSaveAs = useCallback(async () => {
    const name = window.prompt('Layout name:', 'New Layout');
    if (!name) return;
    try {
      await data.layouts.saveLayout({
        name,
        widgets: editingWidgets,
        isDefault: true,
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save layout:', err);
    }
  }, [editingWidgets, data.layouts.saveLayout]);

  const handleReset = useCallback(() => {
    setEditingWidgets(DEFAULT_TEMPLATE.widgets);
  }, []);

  const handleCancel = useCallback(() => {
    setEditingWidgets(preEditWidgetsRef.current);
    setIsEditing(false);
  }, []);

  return (
    <AppShell
      user={activeUser ? {
        id: activeUser.id,
        name: activeUser.name,
        avatarUrl: activeUser.avatarUrl,
        color: activeUser.color,
      } : undefined}
      onLogout={activeUser ? clearActiveUser : undefined}
    >
      <DashboardLayout className={className}>
        <DashboardHeader
          user={activeUser ? {
            name: activeUser.name,
            avatarUrl: activeUser.avatarUrl,
            color: activeUser.color,
          } : undefined}
          greeting={getGreeting()}
          onUserClick={activeUser ? clearActiveUser : handleLogin}
          onSettingsClick={() => router.push('/settings')}
          onScreensaverClick={() => window.dispatchEvent(new Event('prism:screensaver'))}
          onEditClick={activeUser?.role === 'parent' ? handleEditStart : undefined}
        />

        {isEditing && (
          <LayoutEditor
            widgets={editingWidgets}
            onWidgetsChange={setEditingWidgets}
            onSave={handleSave}
            onSaveAs={handleSaveAs}
            onReset={handleReset}
            onCancel={() => { setEditingScreensaver(false); handleCancel(); }}
            onDeleteLayout={data.layouts.deleteLayout}
            layoutName={data.layouts.savedLayout?.name}
            savedLayouts={data.layouts.allLayouts.map(l => ({ id: l.id, name: l.name, widgets: l.widgets }))}
            editingScreensaver={editingScreensaver}
            onToggleScreensaverEdit={() => setEditingScreensaver(!editingScreensaver)}
          />
        )}

        {editingScreensaver && isEditing ? (
          <ScreensaverEditor />
        ) : !isMounted ? (
          <DashboardGrid>
            <div className="col-span-4 flex items-center justify-center h-64 text-muted-foreground">
              Loading widgets...
            </div>
          </DashboardGrid>
        ) : (
        <WidgetErrorBoundary>
        <GridLayout
          layout={activeWidgets}
          isEditable={isEditing}
          onLayoutChange={isEditing ? setEditingWidgets : undefined}
          widgetProps={{
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
                if (user) {
                  data.tasks.toggleTask(taskId, completed);
                }
              },
              onAddClick: async () => {
                const user = await requireAuth("Who's adding a task?");
                if (user) {
                  setShowAddTask(true);
                }
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
                if (user) {
                  setShowAddMessage(true);
                }
              },
              onMessageClick: (_message: unknown) => {},
              onDeleteClick: async (messageId: string) => {
                const user = await requireAuth("Who's deleting this?");
                if (user) {
                  data.messages.deleteMessage(messageId);
                }
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
                  const chore = data.chores.chores.find(c => c.id === choreId);
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
                if (user) {
                  setShowAddChore(true);
                }
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
                if (user) {
                  setShowAddShopping(true);
                }
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
                if (user) {
                  await data.meals.markCooked(mealId, user.id);
                }
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
          }}
        />
        </WidgetErrorBoundary>
        )}

        <AddTaskModal
          open={showAddTask}
          onOpenChange={setShowAddTask}
          onTaskCreated={() => { data.tasks.refresh(); }}
        />

        <AddMessageModal
          open={showAddMessage}
          onOpenChange={setShowAddMessage}
          currentUser={activeUser ? {
            id: activeUser.id,
            name: activeUser.name,
            color: activeUser.color,
            avatarUrl: activeUser.avatarUrl,
          } : undefined}
          onMessageCreated={() => { data.messages.refresh(); }}
        />

        <AddChoreModal
          open={showAddChore}
          onOpenChange={setShowAddChore}
          onChoreCreated={() => { data.chores.refresh(); }}
        />

        <AddShoppingItemModal
          open={showAddShopping}
          onOpenChange={setShowAddShopping}
          onItemCreated={() => { data.shopping.refresh(); }}
        />
      </DashboardLayout>
    </AppShell>
  );
}
