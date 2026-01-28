'use client';

import { useState, useEffect, useCallback } from 'react';

export interface WidgetConfig {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visible?: boolean;
  settings?: Record<string, unknown>;
}

export interface Layout {
  id: string;
  name: string;
  isDefault: boolean;
  displayId?: string;
  widgets: WidgetConfig[];
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
      setLayouts(data.layouts);
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

  useEffect(() => {
    fetchLayouts();
  }, [fetchLayouts]);

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
