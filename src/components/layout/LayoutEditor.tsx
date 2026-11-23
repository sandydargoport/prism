'use client';

import * as React from 'react';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { useScreenSafeZones } from '@/lib/hooks/useScreenSafeZones';
import { useResetOn } from '@/lib/hooks/useResetOn';
import { editsIdleLayout } from '@/components/dashboard/useDashboardLayout';
import { LayoutEditorShareDialog } from './LayoutEditorShareDialog';
import { LayoutEditorImportDialog } from './LayoutEditorImportExport';
import { CreateDashboardDialog, SaveAsDialog } from './LayoutEditorDashboardManager';
import { RenameDashboardDialog } from './LayoutEditorRenameDashboard';
import { LayoutEditorMeasureBar } from './LayoutEditorMeasureBar';
import { EditorBar, type EditorSheet } from './EditorBar';
import { forgetKeptPanel, panelKeptFor } from './canvasPanel';
import { DashboardSheet, DaySheet, LookSheet, MoreSheet, WidgetsSheet, LayoutEditorPreviewPanel } from './EditorSheets';
import { useMeasureMode } from './useMeasureMode';
import { useLayoutEditorState } from './useLayoutEditorState';
import type { LayoutEditorProps } from './LayoutEditorTypes';
import { copyLayoutToOther } from './copyLayout';
import { idleSaveProblem } from './IdleBackgroundBar';
import { toast } from '@/components/ui/use-toast';
import { createPortal } from 'react-dom';
import { remoteEditHost, remotePortalRoot } from '@/lib/displays/remoteEdit';

/**
 * The panels and dialogs are drawn on the canvas editor's page (#1153,
 * #1265), at this device's own size, not shrunk with the picture.
 */
function onEditorPage(node: React.ReactElement): React.ReactElement {
  const root = remotePortalRoot();
  return root ? createPortal(node, root) : node;
}

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
  editTab = 'dashboard',
  onEditTabChange,
  dashboardDirty,
  idleDirty,
  editingScreensaver = false,
  screensaverWidgets,
  onScreensaverSaveAs,
  onScreensaverReset,
  onSelectScreensaverTemplate,
  screensaverPresets = [],
  onSelectScreensaverPreset,
  onDeleteScreensaverPreset,
  idleBackground,
  onIdleBackgroundChange,
  idleHalf = 'day',
  onIdleHalfChange,
  idleCheck = {},
  screenPlan = null,
  onScreenPlanChange,
  previewDashboardId = null,
  onPreviewDashboardChange,
  screenId = null,
  deviceNamed = false,
  onDeviceNamed,
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
  view,
  onResetBuiltIn,
}: LayoutEditorProps) {
  const { zones, allSizeNames } = useScreenSafeZones();
  const { confirm: confirmDelete, dialogProps: confirmDialogProps } = useConfirmDialog();
  const { measureMode, measureHideNav, toggleMeasureMode, toggleMeasureNav } = useMeasureMode();
  const effectiveEnabledSizes = enabledSizes.length > 0 ? enabledSizes : allSizeNames;

  const [activePopover, setActivePopover] = useState<ActivePopover>(null);
  // A screen's own settings (rest after, how dark) show when the editor is
  // for a screen: the one edited on the canvas, if any (#1281). A dashboard
  // edited at a chosen size has none.
  const [forScreen] = useState(() => remoteEditHost()?.displayId !== null);
  // The open panel (#1151), beside the canvas (#1265); one is always open, as
  // there is room and nothing is covered. A dashboard picked on Dashboard
  // opens on Dashboard still.
  const [sheet, setSheetState] = useState<EditorSheet>(() => panelKeptFor(currentDashboardId) ?? 'widgets');
  useEffect(() => { forgetKeptPanel(); }, []);
  // Through the day's slider and Resting's See it show the screen resting or
  // at night, which stays with another panel open so its layout can be
  // arranged; Dashboard, or Back to in use, goes back. Another dashboard shown
  // as it is saved (#1294) is only for the slider: any other panel edits this one.
  const setSheet = useCallback((next: EditorSheet) => {
    setSheetState(next);
    if (next !== 'day') onPreviewDashboardChange?.(null);
    if (next === 'dashboard') onEditTabChange?.('dashboard');
  }, [onEditTabChange, onPreviewDashboardChange]);
  const backToInUse = useCallback(() => {
    onPreviewDashboardChange?.(null);
    onEditTabChange?.('dashboard');
  }, [onEditTabChange, onPreviewDashboardChange]);
  const previewName = previewDashboardId ? allDashboards.find((d) => d.id === previewDashboardId)?.name ?? null : null;
  const builtIn = view === 'today';
  // There is a screensaver layout to copy to or from only when something
  // other than the dashboard itself shows behind it.
  const hasIdleLayout = !!idleBackground && editsIdleLayout(idleBackground);
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

  // A day and night pair whose offsets cross is not saved (#782).
  const saveBlocked = idleBackground ? idleSaveProblem(idleBackground, idleCheck) : null;
  const guardedSave = useCallback(async (name?: string) => {
    if (saveBlocked) {
      onEditTabChange?.('idle');
      toast({ title: saveBlocked, variant: 'destructive' });
      return;
    }
    await onSave(name);
  }, [saveBlocked, onEditTabChange, onSave]);
  const guardedSaveAs = (opts: { id: string } | { name: string }) => {
    if (saveBlocked) {
      onEditTabChange?.('idle');
      toast({ title: saveBlocked, variant: 'destructive' });
      return;
    }
    onSaveAs?.(opts);
  };

  const state = useLayoutEditorState({
    editingScreensaver,
    layoutName,
    currentWidgets,
    visibleWidgets,
    onWidgetsChange,
    onSave: guardedSave,
    onSaveAs,
    onScreensaverSaveAs,
    onSelectScreensaverPreset,
    onRenameDashboard,
    onDeleteDashboard,
    allDashboards,
    currentDashboardId,
    confirmDelete,
    setActivePopover: closePopover,
  });

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
  useResetOn(measureMode, () => {
    if (measureMode) setActivePopover(null);
  });

  // Copy this layout over the other one and switch to it, so the result is
  // in front of the user to Save or Cancel like any other edit.
  const handleCopyToOther = async () => {
    const copy = copyLayoutToOther(
      editingScreensaver ? (screensaverWidgets ?? []) : widgets,
      editingScreensaver ? 'dashboard' : 'screensaver',
    );
    const target = editingScreensaver ? 'dashboard' : 'idle screen';
    const leftOut = copy.leftOut.length
      ? ` Left out, because the screensaver cannot show them: ${copy.leftOut.join(', ')}.`
      : '';
    const ok = await confirmDelete(
      `Copy to ${target}?`,
      `This replaces the ${target}'s layout with these ${copy.widgets.length} widgets.${leftOut} You will see the result next; Save keeps it and Cancel puts the old one back.`,
      { confirmLabel: 'Copy', variant: 'default' },
    );
    if (!ok) return;
    if (editingScreensaver) onWidgetsChange(copy.widgets);
    else onSelectScreensaverTemplate?.(copy.widgets);
    onEditTabChange?.(editingScreensaver ? 'dashboard' : 'idle');
  };

  if (measureMode) {
    return onEditorPage(
      <LayoutEditorMeasureBar
        measureHideNav={measureHideNav}
        onToggleNav={toggleMeasureNav}
        onExit={toggleMeasureMode}
      />
    );
  }

  const setDefault = async () => {
    if (!currentDashboardId) return;
    try {
      const res = await fetch(`/api/layouts/${currentDashboardId}/default`, { method: 'POST' });
      if (res.ok) window.location.reload();
    } catch { /* the sheet stays put on failure */ }
  };

  // A dialog opens over the screen, so the sheet closes first: left open, it
  // would sit over the dialog's buttons.
  const sheetContent = (() => {
    switch (sheet) {
      case 'dashboard':
        return (
          <DashboardSheet
            allDashboards={allDashboards}
            currentDashboardId={currentDashboardId}
            shownHereId={screenId && screenPlan ? screenPlan.dashboardId ?? allDashboards.find((d) => d.isDefault)?.id ?? null : null}
            onSwitchDashboard={onSwitchDashboard}
            onAddToday={onCreateDashboard ? () => onCreateDashboard('Glance', 'today') : undefined}
            onCreateOpen={() => state.setShowCreateDialog(true)}
            onRenameOpen={() => state.handleRenameOpen()}
            onSaveAsOpen={() => state.setShowSaveAsDialog(true)}
            onSetDefault={setDefault}
            onDelete={() => state.handleDelete()}
            onResetBuiltIn={onResetBuiltIn}
          />
        );
      case 'widgets':
        return (
          <WidgetsSheet
            builtIn={builtIn}
            editingScreensaver={editingScreensaver}
            orientation={screenGuideOrientation}
            widgets={currentWidgets}
            onWidgetsChange={onWidgetsChange}
            onScreensaverPreset={onSelectScreensaverPreset}
            onScreensaverTemplate={onSelectScreensaverTemplate}
            onApplyCommunityLayout={state.handleApplyCommunityLayout}
            onFocusedWidgetChange={setFocusedWidget}
          />
        );
      case 'day':
        return (
          <DaySheet
            idleBackground={idleBackground}
            onIdleBackgroundChange={onIdleBackgroundChange}
            idleHalf={idleHalf}
            onIdleHalfChange={onIdleHalfChange}
            editTab={editTab}
            onEditTabChange={onEditTabChange}
            idleCheck={idleCheck}
            screenPlan={screenPlan}
            onScreenPlanChange={onScreenPlanChange}
            previewDashboardId={previewDashboardId}
            onPreviewDashboardChange={onPreviewDashboardChange}
            screenId={screenId}
            deviceNamed={deviceNamed}
            onDeviceNamed={onDeviceNamed}
            forScreen={forScreen}
            allDashboards={allDashboards}
            currentDashboardId={currentDashboardId}
            onSwitchDashboard={onSwitchDashboard}
            onOpenLook={() => setSheet('look')}
          />
        );
      case 'look':
        return (
          <LookSheet
            orientation={screenGuideOrientation}
            onOrientationChange={onScreenGuideOrientationChange}
            onMeasure={() => toggleMeasureMode()}
          />
        );
      case 'more':
        return (
          <MoreSheet
            builtIn={builtIn}
            editingScreensaver={editingScreensaver}
            hasIdleLayout={hasIdleLayout}
            idleTab={editTab === 'idle'}
            exportFeedback={state.exportFeedback}
            onExport={state.handleExport}
            onImportOpen={() => state.setShowImportDialog(true)}
            onShareOpen={() => state.setShowShareDialog(true)}
            onReset={() => (editingScreensaver ? onScreensaverReset?.() : onReset())}
            onCopyToOther={() => { void handleCopyToOther(); }}
            preview={(
              <LayoutEditorPreviewPanel
                visibleWidgets={visibleWidgets}
                focusedWidget={focusedWidget ?? undefined}
                gridScrollY={gridScrollY}
                gridVisibleRows={gridVisibleRows}
                gridScrollX={gridScrollX}
                gridVisibleCols={gridVisibleCols}
                scrollToGridRef={scrollToGridRef}
                screenGuideOrientation={screenGuideOrientation}
                effectiveEnabledSizes={effectiveEnabledSizes}
                onToggleSize={onToggleSize}
                allSizeNames={allSizeNames}
                zones={zones}
                validation={state.validation}
              />
            )}
          />
        );
      default:
        return null;
    }
  })();

  return onEditorPage(
    <>
      <EditorBar
        ref={toolbarRef}
        open={sheet}
        onOpenChange={setSheet}
        sheet={sheetContent}
        dirty={{ widgets: dashboardDirty, day: idleDirty }}
        doneLabel={state.saveFeedback || 'Done'}
        doneBlocked={saveBlocked}
        onDone={state.handleSave}
        onCancel={onCancel}
        resting={editTab === 'idle' ? (idleHalf === 'night' ? 'night' : 'resting') : null}
        previewName={editTab === 'idle' ? null : previewName}
        onLeaveResting={backToInUse}
      />

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
        onOverwrite={(id) => guardedSaveAs({ id })}
        onCreateNew={(name) => guardedSaveAs({ name })}
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
