/**
 *
 * Provides a React hook for fetching and managing shopping lists and items.
 *
 */

'use client';

import { useState, useCallback } from 'react';
import { useVisibilityPolling } from './useVisibilityPolling';
import { usePollingInterval } from './usePollingInterval';
import { useCachedMountFetch } from './useCachedMountFetch';
import { navCacheGet, navCacheSet, navCacheUpdate } from '@/lib/utils/navCache';

// Re-export types from shared types for consumers that import from this hook
export type { ShoppingItem, ShoppingList } from '@/types';
import type { ShoppingItem, ShoppingList } from '@/types';

interface UseShoppingListsOptions {
  /** Auto-refresh interval in milliseconds (0 = disabled) */
  refreshInterval?: number;
  /** When false, skip initial fetch and polling. Fetch triggers when enabled transitions to true. */
  enabled?: boolean;
}

interface UseShoppingListsResult {
  lists: ShoppingList[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  toggleItem: (itemId: string, checked: boolean) => Promise<void>;
  addItem: (listId: string, data: {
    name: string;
    quantity?: number;
    unit?: string;
    category?: string;
    notes?: string;
    addedBy?: string;
  }) => Promise<ShoppingItem>;
  deleteItem: (itemId: string) => Promise<void>;
}

/**
 * Hook for fetching shopping lists and their items from the API
 */
export function useShoppingLists(options: UseShoppingListsOptions = {}): UseShoppingListsResult {
  const {
    refreshInterval = 5 * 60 * 1000,
    enabled = true,
  } = options;

  const CACHE_KEY = '/api/shopping-lists?includeItems=true';
  // One refresh interval's worth of age is what this hook already tolerates,
  // so a cached value that young is current by its own standard.
  const maxAgeMs = usePollingInterval(refreshInterval);
  const cached = navCacheGet<ShoppingList[]>(CACHE_KEY, maxAgeMs);
  const [lists, setLists] = useState<ShoppingList[]>(() => cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch shopping lists from the API
   */
  const fetchLists = useCallback(async () => {
    if (!navCacheGet(CACHE_KEY, maxAgeMs)) setLoading(true);
    try {
      setError(null);

      const response = await fetch('/api/shopping-lists?includeItems=true');

      if (!response.ok) {
        if (response.status === 401) {
          window.dispatchEvent(new Event('prism:auth-expired'));
        }
        throw new Error('Failed to fetch shopping lists');
      }

      const data = await response.json();

      const listsWithItems = data.lists.map((list: {
        id: string;
        name: string;
        description: string | null;
        listType: 'grocery' | 'hardware' | 'general' | 'other' | null;
        sortOrder: number;
        visibleCategories: string[] | null;
        assignedTo: string | null;
        createdBy: {
          id: string;
          name: string;
          color: string;
        } | null;
        createdAt: string;
        items: Array<{
          id: string;
          listId: string;
          name: string;
          quantity: number | null;
          unit: string | null;
          category: 'produce' | 'dairy' | 'meat' | 'bakery' | 'frozen' | 'pantry' | 'household' | 'other' | null;
          checked: boolean;
          notes: string | null;
          addedBy: {
            id: string;
            name: string;
            color: string;
          } | null;
          createdAt: string;
        }>;
      }) => ({
        id: list.id,
        name: list.name,
        description: list.description || undefined,
        listType: list.listType || 'grocery',
        sortOrder: list.sortOrder,
        visibleCategories: list.visibleCategories ?? undefined,
        items: (list.items || []).map((item) => ({
          id: item.id,
          listId: item.listId,
          name: item.name,
          quantity: item.quantity || undefined,
          unit: item.unit || undefined,
          category: item.category || undefined,
          checked: item.checked,
          notes: item.notes || undefined,
          addedBy: item.addedBy || undefined,
          createdAt: new Date(item.createdAt),
        })),
        assignedTo: list.assignedTo || undefined,
        createdBy: list.createdBy || undefined,
        createdAt: new Date(list.createdAt),
      }));

      navCacheSet(CACHE_KEY, listsWithItems);
      setLists(listsWithItems);
    } catch (err) {
      console.error('Error fetching shopping lists:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch shopping lists');
    } finally {
      setLoading(false);
    }
  }, [maxAgeMs]);

  /**
   * Toggle shopping item checked status
   */
  const toggleItem = useCallback(
    async (itemId: string, checked: boolean) => {
      const setChecked = (value: boolean) => (lists: ShoppingList[]) =>
        lists.map((list) => ({
          ...list,
          items: list.items.map((item) =>
            item.id === itemId ? { ...item, checked: value } : item
          ),
        }));

      // Optimistically update UI immediately.
      //
      // Written through to the shared cache as well as to state, because this
      // is the one mutation here that never refetches. State and cache would
      // otherwise disagree until the next poll, and a widget mounting in
      // between — the screensaver's copy, most often — would read the cache and
      // show the item unticked again. The entry keeps its original age: nothing
      // was fetched, a local correction was applied.
      setLists(setChecked(checked));
      navCacheUpdate<ShoppingList[]>(CACHE_KEY, setChecked(checked));

      try {
        const response = await fetch(`/api/shopping-items/${itemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checked }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to update item');
        }
      } catch (err) {
        console.error('Error updating item:', err);
        // Revert optimistic update on failure
        setLists(setChecked(!checked));
        navCacheUpdate<ShoppingList[]>(CACHE_KEY, setChecked(!checked));
        throw err;
      }
    },
    []
  );

  /**
   * Add a new item to a shopping list
   */
  const addItem = useCallback(
    async (listId: string, data: {
      name: string;
      quantity?: number;
      unit?: string;
      category?: string;
      notes?: string;
      addedBy?: string;
    }) => {
      try {
        const response = await fetch('/api/shopping-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listId, ...data }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          const detail = data.details?.[0]?.message
            ?? data.error
            ?? `HTTP ${response.status}`;
          throw new Error(`Failed to add item: ${detail}`);
        }

        const newItem = await response.json();

        // Refresh to get updated state
        await fetchLists();

        return {
          id: newItem.id,
          listId: newItem.listId,
          name: newItem.name,
          quantity: newItem.quantity || undefined,
          unit: newItem.unit || undefined,
          category: newItem.category || undefined,
          checked: newItem.checked,
          notes: newItem.notes || undefined,
          addedBy: newItem.addedBy || undefined,
          createdAt: new Date(newItem.createdAt),
        };
      } catch (err) {
        console.error('Error adding item:', err);
        throw err;
      }
    },
    [fetchLists]
  );

  /**
   * Delete an item from a shopping list
   */
  const deleteItem = useCallback(
    async (itemId: string) => {
      // Optimistically remove from UI immediately
      setLists((prev) =>
        prev.map((list) => ({
          ...list,
          items: list.items.filter((item) => item.id !== itemId),
        }))
      );

      try {
        const response = await fetch(`/api/shopping-items/${itemId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete item');
        }
      } catch (err) {
        console.error('Error deleting item:', err);
        // Revert by re-fetching true state from server
        await fetchLists();
      }
    },
    [fetchLists]
  );

  const adoptLists = useCallback((cachedLists: ShoppingList[]) => {
    setLists(cachedLists);
    setLoading(false);
  }, []);

  // Initial fetch (skipped when disabled, or when the cache was filled within
  // one refresh interval)
  useCachedMountFetch<ShoppingList[]>({
    key: CACHE_KEY,
    enabled,
    maxAgeMs,
    fetch: fetchLists,
    adopt: adoptLists,
  });

  // Set up refresh interval with visibility-based pause (disabled when not enabled)
  useVisibilityPolling(fetchLists, enabled ? refreshInterval : 0);

  return {
    lists,
    loading,
    error,
    refresh: fetchLists,
    toggleItem,
    addItem,
    deleteItem,
  };
}
