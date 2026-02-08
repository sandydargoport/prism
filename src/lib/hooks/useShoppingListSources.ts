'use client';

import { useState, useEffect, useCallback } from 'react';

interface ShoppingListSource {
  id: string;
  userId: string;
  userName: string | null;
  provider: string;
  externalListId: string;
  externalListName: string | null;
  shoppingListId: string;
  shoppingListName: string | null;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
}

interface CreateShoppingListSourceInput {
  provider: string;
  externalListId: string;
  externalListName?: string;
  shoppingListId: string;
  syncEnabled?: boolean;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
}

interface SyncResult {
  success: boolean;
  created?: number;
  updated?: number;
  deleted?: number;
  errors?: string[];
}

export function useShoppingListSources(userId?: string) {
  const [sources, setSources] = useState<ShoppingListSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSources = useCallback(async () => {
    try {
      setError(null);
      const url = userId
        ? `/api/shopping-list-sources?userId=${userId}`
        : '/api/shopping-list-sources';

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch shopping list sources');
      }

      const data = await response.json();
      setSources(data);
    } catch (err) {
      console.error('Error fetching shopping list sources:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const createSource = useCallback(async (input: CreateShoppingListSourceInput): Promise<ShoppingListSource> => {
    const response = await fetch('/api/shopping-list-sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create shopping list source');
    }

    const newSource = await response.json();
    await fetchSources();
    return newSource;
  }, [fetchSources]);

  const deleteSource = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(`/api/shopping-list-sources/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete shopping list source');
    }

    await fetchSources();
  }, [fetchSources]);

  const updateSource = useCallback(async (
    id: string,
    updates: Partial<Pick<ShoppingListSource, 'syncEnabled' | 'externalListName'>>
  ): Promise<ShoppingListSource> => {
    const response = await fetch(`/api/shopping-list-sources/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update shopping list source');
    }

    const updated = await response.json();
    await fetchSources();
    return updated;
  }, [fetchSources]);

  const syncSource = useCallback(async (id: string): Promise<SyncResult> => {
    const response = await fetch(`/api/shopping-list-sources/${id}/sync`, {
      method: 'POST',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Sync failed');
    }

    const result = await response.json();
    await fetchSources();
    return result;
  }, [fetchSources]);

  const syncAll = useCallback(async (): Promise<{ synced: number; total: number }> => {
    const response = await fetch('/api/shopping-list-sources/sync-all', {
      method: 'POST',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Sync failed');
    }

    const result = await response.json();
    await fetchSources();
    return result;
  }, [fetchSources]);

  return {
    sources,
    isLoading,
    error,
    createSource,
    deleteSource,
    updateSource,
    syncSource,
    syncAll,
    refresh: fetchSources,
  };
}
