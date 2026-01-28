/**
 * ============================================================================
 * PRISM - Main Dashboard Component
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * This is the heart of Prism - the main dashboard that displays all widgets
 * in a responsive grid layout. It's what you see when you look at your
 * family dashboard on the wall.
 *
 * WHY A SEPARATE COMPONENT?
 * The page.tsx is a Server Component by default in Next.js 14, but our
 * dashboard needs client-side interactivity (real-time clock updates,
 * state management, etc.). By creating this as a Client Component and
 * importing it into the page, we get the best of both worlds.
 *
 * WIDGET LAYOUT:
 * The dashboard uses a responsive 4-column grid optimized for 1920x1080.
 * Widgets can span multiple columns and rows:
 *
 *   +------------------+--------+--------+
 *   |                  |        |        |
 *   |    CALENDAR      | CLOCK  | WEATHER|
 *   |    (2x2)         | (1x1)  | (1x2)  |
 *   |                  +--------+        |
 *   |                  |        |        |
 *   +--------+---------+ TASKS  +--------+
 *   |        |         | (1x2)  |        |
 *   |MESSAGES| (more)  |        | (more) |
 *   | (1x1)  |         |        |        |
 *   +--------+---------+--------+--------+
 *
 * FEATURES:
 * - Real-time clock updates
 * - Demo data for all widgets (API integration comes later)
 * - Touch-optimized interactions
 * - Responsive layout
 *
 * USAGE:
 *   <Dashboard />
 *   <Dashboard currentUser={user} onWidgetClick={handleClick} />
 *
 * ============================================================================
 */

'use client';

import * as React from 'react';
import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardLayout, DashboardHeader } from '@/components/layout/DashboardGrid';
import { GridLayout } from '@/components/layout/GridLayout';
import { LayoutEditor } from '@/components/layout/LayoutEditor';
import { useAuth } from '@/components/providers';
import { useCalendarEvents, useWeather, useMessages, useTasks, useChores, useShoppingLists, useMeals, useBirthdays, useLayouts } from '@/lib/hooks';
import { AddTaskModal, AddMessageModal, AddChoreModal, AddShoppingItemModal } from '@/components/modals';
import { DEFAULT_TEMPLATE } from '@/lib/constants/layoutTemplates';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';


/**
 * DASHBOARD PROPS
 * ============================================================================
 */
export interface DashboardProps {
  /** Location for weather (defaults to Northbrook, IL) */
  weatherLocation?: string;
  /** Additional CSS classes */
  className?: string;
}


/**
 * DASHBOARD COMPONENT
 * ============================================================================
 * The main dashboard displaying all family widgets.
 *
 * AUTHENTICATION FLOW:
 * If requireAuth is true and no user is logged in, shows the PIN pad.
 * Once authenticated, shows the full dashboard with all widgets.
 *
 * @example Basic usage
 * <Dashboard />
 *
 * @example With authentication
 * <Dashboard requireAuth />
 *
 * @example With pre-authenticated user
 * <Dashboard currentUser={loggedInUser} />
 * ============================================================================
 */
export function Dashboard({
  weatherLocation = 'Northbrook, IL',
  className,
}: DashboardProps) {
  // ============================================================================
  // HOOKS
  // ============================================================================
  const router = useRouter();

  // Auth context - provides activeUser and requireAuth function
  const { activeUser, requireAuth, clearActiveUser } = useAuth();

  // Fetch calendar events from API
  // Fetch 30 days to support all view options (3 days, 1 week, 2 weeks, month)
  const {
    events: calendarEvents,
    loading: calendarLoading,
    error: calendarError,
  } = useCalendarEvents({ daysToShow: 30 });

  // Fetch weather data from API
  // Don't pass location - let the API use the WEATHER_LOCATION env variable
  // which has the correct format for OpenWeatherMap (e.g., "Northbrook,IL,US")
  const {
    data: weatherData,
    loading: weatherLoading,
    error: weatherError,
  } = useWeather({});

  // Fetch messages from API
  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    refresh: refreshMessages,
    deleteMessage,
  } = useMessages({ limit: 10 });

  // Fetch tasks from API (include completed to show them crossed out)
  const {
    tasks,
    loading: tasksLoading,
    error: tasksError,
    refresh: refreshTasks,
    toggleTask,
  } = useTasks({ showCompleted: true, limit: 20 });

  // Fetch chores from API
  const {
    chores,
    loading: choresLoading,
    error: choresError,
    refresh: refreshChores,
    completeChore,
    approveChore,
  } = useChores({ showDisabled: false });

  // Fetch shopping lists from API
  const {
    lists: shoppingLists,
    loading: shoppingLoading,
    error: shoppingError,
    refresh: refreshShopping,
    toggleItem: toggleShoppingItem,
  } = useShoppingLists({});

  // Fetch meals from API (current week)
  const {
    meals,
    loading: mealsLoading,
    error: mealsError,
    refresh: refreshMeals,
    markCooked,
  } = useMeals({});

  // Fetch birthdays & milestones
  const {
    birthdays: birthdaysList,
    loading: birthdaysLoading,
    error: birthdaysError,
    syncFromGoogle: syncBirthdays,
  } = useBirthdays({ limit: 8 });

  // Layouts
  const {
    activeLayout: savedLayout,
    saveLayout,
    loading: layoutsLoading,
  } = useLayouts();

  // ============================================================================
  // STATE
  // ============================================================================

  const [showAddMessage, setShowAddMessage] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddChore, setShowAddChore] = useState(false);
  const [showAddShopping, setShowAddShopping] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingWidgets, setEditingWidgets] = useState<WidgetConfig[]>([]);
  const preEditWidgetsRef = useRef<WidgetConfig[]>([]);

  // Determine active widgets: editing state > saved layout > default template
  const activeWidgets = isEditing
    ? editingWidgets
    : savedLayout?.widgets ?? DEFAULT_TEMPLATE.widgets;

  const handleEditStart = useCallback(() => {
    const current = savedLayout?.widgets ?? DEFAULT_TEMPLATE.widgets;
    preEditWidgetsRef.current = current;
    setEditingWidgets(current);
    setIsEditing(true);
  }, [savedLayout]);

  const handleSave = useCallback(async (name?: string) => {
    try {
      await saveLayout({
        ...(savedLayout ? { id: savedLayout.id } : {}),
        name: name || savedLayout?.name || 'My Layout',
        widgets: editingWidgets,
        isDefault: true,
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save layout:', err);
    }
  }, [savedLayout, editingWidgets, saveLayout]);

  const handleSaveAs = useCallback(async () => {
    const name = window.prompt('Layout name:', 'New Layout');
    if (!name) return;
    try {
      await saveLayout({
        name,
        widgets: editingWidgets,
        isDefault: true,
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save layout:', err);
    }
  }, [editingWidgets, saveLayout]);

  const handleReset = useCallback(() => {
    setEditingWidgets(DEFAULT_TEMPLATE.widgets);
  }, []);

  const handleCancel = useCallback(() => {
    setEditingWidgets(preEditWidgetsRef.current);
    setIsEditing(false);
  }, []);


  // ============================================================================
  // RENDER DASHBOARD
  // ============================================================================

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
        {/* ==================================================================== */}
        {/* HEADER */}
        {/* Shows greeting and current user info */}
        {/* ==================================================================== */}
        <DashboardHeader
          user={activeUser ? {
            name: activeUser.name,
            avatarUrl: activeUser.avatarUrl,
            color: activeUser.color,
          } : undefined}
          greeting={getGreeting()}
          onUserClick={activeUser ? clearActiveUser : undefined}
          onSettingsClick={() => router.push('/settings')}
          onEditClick={activeUser?.role === 'parent' ? handleEditStart : undefined}
        />

        {/* ================================================================== */}
        {/* LAYOUT EDITOR TOOLBAR (when editing) */}
        {/* ================================================================== */}
        {isEditing && (
          <LayoutEditor
            widgets={editingWidgets}
            onWidgetsChange={setEditingWidgets}
            onSave={handleSave}
            onSaveAs={handleSaveAs}
            onReset={handleReset}
            onCancel={handleCancel}
            layoutName={savedLayout?.name}
          />
        )}

        {/* ================================================================== */}
        {/* WIDGET GRID */}
        {/* ================================================================== */}
        <GridLayout
          layout={activeWidgets}
          isEditable={isEditing}
          onLayoutChange={isEditing ? setEditingWidgets : undefined}
          widgetProps={{
            clock: {},
            weather: {
              location: weatherLocation,
              data: weatherData || undefined,
              loading: weatherLoading,
              error: weatherError,
            },
            calendar: {
              events: calendarEvents.length > 0 ? calendarEvents : undefined,
              loading: calendarLoading,
              error: calendarError,
              initialView: '3days',
              maxEventsPerDay: 4,
              onEventClick: (event: unknown) => {
                console.log('Event clicked:', event);
              },
              titleHref: '/calendar',
            },
            tasks: {
              tasks,
              maxTasks: 6,
              loading: tasksLoading,
              error: tasksError,
              onTaskToggle: async (taskId: string, completed: boolean) => {
                const user = await requireAuth("Who's completing this task?");
                if (user) {
                  toggleTask(taskId, completed);
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
              messages,
              maxMessages: 5,
              loading: messagesLoading,
              error: messagesError,
              onAddClick: async () => {
                const user = await requireAuth("Who's posting?");
                if (user) {
                  setShowAddMessage(true);
                }
              },
              onMessageClick: (message: unknown) => {
                console.log('Message clicked:', message);
              },
              onDeleteClick: async (messageId: string) => {
                const user = await requireAuth("Who's deleting this?");
                if (user) {
                  deleteMessage(messageId);
                }
              },
            },
            chores: {
              chores,
              maxChores: 6,
              loading: choresLoading,
              error: choresError,
              onChoreComplete: async (choreId: string) => {
                const user = await requireAuth("Who's completing this chore?");
                if (!user) return;
                try {
                  const chore = chores.find(c => c.id === choreId);
                  if (chore?.pendingApproval && user.role === 'parent') {
                    await approveChore(choreId, chore.pendingApproval.completionId);
                  } else {
                    await completeChore(choreId, { completedBy: user.id });
                  }
                  refreshChores();
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
              lists: shoppingLists,
              loading: shoppingLoading,
              error: shoppingError,
              onItemToggle: (itemId: string, checked: boolean) => toggleShoppingItem(itemId, checked),
              onAddClick: async () => {
                const user = await requireAuth("Who's adding an item?");
                if (user) {
                  setShowAddShopping(true);
                }
              },
              titleHref: '/shopping',
            },
            birthdays: {
              birthdays: birthdaysList,
              loading: birthdaysLoading,
              error: birthdaysError,
              onSyncClick: syncBirthdays,
            },
            meals: {
              meals,
              loading: mealsLoading,
              error: mealsError,
              onMarkCooked: async (mealId: string) => {
                const user = await requireAuth("Who cooked this?");
                if (user) {
                  markCooked(mealId, user.id);
                }
              },
              onAddClick: async () => {
                const user = await requireAuth("Who's planning a meal?");
                if (user) {
                  console.log('Add meal clicked by', user.name);
                }
              },
              titleHref: '/meals',
            },
          }}
        />

        {/* ================================================================== */}
        {/* MODALS */}
        {/* ================================================================== */}
        <AddTaskModal
          open={showAddTask}
          onOpenChange={setShowAddTask}
          onTaskCreated={(task) => {
            console.log('Task created:', task);
            refreshTasks();
          }}
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
          onMessageCreated={(message) => {
            console.log('Message posted:', message);
            refreshMessages();
          }}
        />

        <AddChoreModal
          open={showAddChore}
          onOpenChange={setShowAddChore}
          onChoreCreated={(chore) => {
            console.log('Chore created:', chore);
            refreshChores();
          }}
        />

        <AddShoppingItemModal
          open={showAddShopping}
          onOpenChange={setShowAddShopping}
          onItemCreated={(item) => {
            console.log('Shopping item created:', item);
            refreshShopping();
          }}
        />
      </DashboardLayout>
    </AppShell>
  );
}


/**
 * WHIMSICAL GREETINGS
 * ============================================================================
 * Arrays of playful greetings for each time of day.
 * Mix of casual, regal, and pop culture inspired.
 * ============================================================================
 */
const morningGreetings = [
  'Rise and shine',
  'Top of the morning',
  'Wakey wakey',
  'Hello sunshine',
  'Look who\'s up',
  'Morning, superstar',
  'Ready to conquer today',
  'Coffee time',
  'Bright-eyed and bushy-tailed',
  'Good morrow',
  'The early bird catches',
  'Carpe diem',
  'You\'re up before the sun',
  'Morning glory',
  'Another day, another adventure',
];

const afternoonGreetings = [
  'Hey there',
  'Afternoon delight',
  'Halfway through',
  'Still crushing it',
  'Keep on keepin\' on',
  'How goes the day',
  'Afternoon vibes',
  'Making things happen',
  'Good day',
  'Well met',
  'The game is afoot',
  'Onwards and upwards',
  'May the force be with you',
  'Adventure awaits',
  'What a time to be alive',
];

const eveningGreetings = [
  'Good evening',
  'Evening, friend',
  'Winding down',
  'Home stretch',
  'Almost done',
  'Evening already',
  'Hope today was good',
  'Settling in',
  'As the sun sets',
  'Time flies',
  'What a day',
  'Made it through another one',
  'Twilight time',
  'The stars are coming out',
];

const nightGreetings = [
  'Burning the midnight oil',
  'Night owl mode',
  'Still awake',
  'The world is quiet',
  'Sweet dreams soon',
  'Starlight hours',
  'Late night crew',
  'The witching hour approaches',
  'While the world sleeps',
  'To sleep, perchance to dream',
  'Goodnight, moon',
  'The night is young',
  'What brings you here at this hour',
];

/**
 * GET GREETING
 * ============================================================================
 * Returns a whimsical greeting based on the time of day.
 * Randomly selects from a pool of greetings for variety.
 *
 * TIME RANGES:
 * - Morning: 5 AM - 12 PM
 * - Afternoon: 12 PM - 5 PM
 * - Evening: 5 PM - 9 PM
 * - Night: 9 PM - 5 AM
 * ============================================================================
 */
function getGreeting(): string {
  const hour = new Date().getHours();

  // Use a seed based on the day so it doesn't change on every render
  const daySeed = new Date().toDateString();
  const pseudoRandom = (arr: string[]): string => {
    if (arr.length === 0) return 'Hello';
    let hash = 0;
    for (let i = 0; i < daySeed.length; i++) {
      hash = ((hash << 5) - hash) + daySeed.charCodeAt(i);
      hash = hash & hash;
    }
    return arr[Math.abs(hash) % arr.length]!;
  };

  if (hour >= 5 && hour < 12) {
    return pseudoRandom(morningGreetings);
  }
  if (hour >= 12 && hour < 17) {
    return pseudoRandom(afternoonGreetings);
  }
  if (hour >= 17 && hour < 21) {
    return pseudoRandom(eveningGreetings);
  }
  return pseudoRandom(nightGreetings);
}
