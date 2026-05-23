'use client';

import * as React from 'react';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { useScreenSafeZones } from '@/lib/hooks/useScreenSafeZones';
import { LayoutEditorShareDialog } from './LayoutEditorShareDialog';
import { LayoutEditorImportDialog } from './LayoutEditorImportExport';
import { CreateDashboardDialog, SaveAsDialog } from './LayoutEditorDashboardManager';
import { RenameDashboardDialog } from './LayoutEditorRenameDashboard';
import { LayoutEditorMeasureBar } from './LayoutEditorMeasureBar';
import { LayoutEditorToolbarLeft } from './LayoutEditorToolbarLeft';
import { LayoutEditorToolbarRight } from './LayoutEditorToolbarRight';
import { useMeasureMode } from './useMeasureMode';
import { useLayoutEditorState } from './useLayoutEditorState';
import type { LayoutEditorProps } from './LayoutEditorTypes';

export type { SavedLayout, DashboardInfo, LayoutEditorProps } from './LayoutEditorTypes';

type ActivePopover = 'dashboard' | 'widgets' | 'templates' | 'community' | 'preview' | 'more' | 'save' | null;

export function LayoutEditor({
  widgets,
  onWidgetsChange,
  onSave,
  onSaveAs,
  onReset,
  onCancel,
  layoutName,
  savedLayouts = [],
  editingScreensaver = false,
  onToggleScreensaverEdit,
  screensaverWidgets,
  onScreensaverSave,
  onScreensaverSaveAs,
  onScreensaverReset,
  onSelectScreensaverTemplate,
  screensaverPresets = [],
  onSelectScreensaverPreset,
  onDeleteScreensaverPreset,
  screenGuideOrientation = 'landscape',
  onScreenGuideOrientationChange,
  enabledSizes = [],
  onToggleSize,
  gridScrollY = 0,
  gridVisibleRows = 48,
  gridScrollX = 0,
  gridVisibleCols = 48,
  gridTotalRows: _gridTotalRows = 96,
  gridTotalCols: _gridTotalCols = 48,
  scrollToGridRef,
  allDashboards = [],
  currentDashboardId,
  onSwitchDashboard,
  onCreateDashboard,
  onRenameDashboard,
  onDeleteDashboard,
}: LayoutEditorProps) {
  const { zones, allSizeNames } = useScreenSafeZones();
  const { confirm: confirmDelete, dialogProps: confirmDialogProps } = useConfirmDialog();
  const { measureMode, measureHideNav, previewZoneIndex, toggleMeasureMode, toggleMeasureNav, setPreviewZoneIndex } = useMeasureMode();
  const effectiveEnabledSizes = enabledSizes.length > 0 ? enabledSizes : allSizeNames;

  const [activePopover, setActivePopover] = useState<ActivePopover>(null);
  const [focusedWidget, setFocusedWidget] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const currentWidgets = useMemo(
    () => editingScreensaver ? (screensaverWidgets || []) : widgets,
    [editingScreensaver, screensaverWidgets, widgets],
  );
  const visibleWidgets = useMemo(
    () => currentWidgets.filter(w => w.visible !== false),
    [currentWidgets],
  );

  const closePopover = useCallback(() => setActivePopover(null), []);

  const state = useLayoutEditorState({
    editingScreensaver,
    layoutName,
    currentWidgets,
    visibleWidgets,
    onWidgetsChange,
    onSave,
    onSaveAs,
    onScreensaverSave,
    onScreensaverSaveAs,
    onSelectScreensaverPreset,
    onRenameDashboard,
    onDeleteDashboard,
    allDashboards,
    currentDashboardId,
    confirmDelete,
    setActivePopover: closePopover,
  });

  const togglePopover = useCallback((name: ActivePopover) => {
    setActivePopover(prev => prev === name ? null : name);
  }, []);

  // Close popover when clicking outside toolbar
  useEffect(() => {
    if (!activePopover) return;
    const handler = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActivePopover(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activePopover]);

  // Close popover when measure mode activates
  useEffect(() => {
    if (measureMode) setActivePopover(null);
  }, [measureMode]);

  const previewZones = useMemo(() =>
    zones[screenGuideOrientation]
      .filter(z => effectiveEnabledSizes.includes(z.name))
      .map(z => ({ name: z.name, color: z.color })),
    [zones, screenGuideOrientation, effectiveEnabledSizes],
  );

  if (measureMode) {
    return (
      <LayoutEditorMeasureBar
        measureHideNav={measureHideNav}
        onToggleNav={toggleMeasureNav}
        onExit={toggleMeasureMode}
        previewZones={previewZones}
        activeZoneIndex={previewZoneIndex}
        onZoneChange={setPreviewZoneIndex}
      />
    );
  }

  return (
    <>
      <div ref={toolbarRef} className="relative z-[200] bg-card/85 backdrop-blur-sm px-4 py-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <LayoutEditorToolbarLeft
            editingScreensaver={editingScreensaver}
            layoutName={layoutName}
            mode={state.mode}
            activePopover={activePopover}
            onTogglePopover={togglePopover}
            screenGuideOrientation={screenGuideOrientation}
            onScreenGuideOrientationChange={onScreenGuideOrientationChange}
            currentWidgets={currentWidgets}
            visibleWidgets={visibleWidgets}
            onWidgetsChange={onWidgetsChange}
            onSelectScreensaverPreset={onSelectScreensaverPreset}
            onSelectScreensaverTemplate={onSelectScreensaverTemplate}
            onSaveAs={onSaveAs}
            onScreensaverSaveAs={onScreensaverSaveAs}
            onApplyCommunityLayout={state.handleApplyCommunityLayout}
            focusedWidget={focusedWidget}
            onFocusedWidgetChange={setFocusedWidget}
            gridScrollY={gridScrollY}
            gridVisibleRows={gridVisibleRows}
            gridScrollX={gridScrollX}
            gridVisibleCols={gridVisibleCols}
            scrollToGridRef={scrollToGridRef}
            allSizeNames={allSizeNames}
            effectiveEnabledSizes={effectiveEnabledSizes}
            onToggleSize={onToggleSize}
            zones={zones}
            validation={state.validation}
            allDashboards={allDashboards}
            currentDashboardId={currentDashboardId}
            onSwitchDashboard={onSwitchDashboard}
            onCreateOpen={() => { state.setShowCreateDialog(true); setActivePopover(null); }}
            onRenameOpen={state.handleRenameOpen}
          />
          <LayoutEditorToolbarRight
            editingScreensaver={editingScreensaver}
            activePopover={activePopover}
            onTogglePopover={togglePopover}
            saveLabel={editingScreensaver ? 'Save Screensaver' : 'Save'}
            saveFeedback={state.saveFeedback}
            exportFeedback={state.exportFeedback}
            allDashboards={allDashboards}
            currentDashboardId={currentDashboardId}
            onToggleMeasureMode={toggleMeasureMode}
            onToggleScreensaverEdit={onToggleScreensaverEdit}
            onSave={state.handleSave}
            onSaveAs={() => { state.setShowSaveAsDialog(true); setActivePopover(null); }}
            onReset={onReset}
            onScreensaverReset={onScreensaverReset}
            onCancel={onCancel}
            onExport={state.handleExport}
            onImportOpen={() => { state.setShowImportDialog(true); setActivePopover(null); }}
            onShareOpen={() => { state.setShowShareDialog(true); setActivePopover(null); }}
            onDeleteDashboard={onDeleteDashboard}
            onHandleDelete={state.handleDelete}
          />
        </div>
      </div>

      <CreateDashboardDialog
        open={state.showCreateDialog}
        onClose={() => state.setShowCreateDialog(false)}
        onCreate={(name, startFrom) => { onCreateDashboard?.(name, startFrom); state.setShowCreateDialog(false); }}
      />

      <SaveAsDialog
        open={state.showSaveAsDialog}
        onClose={() => state.setShowSaveAsDialog(false)}
        allDashboards={allDashboards}
        currentDashboardId={currentDashboardId}
        onOverwrite={(id) => onSaveAs?.({ id })}
        onCreateNew={(name) => onSaveAs?.({ name })}
      />

      <RenameDashboardDialog
        open={state.showRenameDialog}
        currentName={layoutName || ''}
        value={state.renameValue}
        onChange={state.setRenameValue}
        onConfirm={state.handleRenameSubmit}
        onClose={() => state.setShowRenameDialog(false)}
      />

      <LayoutEditorImportDialog
        open={state.showImportDialog}
        onClose={() => state.setShowImportDialog(false)}
        editingScreensaver={editingScreensaver}
        onApply={(importedWidgets) => {
          if (editingScreensaver && onSelectScreensaverPreset) onSelectScreensaverPreset(importedWidgets);
          else onWidgetsChange(importedWidgets);
        }}
      />

      <LayoutEditorShareDialog
        open={state.showShareDialog}
        onClose={() => state.setShowShareDialog(false)}
        layoutName={layoutName}
        mode={state.mode}
        currentWidgets={currentWidgets}
      />

      <ConfirmDialog {...confirmDialogProps} />
    </>
  );
}
