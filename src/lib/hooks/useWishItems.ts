'use client';

import { useState, useCallback, useMemo } from 'react';
import { useVisibilityPolling } from './useVisibilityPolling';
import { usePollingInterval } from './usePollingInterval';
import { useCachedMountFetch } from './useCachedMountFetch';
import { navCacheGet, navCacheSet } from '@/lib/utils/navCache';
import type { WishItem } from '@/types';

interface UseWishItemsOptions {
  refreshInterval?: number;
}

interface UseWishItemsResult {
  items: WishItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addItem: (data: { memberId: string; name: string; url?: string; notes?: string; addedBy?: string }) => Promise<WishItem>;
  updateItem: (itemId: string, data: { name?: string; url?: string; notes?: string }) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  claimItem: (itemId: string, claimedBy: string) => Promise<void>;
  unclaimItem: (itemId: string) => Promise<void>;
}

/**
 * Hook for fetching and managing wish items.
 * @param memberId - Whose wish list to load (null = all members)
 * @param viewerId - Who is viewing (for secret claims — if same as memberId, claims hidden)
 */
export function useWishItems(
  memberId: string | null | 'all',
  viewerId?: string,
  options: UseWishItemsOptions = {}
): UseWishItemsResult {
  const { refreshInterval = 5 * 60 * 1000 } = options;

  const cacheKey = useMemo(() => {
    const params = new URLSearchParams();
    if (memberId && memberId !== 'all') params.set('memberId', memberId);
    if (viewerId) params.set('viewerId', viewerId);
    return `/api/wish-items?${params.toString()}`;
  }, [memberId, viewerId]);

  // One refresh interval's worth of age is what this hook already tolerates,
  // so a cached value that young is current by its own standard.
  const maxAgeMs = usePollingInterval(refreshInterval);
  const cached = navCacheGet<WishItem[]>(cacheKey, maxAgeMs);
  const [items, setItems] = useState<WishItem[]>(() => cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!navCacheGet(cacheKey, maxAgeMs)) setLoading(true);
    try {
      setError(null);
      const params = new URLSearchParams();
      if (memberId && memberId !== 'all') params.set('memberId', memberId);
      if (viewerId) params.set('viewerId', viewerId);

      const response = await fetch(`/api/wish-items?${params.toString()}`);
      if (!response.ok) {
        if (response.status === 401) {
          window.dispatchEvent(new Event('prism:auth-expired'));
        }
        throw new Error('Failed to fetch wish items');
      }

      const data = await response.json();
      navCacheSet(cacheKey, data.items || []);
      setItems(data.items || []);
    } catch (err) {
      console.error('Error fetching wish items:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch wish items');
    } finally {
      setLoading(false);
    }
  }, [memberId, viewerId, cacheKey, maxAgeMs]);

  const addItem = useCallback(async (data: {
    memberId: string;
    name: string;
    url?: string;
    notes?: string;
    addedBy?: string;
  }) => {
    const response = await fetch('/api/wish-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to add wish item');
    }

    const newItem = await response.json();
    await fetchItems();
    return newItem;
  }, [fetchItems]);

  const updateItem = useCallback(async (itemId: string, data: {
    name?: string;
    url?: string;
    notes?: string;
  }) => {
    // Optimistic update
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, ...data } : item
    ));

    try {
      const response = await fetch(`/api/wish-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to update wish item');
    } catch (err) {
      // Revert on failure
      await fetchItems();
      throw err;
    }
  }, [fetchItems]);

  const deleteItem = useCallback(async (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));

    try {
      const response = await fetch(`/api/wish-items/${itemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete wish item');
    } catch (err) {
      await fetchItems();
      throw err;
    }
  }, [fetchItems]);

  const claimItem = useCallback(async (itemId: string, claimedBy: string) => {
    // Optimistic update
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, claimed: true } : item
    ));

    try {
      const response = await fetch(`/api/wish-items/${itemId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimedBy }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to claim item');
      }

      // Refresh to get full claim info
      await fetchItems();
    } catch (err) {
      setItems(prev => prev.map(item =>
        item.id === itemId ? { ...item, claimed: false } : item
      ));
      throw err;
    }
  }, [fetchItems]);

  const unclaimItem = useCallback(async (itemId: string) => {
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, claimed: false, claimedBy: null, claimedAt: null } : item
    ));

    try {
      const response = await fetch(`/api/wish-items/${itemId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimedBy: null }),
      });

      if (!response.ok) throw new Error('Failed to unclaim item');
      await fetchItems();
    } catch (err) {
      await fetchItems();
      throw err;
    }
  }, [fetchItems]);

  const adoptItems = useCallback((cachedItems: WishItem[]) => {
    setItems(cachedItems);
    setLoading(false);
  }, []);

  useCachedMountFetch<WishItem[]>({
    key: cacheKey,
    maxAgeMs,
    fetch: fetchItems,
    adopt: adoptItems,
  });

  useVisibilityPolling(fetchItems, refreshInterval);

  return {
    items,
    loading,
    error,
    refresh: fetchItems,
    addItem,
    updateItem,
    deleteItem,
    claimItem,
    unclaimItem,
  };
}
