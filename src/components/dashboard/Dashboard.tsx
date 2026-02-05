'use client';

import * as React from 'react';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardGrid, DashboardLayout, DashboardHeader } from '@/components/layout/DashboardGrid';
import { LayoutGridEditor, SCREENSAVER_THEME } from '@/components/layout/LayoutGridEditor';
import { LayoutEditor } from '@/components/layout/LayoutEditor';
import { useAuth } from '@/components/providers';
import { AddTaskModal, AddMessageModal, AddChoreModal, AddShoppingItemModal } from '@/components/modals';
import { DEFAULT_TEMPLATE } from '@/lib/constants/layoutTemplates';
import { WIDGET_REGISTRY } from '@/components/widgets/widgetRegistry';
import {
  loadScreensaverLayout,
  saveScreensaverLayout,
  DEFAULT_SCREENSAVER_LAYOUT,
  getScreensaverPresets,
  saveScreensaverPreset,
  deleteScreensaverPreset,
} from '@/components/screensaver/Screensaver';
import { renderScreensaverPreview } from '@/components/screensaver/ScreensaverWidgetPreview';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import { WidgetErrorBoundary } from '@/components/dashboard/WidgetErrorBoundary';
import { useDashboardData } from './useDashboardData';

class WidgetBoundary extends React.Component<
  { name: string; children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 12, background: '#300', color: '#f88', fontSize: 12, overflow: 'auto' }}>
          <strong>{this.props.name} crashed:</strong>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export interface DashboardProps {
  weatherLocation?: string;
  className?: string;
}

export function Dashboard({
  weatherLocation = 'Springfield, IL',
  className,
}: DashboardProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { activeUser, requireAuth, clearActiveUser } = useAuth();

  const data = useDashboardData();

  const [showAddMessage, setShowAddMessage] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddChore, setShowAddChore] = useState(false);
  const [showAddShopping, setShowAddShopping] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingWidgets, setEditingWidgets] = useState<WidgetConfig[]>([]);
  const preEditWidgetsRef = useRef<WidgetConfig[]>([]);
  const [editingScreensaver, setEditingScreensaver] = useState(false);
  const [ssLayout, setSsLayout] = useState<WidgetConfig[]>(() => loadScreensaverLayout());

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

  const handleSsLayoutChange = useCallback((newLayout: WidgetConfig[]) => {
    setSsLayout(newLayout);
    saveScreensaverLayout(newLayout);
  }, []);

  const handleSsWidgetToggle = useCallback((widgetType: string, visible: boolean) => {
    setSsLayout(prev => {
      const exists = prev.find(w => w.i === widgetType);
      let updated: WidgetConfig[];
      if (exists) {
        updated = prev.map(w => w.i === widgetType ? { ...w, visible } : w);
      } else if (visible) {
        const maxY = Math.max(0, ...prev.map(w => w.y + w.h));
        updated = [...prev, { i: widgetType, x: 0, y: maxY, w: 3, h: 3, visible: true }];
      } else {
        return prev;
      }
      saveScreensaverLayout(updated);
      return updated;
    });
  }, []);

  const [ssPresets, setSsPresets] = useState(() =>
    typeof window !== 'undefined' ? getScreensaverPresets() : []
  );

  const handleSsSave = useCallback(() => {
    saveScreensaverLayout(ssLayout);
    setIsEditing(false);
  }, [ssLayout]);

  const handleSsSaveAs = useCallback(() => {
    const name = window.prompt('Preset name:', 'My Screensaver');
    if (!name) return;
    saveScreensaverPreset(name, ssLayout);
    setSsPresets(getScreensaverPresets());
  }, [ssLayout]);

  const handleSsReset = useCallback(() => {
    const fresh = DEFAULT_SCREENSAVER_LAYOUT.map(w => ({ ...w }));
    setSsLayout(fresh);
    saveScreensaverLayout(fresh);
  }, []);

  const handleSelectSsTemplate = useCallback((templateWidgets: WidgetConfig[]) => {
    const visibleIds = new Set(templateWidgets.filter(w => w.visible !== false).map(w => w.i));
    const merged = DEFAULT_SCREENSAVER_LAYOUT.map(def => {
      const tw = templateWidgets.find(t => t.i === def.i);
      if (tw) return { ...tw, visible: true };
      return { ...def, visible: false };
    });
    // Add any template widgets not in defaults
    templateWidgets.forEach(tw => {
      if (!merged.find(m => m.i === tw.i)) {
        merged.push({ ...tw, visible: visibleIds.has(tw.i) });
      }
    });
    setSsLayout(merged);
    saveScreensaverLayout(merged);
  }, []);

  const handleSelectSsPreset = useCallback((presetWidgets: WidgetConfig[]) => {
    setSsLayout(presetWidgets);
    saveScreensaverLayout(presetWidgets);
  }, []);

  const handleDeleteSsPreset = useCallback((name: string) => {
    deleteScreensaverPreset(name);
    setSsPresets(getScreensaverPresets());
  }, []);

  const handleLogin = async () => {
    await requireAuth('Login', 'Select your profile');
  };

  const widgetProps: Record<string, Record<string, unknown>> = {
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
  };

  const dashboardConstraints = useMemo(() => {
    const constraints: Record<string, { minW?: number; minH?: number }> = {};
    for (const [key, reg] of Object.entries(WIDGET_REGISTRY)) {
      constraints[key] = { minW: reg.minW, minH: reg.minH };
    }
    return constraints;
  }, []);

  const renderDashboardWidget = useCallback((w: WidgetConfig) => {
    const reg = WIDGET_REGISTRY[w.i];
    if (!reg) {
      return (
        <div style={{ background: '#330', color: '#ff0', padding: 8 }}>
          Unknown widget: {w.i}
        </div>
      );
    }
    const Component = reg.component;
    const props = { ...widgetProps[w.i] || {}, gridW: w.w, gridH: w.h };
    return (
      <WidgetBoundary name={w.i}>
        <Component {...props} />
      </WidgetBoundary>
    );
  // widgetProps is rebuilt every render, so we intentionally don't include it
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const renderSsWidget = useCallback((w: WidgetConfig) => {
    return renderScreensaverPreview(w);
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
      onLogin={handleLogin}
    >
      <DashboardLayout className={className}>
        <DashboardHeader
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
            screensaverWidgets={ssLayout}
            onScreensaverWidgetToggle={handleSsWidgetToggle}
            onScreensaverSave={handleSsSave}
            onScreensaverSaveAs={handleSsSaveAs}
            onScreensaverReset={handleSsReset}
            onSelectScreensaverTemplate={handleSelectSsTemplate}
            screensaverPresets={ssPresets}
            onSelectScreensaverPreset={handleSelectSsPreset}
            onDeleteScreensaverPreset={handleDeleteSsPreset}
          />
        )}

        {editingScreensaver && isEditing ? (
          <LayoutGridEditor
            layout={ssLayout}
            onLayoutChange={handleSsLayoutChange}
            isEditable
            renderWidget={renderSsWidget}
            margin={4}
            headerOffset={220}
            minVisibleRows={8}
            theme={SCREENSAVER_THEME}
            gridHelperText="Drag widgets to reposition &bull; Scroll to see more"
            className="mx-4"
          />
        ) : !isMounted ? (
          <DashboardGrid>
            <div className="col-span-4 flex items-center justify-center h-64 text-muted-foreground">
              Loading widgets...
            </div>
          </DashboardGrid>
        ) : (
          <WidgetErrorBoundary>
            <LayoutGridEditor
              layout={activeWidgets}
              onLayoutChange={isEditing ? setEditingWidgets : () => {}}
              isEditable={isEditing}
              renderWidget={renderDashboardWidget}
              widgetConstraints={dashboardConstraints}
              margin={8}
              headerOffset={140}
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
