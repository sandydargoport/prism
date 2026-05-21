'use client';

import * as React from 'react';
import { Suspense, lazy, useState, useCallback, useEffect, useMemo, useRef } from 'react';

const VISIBLE_WIDGETS_KEY = 'prism-visible-widgets';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardLayout, DashboardHeader } from '@/components/layout/DashboardGrid';
import { LayoutGridEditor, SCREENSAVER_THEME } from '@/components/layout/LayoutGridEditor';
import { useAuth, useFamily } from '@/components/providers';
import { GRID_COLS } from '@/lib/constants/grid';
import { useScreenSafeZones } from '@/lib/hooks/useScreenSafeZones';
import { useOrientation } from '@/lib/hooks/useOrientation';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useAutoHideUI } from '@/lib/hooks/useAutoHideUI';
import { useTaskLists } from '@/lib/hooks/useTaskLists';
import { useRecipes } from '@/lib/hooks/useRecipes';
import { useChoreModals } from '@/app/chores/useChoreModals';
import { toast } from '@/components/ui/use-toast';
import type { Chore, Task, Meal } from '@/types';
import { MobileDashboard } from './MobileDashboard';
import dynamic from 'next/dynamic';

const LayoutEditor = dynamic(() => import('@/components/layout/LayoutEditor').then(m => ({ default: m.LayoutEditor })), { ssr: false });
const AddTaskModal = dynamic(() => import('@/components/modals/AddTaskModal').then(m => ({ default: m.AddTaskModal })));
const AddMessageModal = dynamic(() => import('@/components/modals/AddMessageModal').then(m => ({ default: m.AddMessageModal })));
const AddChoreModal = dynamic(() => import('@/components/modals/AddChoreModal').then(m => ({ default: m.AddChoreModal })));
const AddShoppingItemModal = dynamic(() => import('@/components/modals/AddShoppingItemModal').then(m => ({ default: m.AddShoppingItemModal })));
// Edit modals — same pattern as CalendarView's overlay click-to-edit. Lazy-
// loaded so the dashboard initial bundle stays small.
const ChoreModal = lazy(() => import('@/app/chores/ChoreModal').then(m => ({ default: m.ChoreModal })));
const TaskModal = lazy(() => import('@/app/tasks/TaskModal').then(m => ({ default: m.TaskModal })));
const MealModal = lazy(() => import('@/app/meals/MealsView').then(m => ({ default: m.MealModal })));
import { WIDGET_REGISTRY } from '@/components/widgets/widgetRegistry';
import { renderScreensaverPreview } from '@/components/screensaver/ScreensaverWidgetPreview';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import { WidgetErrorBoundary } from '@/components/dashboard/WidgetErrorBoundary';
import { useDashboardData } from './useDashboardData';
import { useDashboardLayout } from './useDashboardLayout';
import { buildWidgetProps } from './useWidgetProps';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';

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
  slug?: string;
}

export function Dashboard({
  weatherLocation,
  className,
  slug,
}: DashboardProps) {
  const router = useRouter();

  const { activeUser, requireAuth, clearActiveUser, switchUser } = useAuth();
  const { confirm: confirmAction, dialogProps: confirmDialogProps } = useConfirmDialog();

  // Read cached visible widget IDs from localStorage for prioritized loading
  const [initialVisibleWidgets] = useState<Set<string> | undefined>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(VISIBLE_WIDGETS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return new Set(parsed);
          }
        }
      } catch { /* ignore */ }
    }
    return undefined; // No cache → enable all hooks immediately
  });

  const data = useDashboardData(initialVisibleWidgets);

  const [showAddMessage, setShowAddMessage] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddChore, setShowAddChore] = useState(false);
  const [showAddShopping, setShowAddShopping] = useState(false);

  // Edit modals for widget click-to-edit (mirrors the CalendarView overlay flow).
  const [editingChore, setEditingChore] = useState<Chore | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);

  const { members: familyMembers } = useFamily();
  const { lists: taskLists } = useTaskLists();
  const { recipes } = useRecipes();

  const { saveEditedChore } = useChoreModals({
    refreshChores: data.chores.refresh,
    setShowAddModal: () => {},
    setEditingChore,
    deleteChore: () => {},
  });

  const layout = useDashboardLayout(data.layouts, slug);

  // Persist visible widget IDs to localStorage for next load's prioritized fetching
  useEffect(() => {
    const ids = layout.activeWidgets
      .filter(w => w.visible !== false)
      .map(w => w.i);
    if (ids.length > 0) {
      localStorage.setItem(VISIBLE_WIDGETS_KEY, JSON.stringify(ids));
    }
  }, [layout.activeWidgets]);

  // Redirect to / if slug doesn't resolve to a layout (after layouts have loaded)
  useEffect(() => {
    if (slug && !data.layouts.loading && data.layouts.allLayouts.length > 0 && !layout.activeLayout) {
      router.replace('/');
    }
  }, [slug, data.layouts.loading, data.layouts.allLayouts.length, layout.activeLayout, router]);

  // Detect portrait nav to offset grid height (nav covers bottom 80px + safe area)
  const deviceOrientation = useOrientation();
  const isMobile = useIsMobile();
  const { uiHidden } = useAutoHideUI();
  const hasPortraitNav = !isMobile && deviceOrientation === 'portrait';
  // Only reserve bottom space when nav is actually visible (not auto-hidden)
  const bottomOffset = hasPortraitNav && !uiHidden ? 96 : 0;

  // Grid control state shared between LayoutEditor toolbar and LayoutGridEditor
  const { allSizeNames } = useScreenSafeZones();

  // Orientation from active layout (DB), fallback to landscape
  const [screenGuideOrientation, setScreenGuideOrientationState] = useState<'landscape' | 'portrait'>(() => {
    const fromLayout = layout.activeLayout?.orientation;
    if (fromLayout === 'portrait' || fromLayout === 'landscape') return fromLayout;
    return 'landscape';
  });

  // Sync orientation when active layout changes
  useEffect(() => {
    const fromLayout = layout.activeLayout?.orientation;
    if (fromLayout === 'portrait' || fromLayout === 'landscape') {
      setScreenGuideOrientationState(fromLayout);
    }
  }, [layout.activeLayout?.orientation]);

  const setScreenGuideOrientation = useCallback(async (o: 'landscape' | 'portrait') => {
    setScreenGuideOrientationState(o);
    // Persist to DB
    if (layout.activeLayout) {
      try {
        await data.layouts.saveLayout({
          id: layout.activeLayout.id,
          name: layout.activeLayout.name,
          widgets: layout.activeLayout.widgets,
          orientation: o,
        });
      } catch { /* ignore */ }
    }
  }, [layout.activeLayout, data.layouts]);

  const [enabledSizes, setEnabledSizes] = useState<string[]>(allSizeNames);
  const [gridScrollY, setGridScrollY] = useState(0);
  const [gridVisibleRows, setGridVisibleRows] = useState(GRID_COLS);
  const [gridScrollX, setGridScrollX] = useState(0);
  const [gridVisibleCols, setGridVisibleCols] = useState(GRID_COLS);
  const [gridTotalRows, setGridTotalRows] = useState(GRID_COLS * 2);
  const [gridTotalCols, setGridTotalCols] = useState(GRID_COLS);
  const scrollToGridRef = useRef<((row: number, col?: number) => void) | null>(null);

  const handleScrollInfo = useCallback((info: { scrollY: number; visibleRows: number; scrollX: number; visibleCols: number; totalRows: number; totalCols: number }) => {
    setGridScrollY(info.scrollY);
    setGridVisibleRows(info.visibleRows);
    setGridScrollX(info.scrollX);
    setGridVisibleCols(info.visibleCols);
    setGridTotalRows(info.totalRows);
    setGridTotalCols(info.totalCols);
  }, []);

  const handleToggleSize = useCallback((size: string) => {
    setEnabledSizes(prev =>
      prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
    );
  }, []);

  // Dashboard management callbacks for LayoutEditor
  const handleSwitchDashboard = useCallback((targetSlug: string) => {
    router.push(`/d/${targetSlug}`);
  }, [router]);

  const handleCreateDashboard = useCallback(async (name: string, startFrom: 'blank' | 'template' | 'copy') => {
    const { DEFAULT_TEMPLATE } = await import('@/lib/constants/layoutTemplates');
    let widgets: WidgetConfig[];
    if (startFrom === 'copy' && layout.activeLayout) {
      widgets = layout.activeLayout.widgets;
    } else if (startFrom === 'template') {
      widgets = DEFAULT_TEMPLATE.widgets;
    } else {
      // Blank: single clock widget
      widgets = [{ i: 'clock', x: 16, y: 16, w: 16, h: 16, visible: true }];
    }
    try {
      const result = await data.layouts.saveLayout({ name, widgets, isDefault: false });
      const saved = result as { slug?: string };
      if (saved?.slug) {
        router.push(`/d/${saved.slug}`);
      }
    } catch (err) {
      console.error('Failed to create dashboard:', err);
    }
  }, [layout.activeLayout, data.layouts, router]);

  const handleRenameDashboard = useCallback(async (newName: string) => {
    if (!layout.activeLayout) return;
    try {
      await data.layouts.saveLayout({
        id: layout.activeLayout.id,
        name: newName,
        widgets: layout.activeLayout.widgets,
      });
    } catch (err) {
      console.error('Failed to rename dashboard:', err);
    }
  }, [layout.activeLayout, data.layouts]);

  const handleDeleteDashboard = useCallback(async () => {
    if (!layout.activeLayout) return;
    try {
      await data.layouts.deleteLayout(layout.activeLayout.id);
      router.push('/');
    } catch (err) {
      console.error('Failed to delete dashboard:', err);
    }
  }, [layout.activeLayout, data.layouts, router]);

  const widgetProps = buildWidgetProps(data, requireAuth, {
    setShowAddTask, setShowAddMessage, setShowAddChore, setShowAddShopping,
  }, weatherLocation, confirmAction, {
    onEditTask: setEditingTask,
    onEditChore: setEditingChore,
    onEditMeal: setEditingMeal,
  });

  const handleLogin = async () => {
    await requireAuth('Login', 'Select your profile');
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
      return <div style={{ background: '#330', color: '#ff0', padding: 8 }}>Unknown widget: {w.i}</div>;
    }
    const Component = reg.component;
    const props = { ...widgetProps[w.i] || {}, gridW: w.w, gridH: w.h };
    return (
      <WidgetBoundary name={w.i}>
        <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading...</div>}>
          <Component {...props} />
        </Suspense>
      </WidgetBoundary>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const renderSsWidget = useCallback((w: WidgetConfig) => {
    // Use actual widgets with real data in the screensaver designer
    const reg = WIDGET_REGISTRY[w.i];
    if (!reg) {
      return renderScreensaverPreview(w);
    }
    const Component = reg.component;
    const props = { ...widgetProps[w.i] || {}, gridW: w.w, gridH: w.h };
    return (
      <WidgetBoundary name={w.i}>
        <Suspense fallback={<div className="flex items-center justify-center h-full text-white/50 text-sm">Loading...</div>}>
          <div className="h-full w-full [&_*]:!bg-transparent [&_.bg-card]:!bg-white/10 [&_.border-border]:!border-white/20">
            <Component {...props} />
          </div>
        </Suspense>
      </WidgetBoundary>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (isMobile) {
    return (
      <AppShell
        user={activeUser ? { id: activeUser.id, name: activeUser.name, avatarUrl: activeUser.avatarUrl, color: activeUser.color } : undefined}
        onLogout={activeUser ? clearActiveUser : undefined}
        onLogin={handleLogin}
        onSwitchUser={() => switchUser()}
      >
        <MobileDashboard data={data} />
      </AppShell>
    );
  }

  return (
    <AppShell
      user={activeUser ? { id: activeUser.id, name: activeUser.name, avatarUrl: activeUser.avatarUrl, color: activeUser.color } : undefined}
      onLogout={activeUser ? clearActiveUser : undefined}
      onLogin={handleLogin}
      onSwitchUser={() => switchUser()}
      showWallpaper
    >
      <DashboardLayout className={className}>
        <DashboardHeader
          onScreensaverClick={() => window.dispatchEvent(new Event('prism:screensaver'))}
          onEditClick={activeUser?.role === 'parent' ? layout.handleEditStart : undefined}
        />

        {layout.isEditing && (
          <LayoutEditor
            widgets={layout.editingWidgets}
            onWidgetsChange={layout.setEditingWidgets}
            onSave={layout.handleSave}
            onSaveAs={layout.handleSaveAs}
            onReset={layout.handleReset}
            onCancel={() => { layout.setEditingScreensaver(false); layout.handleCancel(); }}
            onDeleteLayout={data.layouts.deleteLayout}
            layoutName={layout.activeLayout?.name}
            savedLayouts={data.layouts.allLayouts.map(l => ({ id: l.id, name: l.name, widgets: l.widgets }))}
            editingScreensaver={layout.editingScreensaver}
            onToggleScreensaverEdit={() => layout.setEditingScreensaver(!layout.editingScreensaver)}
            screensaverWidgets={layout.ssLayout}
            onScreensaverWidgetToggle={layout.handleSsWidgetToggle}
            onScreensaverSave={layout.handleSsSave}
            onScreensaverSaveAs={layout.handleSsSaveAs}
            onScreensaverReset={layout.handleSsReset}
            onSelectScreensaverTemplate={layout.handleSelectSsTemplate}
            screensaverPresets={layout.ssPresets}
            onSelectScreensaverPreset={layout.handleSelectSsPreset}
            onDeleteScreensaverPreset={layout.handleDeleteSsPreset}
            screenGuideOrientation={screenGuideOrientation}
            onScreenGuideOrientationChange={setScreenGuideOrientation}
            enabledSizes={enabledSizes}
            onToggleSize={handleToggleSize}
            gridScrollY={gridScrollY}
            gridVisibleRows={gridVisibleRows}
            gridScrollX={gridScrollX}
            gridVisibleCols={gridVisibleCols}
            gridTotalRows={gridTotalRows}
            gridTotalCols={gridTotalCols}
            scrollToGridRef={scrollToGridRef}
            allDashboards={data.layouts.allLayouts.map(l => ({ id: l.id, name: l.name, slug: l.slug, isDefault: l.isDefault }))}
            currentDashboardId={layout.activeLayout?.id}
            onSwitchDashboard={handleSwitchDashboard}
            onCreateDashboard={handleCreateDashboard}
            onRenameDashboard={handleRenameDashboard}
            onDeleteDashboard={handleDeleteDashboard}
          />
        )}

        {layout.editingScreensaver && layout.isEditing ? (
          <LayoutGridEditor
            layout={layout.ssLayout}
            onLayoutChange={layout.handleSsLayoutChange}
            isEditable
            renderWidget={renderSsWidget}
            margin={4}
            headerOffset={100}
            bottomOffset={bottomOffset}
            minVisibleRows={8}
            theme={SCREENSAVER_THEME}
            gridHelperText="Drag widgets to reposition &bull; Scroll to see more"
            className="mx-4"
            screenGuideOrientation={screenGuideOrientation}
            enabledSizes={enabledSizes}
            onScrollInfo={handleScrollInfo}
            scrollToRef={scrollToGridRef}
          />
        ) : (
          <WidgetErrorBoundary>
            <LayoutGridEditor
              layout={layout.activeWidgets}
              onLayoutChange={layout.isEditing ? layout.setEditingWidgets : () => {}}
              isEditable={layout.isEditing}
              renderWidget={renderDashboardWidget}
              widgetConstraints={dashboardConstraints}
              margin={8}
              headerOffset={layout.isEditing ? 140 : uiHidden ? 0 : 50}
              bottomOffset={bottomOffset}
              screenGuideOrientation={screenGuideOrientation}
              enabledSizes={enabledSizes}
              onScrollInfo={handleScrollInfo}
              scrollToRef={scrollToGridRef}
            />
          </WidgetErrorBoundary>
        )}

        {showAddTask && (
          <AddTaskModal open={showAddTask} onOpenChange={setShowAddTask}
            onTaskCreated={() => { data.tasks.refresh(); }} />
        )}
        {showAddMessage && (
          <AddMessageModal open={showAddMessage} onOpenChange={setShowAddMessage}
            currentUser={activeUser ? { id: activeUser.id, name: activeUser.name, color: activeUser.color, avatarUrl: activeUser.avatarUrl } : undefined}
            onMessageCreated={() => { data.messages.refresh(); }} />
        )}
        {showAddChore && (
          <AddChoreModal open={showAddChore} onOpenChange={setShowAddChore}
            onChoreCreated={() => { data.chores.refresh(); }} />
        )}
        {showAddShopping && (
          <AddShoppingItemModal open={showAddShopping} onOpenChange={setShowAddShopping}
            onItemCreated={() => { data.shopping.refresh(); }} />
        )}

        {editingChore && (
          <Suspense fallback={null}>
            <ChoreModal
              chore={editingChore}
              familyMembers={familyMembers}
              onClose={() => setEditingChore(null)}
              onSave={async (updated) => {
                await saveEditedChore(editingChore.id, updated);
              }}
            />
          </Suspense>
        )}

        {editingTask && (
          <Suspense fallback={null}>
            <TaskModal
              task={editingTask}
              familyMembers={familyMembers}
              taskLists={taskLists}
              onClose={() => setEditingTask(null)}
              onSave={async (updated) => {
                try {
                  const res = await fetch(`/api/tasks/${editingTask.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      title: updated.title,
                      priority: updated.priority,
                      category: updated.category,
                      assignedTo: updated.assignedTo?.id,
                      dueDate: updated.dueDate === null ? null : updated.dueDate.toISOString(),
                      completed: updated.completed,
                      listId: updated.listId,
                    }),
                  });
                  if (!res.ok) throw new Error('Failed to update task');
                  data.tasks.refresh();
                } catch (err) {
                  toast({ title: err instanceof Error ? err.message : 'Failed to update task', variant: 'destructive' });
                } finally {
                  setEditingTask(null);
                }
              }}
            />
          </Suspense>
        )}

        {editingMeal && (
          <Suspense fallback={null}>
            <MealModal
              meal={editingMeal}
              weekOf={editingMeal.weekOf}
              dayOptions={['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const}
              recipes={recipes}
              onClose={() => setEditingMeal(null)}
              onSave={async (updates) => {
                try {
                  const res = await fetch(`/api/meals/${editingMeal.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updates),
                  });
                  if (!res.ok) throw new Error('Failed to update meal');
                  data.meals.refresh();
                } catch (err) {
                  toast({ title: err instanceof Error ? err.message : 'Failed to update meal', variant: 'destructive' });
                } finally {
                  setEditingMeal(null);
                }
              }}
            />
          </Suspense>
        )}
      </DashboardLayout>
      <ConfirmDialog {...confirmDialogProps} />
    </AppShell>
  );
}
