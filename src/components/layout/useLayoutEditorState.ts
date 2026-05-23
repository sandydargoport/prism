'use client';

import { useState, useCallback, useMemo } from 'react';
import { toast } from '@/components/ui/use-toast';
import { WIDGET_REGISTRY } from '@/components/widgets/widgetRegistry';
import { validateCommunityLayout } from '@/lib/community/validateLayout';
import type { LayoutExportV2, ExportWidget } from './LayoutEditorTypes';
import { EXPORT_VERSION } from './LayoutEditorTypes';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

interface UseLayoutEditorStateOptions {
  editingScreensaver: boolean;
  layoutName?: string;
  currentWidgets: WidgetConfig[];
  visibleWidgets: WidgetConfig[];
  onWidgetsChange: (w: WidgetConfig[]) => void;
  onSave: (name?: string) => void | Promise<void>;
  onSaveAs: (name?: string) => void;
  onScreensaverSave?: () => void;
  onScreensaverSaveAs?: () => void;
  onSelectScreensaverPreset?: (w: WidgetConfig[]) => void;
  onRenameDashboard?: (name: string) => void;
  onDeleteDashboard?: () => void;
  allDashboards: Array<{ id: string; name: string; slug: string | null; isDefault: boolean }>;
  currentDashboardId?: string;
  confirmDelete: (title: string, message: string) => Promise<boolean>;
  setActivePopover: (p: null) => void;
}

export function useLayoutEditorState({
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
  setActivePopover,
}: UseLayoutEditorStateOptions) {
  const [exportFeedback, setExportFeedback] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSaveAsDialog, setShowSaveAsDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [saveFeedback, setSaveFeedback] = useState('');

  const mode: 'dashboard' | 'screensaver' = editingScreensaver ? 'screensaver' : 'dashboard';

  const validation = useMemo(() => {
    return validateCommunityLayout({
      type: 'prism-layout' as const,
      version: 2,
      mode: editingScreensaver ? 'screensaver' as const : 'dashboard' as const,
      name: '', description: '', author: '', tags: [], screenSizes: [],
      orientation: 'landscape' as const,
      widgets: visibleWidgets,
    });
  }, [visibleWidgets, editingScreensaver]);

  const buildExportData = useCallback((): LayoutExportV2 => ({
    type: 'prism-layout',
    version: EXPORT_VERSION,
    mode: mode as 'dashboard' | 'screensaver',
    name: layoutName || (editingScreensaver ? 'Screensaver' : 'Dashboard'),
    description: '', author: '', tags: [], screenSizes: [], orientation: 'landscape',
    widgets: currentWidgets.filter(w => w.visible !== false).map((widget): ExportWidget => {
      const reg = WIDGET_REGISTRY[widget.i];
      const exported: ExportWidget = { i: widget.i, x: widget.x, y: widget.y, w: widget.w, h: widget.h };
      if (widget.backgroundColor) exported.backgroundColor = widget.backgroundColor;
      if (widget.backgroundOpacity !== undefined && widget.backgroundOpacity !== 1) {
        exported.backgroundOpacity = widget.backgroundOpacity;
      }
      if (reg?.minW) exported.minW = reg.minW;
      if (reg?.minH) exported.minH = reg.minH;
      return exported;
    }),
  }), [mode, layoutName, editingScreensaver, currentWidgets]);

  const handleExport = useCallback(() => {
    const exportData = buildExportData();
    const result = validateCommunityLayout(exportData);
    if (result.warnings.length > 0) console.warn('Layout export warnings:', result.warnings);
    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2)).then(() => {
      setExportFeedback('Copied!');
      setTimeout(() => setExportFeedback(''), 2000);
    }).catch(() => {
      setExportFeedback('Failed');
      setTimeout(() => setExportFeedback(''), 2000);
    });
    setActivePopover(null);
  }, [buildExportData, setActivePopover]);

  const handleSave = useCallback(async () => {
    try {
      if (editingScreensaver) await onScreensaverSave?.();
      else await onSave();
      setSaveFeedback('Saved!');
      setTimeout(() => setSaveFeedback(''), 2000);
    } catch (err) {
      console.error('Save failed:', err);
      setSaveFeedback('Failed!');
      setTimeout(() => setSaveFeedback(''), 3000);
      toast({ title: 'Failed to save layout', variant: 'destructive' });
    }
  }, [editingScreensaver, onScreensaverSave, onSave]);

  const handleRenameOpen = useCallback(() => {
    setRenameValue(layoutName || '');
    setShowRenameDialog(true);
    setActivePopover(null);
  }, [layoutName, setActivePopover]);

  const handleRenameSubmit = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== layoutName) onRenameDashboard?.(trimmed);
    setShowRenameDialog(false);
  }, [renameValue, layoutName, onRenameDashboard]);

  const handleDelete = useCallback(async () => {
    if (allDashboards.length <= 1) {
      toast({ title: 'Cannot delete the last dashboard', variant: 'warning' });
      return;
    }
    const currentSlug = allDashboards.find(d => d.id === currentDashboardId)?.slug;
    const ok = await confirmDelete(
      `Delete "${layoutName}"?`,
      `Devices bookmarked at /d/${currentSlug || '...'} will stop working.`,
    );
    if (ok) onDeleteDashboard?.();
    setActivePopover(null);
  }, [allDashboards, currentDashboardId, confirmDelete, layoutName, onDeleteDashboard, setActivePopover]);

  const handleApplyCommunityLayout = useCallback((newWidgets: WidgetConfig[], name: string) => {
    if (editingScreensaver && onSelectScreensaverPreset) {
      onSelectScreensaverPreset(newWidgets);
      onScreensaverSaveAs?.();
    } else {
      onWidgetsChange(newWidgets);
      onSaveAs(name);
    }
    setActivePopover(null);
  }, [editingScreensaver, onSelectScreensaverPreset, onWidgetsChange, onSaveAs, onScreensaverSaveAs, setActivePopover]);

  return {
    exportFeedback,
    showImportDialog, setShowImportDialog,
    showShareDialog, setShowShareDialog,
    showCreateDialog, setShowCreateDialog,
    showSaveAsDialog, setShowSaveAsDialog,
    showRenameDialog, setShowRenameDialog,
    renameValue, setRenameValue,
    saveFeedback,
    validation,
    mode,
    handleExport,
    handleSave,
    handleRenameOpen,
    handleRenameSubmit,
    handleDelete,
    handleApplyCommunityLayout,
  };
}
