'use client';

import { useState, useCallback, useRef } from 'react';
import { DEFAULT_TEMPLATE } from '@/lib/constants/layoutTemplates';
import {
  loadScreensaverLayout,
  saveScreensaverLayout,
  DEFAULT_SCREENSAVER_LAYOUT,
  getScreensaverPresets,
  saveScreensaverPreset,
  deleteScreensaverPreset,
} from '@/components/screensaver/Screensaver';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

interface LayoutsData {
  savedLayout: { id?: string; name: string; widgets: WidgetConfig[] } | null;
  saveLayout: (data: { id?: string; name: string; widgets: WidgetConfig[]; isDefault: boolean }) => Promise<unknown>;
  deleteLayout: (id: string) => Promise<void>;
  allLayouts: Array<{ id: string; name: string; widgets: WidgetConfig[] }>;
}

export function useDashboardLayout(layouts: LayoutsData) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingWidgets, setEditingWidgets] = useState<WidgetConfig[]>([]);
  const preEditWidgetsRef = useRef<WidgetConfig[]>([]);
  const [editingScreensaver, setEditingScreensaver] = useState(false);

  const [ssLayout, setSsLayout] = useState<WidgetConfig[]>(() => loadScreensaverLayout());
  const [ssPresets, setSsPresets] = useState(() =>
    typeof window !== 'undefined' ? getScreensaverPresets() : []
  );

  const activeWidgets = isEditing
    ? editingWidgets
    : layouts.savedLayout?.widgets ?? DEFAULT_TEMPLATE.widgets;

  const handleEditStart = useCallback(() => {
    const current = layouts.savedLayout?.widgets ?? DEFAULT_TEMPLATE.widgets;
    preEditWidgetsRef.current = current;
    setEditingWidgets(current);
    setIsEditing(true);
  }, [layouts.savedLayout]);

  const handleSave = useCallback(async (name?: string) => {
    try {
      await layouts.saveLayout({
        ...(layouts.savedLayout ? { id: layouts.savedLayout.id } : {}),
        name: name || layouts.savedLayout?.name || 'My Layout',
        widgets: editingWidgets,
        isDefault: true,
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save layout:', err);
    }
  }, [layouts.savedLayout, editingWidgets, layouts.saveLayout]);

  const handleSaveAs = useCallback(async () => {
    const name = window.prompt('Layout name:', 'New Layout');
    if (!name) return;
    try {
      await layouts.saveLayout({ name, widgets: editingWidgets, isDefault: true });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save layout:', err);
    }
  }, [editingWidgets, layouts.saveLayout]);

  const handleReset = useCallback(() => {
    setEditingWidgets(DEFAULT_TEMPLATE.widgets);
  }, []);

  const handleCancel = useCallback(() => {
    setEditingWidgets(preEditWidgetsRef.current);
    setIsEditing(false);
  }, []);

  // Screensaver callbacks
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

  return {
    isEditing, setIsEditing,
    editingWidgets, setEditingWidgets,
    editingScreensaver, setEditingScreensaver,
    ssLayout, ssPresets,
    activeWidgets,
    handleEditStart, handleSave, handleSaveAs, handleReset, handleCancel,
    handleSsLayoutChange, handleSsWidgetToggle, handleSsSave, handleSsSaveAs,
    handleSsReset, handleSelectSsTemplate, handleSelectSsPreset, handleDeleteSsPreset,
  };
}
