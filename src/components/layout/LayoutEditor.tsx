'use client';

import * as React from 'react';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { editsIdleLayout } from '@/components/dashboard/useDashboardLayout';
import { LayoutEditorShareDialog } from './LayoutEditorShareDialog';
import { LayoutEditorImportDialog } from './LayoutEditorImportExport';
import { CreateDashboardDialog, SaveAsDialog } from './LayoutEditorDashboardManager';
import { RenameDashboardDialog } from './LayoutEditorRenameDashboard';
import { LayoutEditorMeasureBar } from './LayoutEditorMeasureBar';
import { EditorBar, type EditorSheet } from './EditorBar';
import { forgetKeptPanel, panelKeptFor } from './canvasPanel';
import { DashboardSheet, LookSheet, MoreSheet, WidgetsSheet, LayoutEditorPreviewPanel } from './EditorSheets';
import { openOtherScreen, ScreenSheet } from './ScreenSheet';
import { useMeasureMode } from './useMeasureMode';
import { useLayoutEditorState } from './useLayoutEditorState';
import type { LayoutEditorProps } from './LayoutEditorTypes';
import { copyLayoutToOther } from './copyLayout';
import { idleSaveProblem } from './IdleBackgroundBar';
import { toast } from '@/components/ui/use-toast';
import { createPortal } from 'react-dom';
import { remoteEditHost, remotePortalRoot } from '@/lib/displays/remoteEdit';
import { MOBILE_BREAKPOINT } from '@/lib/hooks/useIsMobile';
import { useStoredRevision } from '@/lib/hooks/useStoredValue';
import { SwitchPrompt, useSwitchPrompt } from './SwitchPrompt';
import { CanvasCaption, CanvasToggles } from './CanvasToggles';

/**
 * Whether the Screen tab holds changes Done has not saved (#1341, #1349),
 * from what the editor page holds for the screen (or for this device, with
 * no screen): every one of the screen's settings is on the Screen tab now.
 */
export function pendingTabs(pending: { keys: string[]; plan: boolean }): { screen: boolean } {
  return { screen: pending.plan || pending.keys.length > 0 };
}

/**
 * The panels and dialogs are drawn on the canvas editor's page (#1153,
 * #1265), at this device's own size, not shrunk with the picture.
 */
function onEditorPage(node: React.ReactElement): React.ReactElement {
  const root = remotePortalRoot();
  return root ? createPortal(node, root) : node;
}

export type { DashboardInfo, LayoutEditorProps } from './LayoutEditorTypes';


export function LayoutEditor({
  widgets,
  onWidgetsChange,
  onSave,
  onSaveAs,
  onReset,
  onCancel,
  layoutName,
  editTab = 'dashboard',
  onEditTabChange,
  dashboardDirty,
  idleDirty,
  idleLayoutDirty = idleDirty,
  screenDayDirty = false,
  lookDirty = false,
  defaultPending = false,
  onMakeDefault,
  onSaveDashboard,
  editingScreensaver = false,
  screensaverWidgets,
  onScreensaverSaveAs,
  onScreensaverReset,
  onSelectScreensaverTemplate,
  onSelectScreensaverPreset,
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
  gridScrollY = 0,
  gridVisibleRows = 48,
  gridScrollX = 0,
  gridVisibleCols = 48,
  scrollToGridRef,
  allDashboards = [],
  currentDashboardId,
  onSwitchDashboard,
  onCreateDashboard,
  onRenameDashboard,
  onDeleteDashboard,
  view,
  onResetBuiltIn,
  selectedWidgetId = null,
  onSelectedWidgetChange,
  hideEmptyByDefault = false,
  idleToggles = false,
  canvasCaption,
  onNewDashboard,
}: LayoutEditorProps) {
  const { confirm: confirmDelete, dialogProps: confirmDialogProps } = useConfirmDialog();
  const { measureMode, measureHideNav, toggleMeasureMode, toggleMeasureNav } = useMeasureMode();

  // The open panel (#1151), beside the canvas (#1265); one is always open, as
  // there is room and nothing is covered. A dashboard picked on Dashboard
  // opens on Dashboard still.
  const [sheet, setSheetState] = useState<EditorSheet>(() => panelKeptFor(currentDashboardId) ?? 'widgets');
  useEffect(() => { forgetKeptPanel(); }, []);
  // Another dashboard shown as it is saved (#1294) is only for Screen: any
  // other panel edits this one.
  const setSheet = useCallback((next: EditorSheet) => {
    setSheetState(next);
    if (next !== 'screen') onPreviewDashboardChange?.(null);
  }, [onPreviewDashboardChange]);
  // A widget selected on the canvas brings Widgets forward, where its own
  // settings are (#1323). Only a new selection does: another panel opened
  // while it stays selected stays open.
  const shownSelection = useRef<string | null>(null);
  useEffect(() => {
    if (selectedWidgetId && selectedWidgetId !== shownSelection.current) setSheet('widgets');
    shownSelection.current = selectedWidgetId;
  }, [selectedWidgetId, setSheet]);
  const backToThis = useCallback(() => onPreviewDashboardChange?.(null), [onPreviewDashboardChange]);
  // The Screen tab's dot (#1326, #1341, #1349): the screen's dashboard,
  // switches, own settings or idle looks differ from when the editor page
  // opened. A setting written anywhere redraws it.
  useStoredRevision();
  const host = remoteEditHost();
  const held = pendingTabs(host?.pending?.() ?? { keys: [], plan: !!host?.unsaved?.() });
  const screenDirty = held.screen || screenDayDirty;
  // What a switch to another dashboard would lose; the screen's own settings
  // stay held on the editor page through it.
  const dashboardChanged = !!dashboardDirty || !!idleDirty || lookDirty || defaultPending;
  const anyChanged = dashboardChanged || held.screen;
  const { ask: askSwitch, promptProps } = useSwitchPrompt();
  const previewName = previewDashboardId ? allDashboards.find((d) => d.id === previewDashboardId)?.name ?? null : null;
  const builtIn = view === 'today';
  // There is a screensaver layout to copy to or from only when something
  // other than the dashboard itself shows behind it.
  const hasIdleLayout = !!idleBackground && editsIdleLayout(idleBackground);
  const [focusedWidget, setFocusedWidget] = useState<string | null>(null);

  const currentWidgets = useMemo(
    () => editingScreensaver ? (screensaverWidgets || []) : widgets,
    [editingScreensaver, screensaverWidgets, widgets],
  );
  const visibleWidgets = useMemo(
    () => currentWidgets.filter(w => w.visible !== false),
    [currentWidgets],
  );

  // A day and night pair whose offsets cross is not saved (#782).
  const saveBlocked = idleBackground ? idleSaveProblem(idleBackground, idleCheck) : null;
  const guardedSave = useCallback(async (name?: string) => {
    if (saveBlocked) {
      // Why is on the Screen tab, by the night rule.
      setSheet('screen');
      toast({ title: saveBlocked, variant: 'destructive' });
      return;
    }
    await onSave(name);
  }, [saveBlocked, setSheet, onSave]);
  const guardedSaveAs = (opts: { id: string } | { name: string }) => {
    if (saveBlocked) {
      setSheet('screen');
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

  // Changing the dashboard being edited with changes not saved asks first
  // (#1341). Save and switch saves this one, as Done does, and stays in the editor.
  const beforeDashboardSwitch = async (): Promise<boolean> => {
    if (!dashboardChanged) return true;
    const choice = await askSwitch(`${layoutName ? `${layoutName} has` : 'This dashboard has'} changes not saved yet.`);
    if (choice === 'stay') return false;
    if (choice === 'save') {
      if (saveBlocked) {
        setSheet('screen');
        toast({ title: saveBlocked, variant: 'destructive' });
        return false;
      }
      await onSaveDashboard?.();
    }
    return true;
  };

  // A dialog opens over the screen, so the sheet closes first: left open, it
  // would sit over the dialog's buttons.
  const sheetContent = (() => {
    switch (sheet) {
      case 'screen':
        return (
          <ScreenSheet
            idleBackground={idleBackground}
            onIdleBackgroundChange={onIdleBackgroundChange}
            idleCheck={idleCheck}
            onShowIdle={(night) => { onPreviewDashboardChange?.(null); onEditTabChange?.('idle'); onIdleHalfChange?.(night ? 'night' : 'day'); }}
            onArrangePhotoFrame={(night) => {
              onPreviewDashboardChange?.(null);
              onEditTabChange?.('idle');
              onIdleHalfChange?.(night ? 'night' : 'day');
              setSheet('widgets');
            }}
            // The frame is drawn at the screen's own size: under a wall's width it never idles.
            canIdle={typeof window === 'undefined' || window.innerWidth >= MOBILE_BREAKPOINT}
            screenPlan={screenPlan}
            onScreenPlanChange={onScreenPlanChange}
            screenId={screenId}
            deviceNamed={deviceNamed}
            onDeviceNamed={onDeviceNamed}
            allDashboards={allDashboards}
            currentDashboardId={currentDashboardId}
            onSwitchDashboard={onSwitchDashboard}
            onNewDashboard={onNewDashboard}
            onRenamed={(name) => remoteEditHost()?.onRenamed?.(name)}
            onPickScreen={(id) => {
              // Changes not yet saved with Done are asked about first (#1341).
              void openOtherScreen(id, {
                unsaved: anyChanged,
                ask: () => askSwitch('The changes made here are not saved yet.'),
                // Done, which then opens the other screen's editor.
                save: async (href) => {
                  if (saveBlocked) {
                    setSheet('screen');
                    toast({ title: saveBlocked, variant: 'destructive' });
                    return;
                  }
                  if (host) host.next = href;
                  await state.handleSave();
                },
              });
            }}
          />
        );
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
            defaultPending={defaultPending}
            beforeSwitch={beforeDashboardSwitch}
            onSetDefault={() => onMakeDefault?.()}
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
            selectedWidgetId={selectedWidgetId}
            onSelectedWidgetChange={onSelectedWidgetChange}
            hideEmptyByDefault={hideEmptyByDefault}
            idleToggles={idleToggles}
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
        open={sheet}
        onOpenChange={setSheet}
        sheet={sheetContent}
        dirty={{ screen: screenDirty, dashboard: defaultPending, widgets: dashboardDirty || idleLayoutDirty, look: lookDirty }}
        doneLabel={state.saveFeedback || 'Done'}
        doneBlocked={saveBlocked}
        onDone={state.handleSave}
        onCancel={onCancel}
        previewName={editTab === 'idle' ? null : previewName}
        onLeavePreview={backToThis}
      />

      {/* Over the canvas: which state it draws, and under it what that is (#1348). */}
      <CanvasToggles
        idle={editTab === 'idle'}
        night={idleHalf === 'night'}
        onIdleChange={(idle) => { onPreviewDashboardChange?.(null); onEditTabChange?.(idle ? 'idle' : 'dashboard'); }}
        onNightChange={(night) => { onPreviewDashboardChange?.(null); onIdleHalfChange?.(night ? 'night' : 'day'); }}
      />
      {canvasCaption && <CanvasCaption text={canvasCaption} />}

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
      <SwitchPrompt {...promptProps} />
    </>
  );
}
