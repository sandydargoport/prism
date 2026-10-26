'use client';

import { useState, useCallback } from 'react';
import { useFetchOnMount } from './useFetchOnMount';

/** What the display shows when idle: a separate screensaver layout, or the
 *  dashboard itself with only some widgets left showing (calm mode, #691). */
export type ScreensaverMode = 'separate' | 'calm';

export interface WidgetConfig {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visible?: boolean;
  backgroundColor?: string;
  backgroundOpacity?: number;
  outlineColor?: string;
  outlineOpacity?: number;
  textColor?: string;
  textOpacity?: number;
  textScale?: number;
  gridLineOpacity?: number;
  cellBackgroundColor?: string;
  cellBackgroundOpacity?: number;
  /** Calm mode: stays on screen while the display is idle. Unset uses the
   *  default for the widget (see shownWhenIdle). */
  showWhenIdle?: boolean;
  settings?: Record<string, unknown>;
}

export interface Layout {
  id: string;
  name: string;
  slug: string | null;
  isDefault: boolean;
  widgets: WidgetConfig[];
  screensaverWidgets: WidgetConfig[] | null;
  screensaverMode?: ScreensaverMode;
  orientation: string;
  fontScale: number | null;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface UseLayoutsResult {
  layouts: Layout[];
  loading: boolean;
  error: string | null;
  activeLayout: Layout | null;
  refresh: () => Promise<void>;
  saveLayout: (layout: Partial<Layout> & { name: string; widgets: WidgetConfig[] }) => Promise<Layout>;
  deleteLayout: (id: string) => Promise<void>;
  setDefault: (id: string) => Promise<void>;
}

export function useLayouts(): UseLayoutsResult {
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLayouts = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/layouts');
      if (!response.ok) throw new Error('Failed to fetch layouts');
      const data = await response.json();
      // Normalize widget format: DB may store {type, position:{x,y,w,h}}
      // but we need {i, x, y, w, h}
      const normalized = (data.layouts || []).map((l: Layout) => {
        let widgets = (l.widgets || []).map((w: WidgetConfig & { type?: string; position?: { x: number; y: number; w: number; h: number } }) => {
          if (w.i !== undefined && w.x !== undefined) return w;
          return {
            i: w.type || w.i,
            x: w.position?.x ?? w.x ?? 0,
            y: w.position?.y ?? w.y ?? 0,
            w: w.position?.w ?? w.w ?? 1,
            h: w.position?.h ?? w.h ?? 1,
            visible: w.visible,
            settings: w.settings,
          } as WidgetConfig;
        });
        // Migrate settings.backgroundColor/backgroundOpacity to top-level fields
        widgets = widgets.map(w => {
          if (w.settings?.backgroundColor && !w.backgroundColor) {
            const { backgroundColor, backgroundOpacity, ...rest } = w.settings as Record<string, unknown> & { backgroundColor?: string; backgroundOpacity?: number };
            return { ...w, backgroundColor, backgroundOpacity: backgroundOpacity ?? w.backgroundOpacity, settings: Object.keys(rest).length > 0 ? rest : undefined };
          }
          return w;
        });
        // Migrate old 4-col layouts to 12-col: if max(x+w) <= 4, scale by 3
        const maxRight = Math.max(...widgets.map(w => w.x + w.w), 0);
        if (maxRight > 0 && maxRight <= 4) {
          widgets = widgets.map(w => ({
            ...w,
            x: w.x * 3,
            y: w.y * 3,
            w: w.w * 3,
            h: w.h * 3,
          }));
        }
        // Migrate 12-col layouts to 48-col: if max(x+w) > 4 and <= 12, scale by 4
        const maxRight48 = Math.max(...widgets.map(w => w.x + w.w), 0);
        if (maxRight48 > 4 && maxRight48 <= 12) {
          widgets = widgets.map(w => ({
            ...w,
            x: w.x * 4,
            y: w.y * 4,
            w: w.w * 4,
            h: w.h * 4,
          }));
        }
        return { ...l, widgets };
      });
      setLayouts(normalized);
    } catch (err) {
      console.error('Error fetching layouts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch layouts');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveLayout = useCallback(
    async (layout: Partial<Layout> & { name: string; widgets: WidgetConfig[] }): Promise<Layout> => {
      const isUpdate = layout.id;
      const url = isUpdate ? `/api/layouts/${layout.id}` : '/api/layouts';
      const method = isUpdate ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layout),
      });

      if (!response.ok) throw new Error('Failed to save layout');
      const saved = await response.json();
      await fetchLayouts();
      return saved;
    },
    [fetchLayouts]
  );

  const deleteLayout = useCallback(
    async (id: string) => {
      const response = await fetch(`/api/layouts/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete layout');
      await fetchLayouts();
    },
    [fetchLayouts]
  );

  const setDefault = useCallback(
    async (id: string) => {
      const response = await fetch(`/api/layouts/${id}/default`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to set default layout');
      await fetchLayouts();
    },
    [fetchLayouts]
  );

  useFetchOnMount(fetchLayouts);

  const activeLayout = layouts.find(l => l.isDefault) || layouts[0] || null;

  return {
    layouts,
    loading,
    error,
    activeLayout,
    refresh: fetchLayouts,
    saveLayout,
    deleteLayout,
    setDefault,
  };
}
