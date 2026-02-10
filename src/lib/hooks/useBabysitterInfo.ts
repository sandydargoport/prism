'use client';

import { useState, useEffect, useCallback } from 'react';
import { useVisibilityPolling } from './useVisibilityPolling';

export type BabysitterSection = 'emergency_contact' | 'house_info' | 'child_info' | 'house_rule';

export interface BabysitterInfoItem {
  id: string;
  section: BabysitterSection;
  sortOrder: number;
  content: Record<string, unknown> | null;
  isSensitive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UseBabysitterInfoResult {
  items: BabysitterInfoItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addItem: (item: {
    section: BabysitterSection;
    content: Record<string, unknown>;
    isSensitive?: boolean;
    sortOrder?: number;
  }) => Promise<void>;
  updateItem: (id: string, updates: Partial<{
    section: BabysitterSection;
    content: Record<string, unknown>;
    isSensitive: boolean;
    sortOrder: number;
  }>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  reorder: (section: BabysitterSection, itemIds: string[]) => Promise<void>;
  getBySection: (section: BabysitterSection) => BabysitterInfoItem[];
}

export function useBabysitterInfo(
  options: { includeSensitive?: boolean; refreshInterval?: number } = {}
): UseBabysitterInfoResult {
  const { includeSensitive = false, refreshInterval = 5 * 60 * 1000 } = options;

  const [items, setItems] = useState<BabysitterInfoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      setError(null);
      const url = includeSensitive
        ? '/api/babysitter-info?includeSensitive=true'
        : '/api/babysitter-info';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch babysitter info');

      const data = await response.json();
      setItems(data.items);
    } catch (err) {
      console.error('Error fetching babysitter info:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch babysitter info');
    } finally {
      setLoading(false);
    }
  }, [includeSensitive]);

  const addItem = useCallback(async (item: {
    section: BabysitterSection;
    content: Record<string, unknown>;
    isSensitive?: boolean;
    sortOrder?: number;
  }) => {
    const response = await fetch('/api/babysitter-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to add babysitter info');
    }

    await fetchItems();
  }, [fetchItems]);

  const updateItem = useCallback(async (
    id: string,
    updates: Partial<{
      section: BabysitterSection;
      content: Record<string, unknown>;
      isSensitive: boolean;
      sortOrder: number;
    }>
  ) => {
    const response = await fetch(`/api/babysitter-info/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to update babysitter info');
    }

    await fetchItems();
  }, [fetchItems]);

  const deleteItem = useCallback(async (id: string) => {
    const response = await fetch(`/api/babysitter-info/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to delete babysitter info');
    }

    await fetchItems();
  }, [fetchItems]);

  const reorder = useCallback(async (section: BabysitterSection, itemIds: string[]) => {
    const response = await fetch('/api/babysitter-info/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section, itemIds }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to reorder babysitter info');
    }

    await fetchItems();
  }, [fetchItems]);

  const getBySection = useCallback(
    (section: BabysitterSection) => items.filter((item) => item.section === section),
    [items]
  );

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useVisibilityPolling(fetchItems, refreshInterval);

  return {
    items,
    loading,
    error,
    refresh: fetchItems,
    addItem,
    updateItem,
    deleteItem,
    reorder,
    getBySection,
  };
}
