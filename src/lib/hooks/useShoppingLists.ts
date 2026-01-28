/**
 * ============================================================================
 * PRISM - useShoppingLists Hook
 * ============================================================================
 *
 * Provides a React hook for fetching and managing shopping lists and items.
 *
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

export interface ShoppingItem {
  id: string;
  listId: string;
  name: string;
  quantity?: number;
  unit?: string;
  category?: 'produce' | 'dairy' | 'meat' | 'bakery' | 'frozen' | 'pantry' | 'household' | 'other';
  checked: boolean;
  notes?: string;
  addedBy?: {
    id: string;
    name: string;
    color: string;
  };
  createdAt: Date;
}

export interface ShoppingList {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  items: ShoppingItem[];
  /** User ID this list is assigned to (only they can check off items) */
  assignedTo?: string;
  createdBy?: {
    id: string;
    name: string;
    color: string;
  };
  createdAt: Date;
}

interface UseShoppingListsOptions {
  /** Auto-refresh interval in milliseconds (0 = disabled) */
  refreshInterval?: number;
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
    refreshInterval = 60 * 1000,
  } = options;

  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch shopping lists from the API
   */
  const fetchLists = useCallback(async () => {
    try {
      setError(null);

      const response = await fetch('/api/shopping-lists');

      if (!response.ok) {
        throw new Error('Failed to fetch shopping lists');
      }

      const data = await response.json();

      // For each list, fetch its items
      const listsWithItems = await Promise.all(
        data.lists.map(async (list: {
          id: string;
          name: string;
          description: string | null;
          sortOrder: number;
          assignedTo: string | null;
          createdBy: {
            id: string;
            name: string;
            color: string;
          } | null;
          createdAt: string;
        }) => {
          // Fetch items for this list
          const itemsResponse = await fetch(`/api/shopping-items?listId=${list.id}`);
          const itemsData = await itemsResponse.json();

          const items: ShoppingItem[] = itemsData.items.map((item: {
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
          }) => ({
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
          }));

          return {
            id: list.id,
            name: list.name,
            description: list.description || undefined,
            sortOrder: list.sortOrder,
            items,
            assignedTo: list.assignedTo || undefined,
            createdBy: list.createdBy || undefined,
            createdAt: new Date(list.createdAt),
          };
        })
      );

      setLists(listsWithItems);
    } catch (err) {
      console.error('Error fetching shopping lists:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch shopping lists');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Toggle shopping item checked status
   */
  const toggleItem = useCallback(
    async (itemId: string, checked: boolean) => {
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

        // Optimistically update local state
        setLists((prev) =>
          prev.map((list) => ({
            ...list,
            items: list.items.map((item) =>
              item.id === itemId ? { ...item, checked } : item
            ),
          }))
        );
      } catch (err) {
        console.error('Error updating item:', err);
        // Refresh to get correct state on error
        fetchLists();
        throw err; // Re-throw so caller can handle the error
      }
    },
    [fetchLists]
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
          throw new Error('Failed to add item');
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
      try {
        const response = await fetch(`/api/shopping-items/${itemId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete item');
        }

        // Optimistically update local state
        setLists((prev) =>
          prev.map((list) => ({
            ...list,
            items: list.items.filter((item) => item.id !== itemId),
          }))
        );
      } catch (err) {
        console.error('Error deleting item:', err);
        // Refresh to get correct state on error
        fetchLists();
      }
    },
    [fetchLists]
  );

  // Initial fetch
  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  // Set up refresh interval
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const interval = setInterval(fetchLists, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, fetchLists]);

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
