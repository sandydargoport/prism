'use client';

import * as React from 'react';
import { Suspense, useState, useCallback, useEffect, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardGrid, DashboardLayout, DashboardHeader } from '@/components/layout/DashboardGrid';
import { LayoutGridEditor, SCREENSAVER_THEME } from '@/components/layout/LayoutGridEditor';
import { LayoutEditor } from '@/components/layout/LayoutEditor';
import { useAuth } from '@/components/providers';
import { AddTaskModal, AddMessageModal, AddChoreModal, AddShoppingItemModal } from '@/components/modals';
import { WIDGET_REGISTRY } from '@/components/widgets/widgetRegistry';
import { renderScreensaverPreview } from '@/components/screensaver/ScreensaverWidgetPreview';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import { WidgetErrorBoundary } from '@/components/dashboard/WidgetErrorBoundary';
import { useDashboardData } from './useDashboardData';
import { useDashboardLayout } from './useDashboardLayout';
import { buildWidgetProps } from './useWidgetProps';

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
  useEffect(() => { setIsMounted(true); }, []);

  const { activeUser, requireAuth, clearActiveUser } = useAuth();
  const data = useDashboardData();

  const [showAddMessage, setShowAddMessage] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddChore, setShowAddChore] = useState(false);
  const [showAddShopping, setShowAddShopping] = useState(false);

  const layout = useDashboardLayout(data.layouts);

  const widgetProps = buildWidgetProps(data, requireAuth, {
    setShowAddTask, setShowAddMessage, setShowAddChore, setShowAddShopping,
  }, weatherLocation);

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
    return renderScreensaverPreview(w);
  }, []);

  return (
    <AppShell
      user={activeUser ? { id: activeUser.id, name: activeUser.name, avatarUrl: activeUser.avatarUrl, color: activeUser.color } : undefined}
      onLogout={activeUser ? clearActiveUser : undefined}
      onLogin={handleLogin}
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
            layoutName={data.layouts.savedLayout?.name}
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
          />
        )}

        {layout.editingScreensaver && layout.isEditing ? (
          <LayoutGridEditor
            layout={layout.ssLayout}
            onLayoutChange={layout.handleSsLayoutChange}
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
            <div className="col-span-4 flex items-center justify-center h-64 text-muted-foreground">Loading widgets...</div>
          </DashboardGrid>
        ) : (
          <WidgetErrorBoundary>
            <LayoutGridEditor
              layout={layout.activeWidgets}
              onLayoutChange={layout.isEditing ? layout.setEditingWidgets : () => {}}
              isEditable={layout.isEditing}
              renderWidget={renderDashboardWidget}
              widgetConstraints={dashboardConstraints}
              margin={8}
              headerOffset={140}
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
      </DashboardLayout>
    </AppShell>
  );
}
