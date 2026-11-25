'use client';

import * as React from 'react';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { editLink, editsIdleLayout } from '@/components/dashboard/useDashboardLayout';
import { LayoutEditorShareDialog } from './LayoutEditorShareDialog';
import { LayoutEditorImportDialog } from './LayoutEditorImportExport';
import { CreateDashboardDialog, SaveAsDialog } from './LayoutEditorDashboardManager';
import { RenameDashboardDialog } from './LayoutEditorRenameDashboard';
import { LayoutEditorMeasureBar } from './LayoutEditorMeasureBar';
import { EditorBar, editorTabs, type EditorSheet } from './EditorBar';
import { forgetKeptPanel, keepPanelFor, panelKeptFor } from './canvasPanel';
import { dashboardScope, isBuiltIn, LookSheet, WidgetsSheet } from './EditorSheets';
import { ScreenSheet } from './ScreenSheet';
import { EditorHeader, openOtherScreen, useScreens, type DashboardJob } from './EditorHeader';
import type { DashboardInfo } from './LayoutEditorTypes';
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
  fontScale = 100,
  onFontScaleChange,
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
  // The editor's tabs (#1350): with no screen, no Screen tab, so nothing can
  // write to the editing device's own settings. A device nobody named still
  // has one: its idle rows are its own until it is named.
  const hasScreen = !!screenId || !deviceNamed;
  const tabs = editorTabs(hasScreen);

  // The open panel (#1151), beside the canvas (#1265); one is always open, as
  // there is room and nothing is covered. Another dashboard picked in the
  // header opens on the same tab.
  const [sheetState, setSheetState] = useState<EditorSheet>(() => panelKeptFor(currentDashboardId) ?? 'widgets');
  const sheet: EditorSheet = tabs.includes(sheetState) ? sheetState : 'widgets';
  useEffect(() => { forgetKeptPanel(); }, []);
  // Another dashboard shown as it is saved (#1294) is only for Screen: any
  // other panel edits this one.
  const setSheet = useCallback((next: EditorSheet) => {
    setSheetState(next);
    if (next !== 'screen') onPreviewDashboardChange?.(null);
  }, [onPreviewDashboardChange, setSheetState]);
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
  const dashboardChanged = !!dashboardDirty || !!idleDirty || lookDirty;
  const anyChanged = dashboardChanged || held.screen;
  const { ask: askSwitch, promptProps } = useSwitchPrompt();
  const previewName = previewDashboardId ? allDashboards.find((d) => d.id === previewDashboardId)?.name ?? null : null;
  const builtIn = view === 'today';
  // There is a photo frame arrangement to copy onto only when something
  // other than the dashboard itself shows behind it.
  const hasIdleLayout = !!idleBackground && editsIdleLayout(idleBackground);
  const [, setFocusedWidget] = useState<string | null>(null);
  // The named screens, for the header's drop-down and the Screen tab's name.
  const [screens, setScreens] = useScreens();
  const screenName = screenId ? screens?.find((s) => s.id === screenId)?.name ?? null : null;
  const current = allDashboards.find((d) => d.id === currentDashboardId);
  const scope = dashboardScope(layoutName ?? current?.name);

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

  // While arranging the photo frame: the dashboard's widgets put on it
  // (#1350, once More > Use while resting), in front of the user to keep with
  // Done or drop with Cancel like any other edit.
  const handleCopyFromDashboard = async () => {
    const copy = copyLayoutToOther(widgets, 'screensaver');
    const leftOut = copy.leftOut.length
      ? ` Left out, because the photo frame cannot show them: ${copy.leftOut.join(', ')}.`
      : '';
    const ok = await confirmDelete(
      'Copy from the dashboard?',
      `This replaces the photo frame's arrangement with the dashboard's ${copy.widgets.length} widgets.${leftOut} Done keeps it and Cancel puts the old one back.`,
      { confirmLabel: 'Copy', variant: 'default' },
    );
    if (ok) onSelectScreensaverTemplate?.(copy.widgets);
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

  // Editing, in the header: another dashboard on the canvas, on the same tab.
  const pickDashboard = async (d: DashboardInfo) => {
    if (d.id === currentDashboardId) return;
    if (!(await beforeDashboardSwitch())) return;
    keepPanelFor(d.id, sheet);
    if (d.slug) onSwitchDashboard?.(d.slug);
    else if (d.isDefault) window.location.assign(editLink('/'));
  };

  // The header menu (#1350): the dashboard's own jobs, which were the
  // Dashboard and More tabs. New, Delete, Import and the like are their own
  // actions, as before; Rename saves at once.
  const grid = !builtIn || editingScreensaver;
  const hasToday = allDashboards.some(isBuiltIn);
  const reset = builtIn && !editingScreensaver ? onResetBuiltIn : editingScreensaver ? onScreensaverReset : onReset;
  const jobs: DashboardJob[] = [
    { id: 'new', label: 'New dashboard', onSelect: () => state.setShowCreateDialog(true) },
    ...(!hasToday && onCreateDashboard ? [{ id: 'add-glance', label: 'Add Glance', onSelect: () => onCreateDashboard('Glance', 'today') }] : []),
    { id: 'copy', label: 'Make a copy', onSelect: () => state.setShowSaveAsDialog(true) },
    ...(!builtIn ? [{ id: 'rename', label: 'Rename', onSelect: () => state.handleRenameOpen() }] : []),
    { id: 'export', label: 'Export', onSelect: state.handleExport },
    ...(grid ? [
      { id: 'import', label: 'Import', onSelect: () => state.setShowImportDialog(true) },
      { id: 'share', label: 'Share to the gallery', onSelect: () => state.setShowShareDialog(true) },
    ] : []),
    ...(reset ? [{ id: 'reset', label: 'Reset', onSelect: () => reset() }] : []),
    {
      id: 'delete', label: 'Delete', destructive: true,
      disabled: builtIn || allDashboards.length <= 1,
      title: builtIn ? 'Glance is built in and cannot be deleted' : allDashboards.length <= 1 ? 'The only dashboard cannot be deleted' : undefined,
      onSelect: () => state.handleDelete(),
    },
  ];

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
            screenName={screenName}
          />
        );
      case 'widgets':
        return (
          <WidgetsSheet
            scope={scope}
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
            onCopyFromDashboard={hasIdleLayout && !builtIn && onSelectScreensaverTemplate ? () => { void handleCopyFromDashboard(); } : undefined}
            onBackToDashboard={onEditTabChange ? () => onEditTabChange('dashboard') : undefined}
          />
        );
      case 'look':
        return (
          <LookSheet
            scope={scope}
            builtIn={builtIn && !editingScreensaver}
            fontScale={fontScale}
            onFontScaleChange={onFontScaleChange}
            widgets={currentWidgets}
            onWidgetsChange={editingScreensaver && onSelectScreensaverPreset ? onSelectScreensaverPreset : onWidgetsChange}
          />
        );
      default:
        return null;
    }
  })();

  return onEditorPage(
    <>
      <EditorHeader
        screenId={screenId}
        deviceNamed={deviceNamed}
        screens={screens}
        onScreensChange={setScreens}
        onRenamed={(name) => remoteEditHost()?.onRenamed?.(name)}
        onPickScreen={(id) => {
          // Changes not yet saved with Done are asked about first (#1341).
          void openOtherScreen(id, {
            unsaved: anyChanged,
            ask: () => askSwitch('The changes made here are not saved yet.'),
            // Done, which then opens the other screen's editor.
            save: async (href) => {
              if (saveBlocked) {
                setSheet(hasScreen ? 'screen' : 'widgets');
                toast({ title: saveBlocked, variant: 'destructive' });
                return;
              }
              if (host) host.next = href;
              await state.handleSave();
            },
          });
        }}
        dashboards={allDashboards}
        currentDashboardId={currentDashboardId}
        onPickDashboard={(d) => { void pickDashboard(d); }}
        jobs={jobs}
        menuNote={builtIn ? 'Glance is built in. You can change what it shows and reset it, but not delete it. Make a copy to arrange one of your own.' : undefined}
      />

      <EditorBar
        open={sheet}
        onOpenChange={setSheet}
        tabs={tabs}
        sheet={sheetContent}
        dirty={{ screen: screenDirty, widgets: dashboardDirty || idleLayoutDirty, look: lookDirty }}
        unsaved={anyChanged || screenDirty}
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
