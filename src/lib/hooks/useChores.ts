/**
 *
 * Provides a React hook for fetching and managing chores.
 *
 */

'use client';

import { useState, useCallback } from 'react';
import { useVisibilityPolling } from './useVisibilityPolling';
import { usePollingInterval } from './usePollingInterval';
import { useCachedMountFetch } from './useCachedMountFetch';
import { navCacheGet, navCacheSet } from '@/lib/utils/navCache';

// Re-export Chore type from shared types for consumers that import from this hook
export type { Chore } from '@/types';
import type { Chore } from '@/types';

export interface ChoreCompletion {
  id: string;
  choreId: string;
  completedAt: Date;
  completedBy?: {
    id: string;
    name: string;
    color: string;
  };
  approvedBy?: {
    id: string;
    name: string;
    color: string;
  };
  approvedAt?: Date;
  pointsAwarded: number;
  notes?: string;
  requiresApproval?: boolean;
}

interface UseChoresOptions {
  /** Filter by assigned user ID */
  assignedTo?: string;
  /** Show disabled chores */
  showDisabled?: boolean;
  /** Auto-refresh interval in milliseconds (0 = disabled) */
  refreshInterval?: number;
  /** When false, skip initial fetch and polling. Fetch triggers when enabled transitions to true. */
  enabled?: boolean;
  /** When true, also return future-dated chores. Calendar overlays use this
   * so dragging a chore to a future date doesn't make it disappear. */
  includeFuture?: boolean;
}

interface UseChoresResult {
  chores: Chore[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  completeChore: (choreId: string, data?: { completedBy?: string; notes?: string }) => Promise<ChoreCompletion>;
  approveChore: (choreId: string, completionId?: string) => Promise<void>;
}

/**
 * Hook for fetching chores from the API
 */
export function useChores(options: UseChoresOptions = {}): UseChoresResult {
  const {
    assignedTo,
    showDisabled = false,
    refreshInterval = 5 * 60 * 1000,
    enabled = true,
    includeFuture = false,
  } = options;

  const cacheKey = `/api/chores?${new URLSearchParams({
    ...(assignedTo ? { assignedTo } : {}),
    ...(!showDisabled ? { enabled: 'true' } : {}),
    ...(includeFuture ? { includeFuture: 'true' } : {}),
  }).toString()}`;
  // One refresh interval's worth of age is what this hook already tolerates,
  // so a cached value that young is current by its own standard.
  const maxAgeMs = usePollingInterval(refreshInterval);
  const cached = navCacheGet<Chore[]>(cacheKey, maxAgeMs);
  const [chores, setChores] = useState<Chore[]>(() => cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch chores from the API
   */
  const fetchChores = useCallback(async () => {
    if (!navCacheGet(cacheKey, maxAgeMs)) setLoading(true);
    try {
      setError(null);

      const params = new URLSearchParams();
      if (assignedTo) params.set('assignedTo', assignedTo);
      if (!showDisabled) params.set('enabled', 'true');
      if (includeFuture) params.set('includeFuture', 'true');

      const response = await fetch(`/api/chores?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch chores');
      }

      const data = await response.json();

      // Transform API response to Chore format
      const transformedChores: Chore[] = data.chores.map(
        (chore: {
          id: string;
          title: string;
          description: string | null;
          category: 'cleaning' | 'laundry' | 'dishes' | 'yard' | 'pets' | 'trash' | 'other';
          frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
          customIntervalDays: number | null;
          lastCompleted: string | null;
          nextDue: string | null;
          nextDueTime: string | null;
          enabled: boolean;
          requiresApproval: boolean;
          pointValue: number;
          assignedTo: {
            id: string;
            name: string;
            color: string;
          } | null;
          createdAt: string;
          pendingApproval: {
            completionId: string;
            completedAt: string;
            completedBy: {
              id: string;
              name: string;
              color: string;
            };
          } | null;
        }) => ({
          id: chore.id,
          title: chore.title,
          description: chore.description || undefined,
          category: chore.category,
          frequency: chore.frequency,
          customIntervalDays: chore.customIntervalDays || undefined,
          lastCompleted: chore.lastCompleted ? new Date(chore.lastCompleted) : undefined,
          nextDue: chore.nextDue || undefined,
          nextDueTime: chore.nextDueTime ?? null,
          enabled: chore.enabled,
          requiresApproval: chore.requiresApproval,
          pointValue: chore.pointValue,
          assignedTo: chore.assignedTo || undefined,
          createdAt: new Date(chore.createdAt),
          pendingApproval: chore.pendingApproval || undefined,
        })
      );

      navCacheSet(cacheKey, transformedChores);
      setChores(transformedChores);
    } catch (err) {
      console.error('Error fetching chores:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch chores');
    } finally {
      setLoading(false);
    }
  }, [assignedTo, showDisabled, cacheKey, includeFuture, maxAgeMs]);

  /**
   * Mark a chore as completed
   */
  const completeChore = useCallback(
    async (choreId: string, data?: { completedBy?: string; notes?: string }) => {
      try {
        const response = await fetch(`/api/chores/${choreId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data || {}),
        });

        if (!response.ok) {
          throw new Error('Failed to complete chore');
        }

        const completion = await response.json();

        // Refresh chores to get updated state
        await fetchChores();

        return {
          id: completion.id,
          choreId: completion.choreId,
          completedAt: new Date(completion.completedAt),
          completedBy: completion.completedBy || undefined,
          approvedBy: completion.approvedBy || undefined,
          approvedAt: completion.approvedAt ? new Date(completion.approvedAt) : undefined,
          pointsAwarded: completion.pointsAwarded,
          notes: completion.notes || undefined,
          requiresApproval: completion.requiresApproval || false,
        };
      } catch (err) {
        console.error('Error completing chore:', err);
        throw err;
      }
    },
    [fetchChores]
  );

  /**
   * Approve a chore completion (parents only)
   */
  const approveChore = useCallback(
    async (choreId: string, completionId?: string) => {
      try {
        const response = await fetch(`/api/chores/${choreId}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(completionId ? { completionId } : {}),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to approve chore');
        }

        // Refresh chores to get updated state
        await fetchChores();
      } catch (err) {
        console.error('Error approving chore:', err);
        throw err;
      }
    },
    [fetchChores]
  );

  const adoptChores = useCallback((cachedChores: Chore[]) => {
    setChores(cachedChores);
    setLoading(false);
  }, []);

  // Initial fetch (skipped when disabled, or when the same query was already
  // fetched within one refresh interval)
  useCachedMountFetch<Chore[]>({
    key: cacheKey,
    enabled,
    maxAgeMs,
    fetch: fetchChores,
    adopt: adoptChores,
  });

  // Set up refresh interval with visibility-based pause (disabled when not enabled)
  useVisibilityPolling(fetchChores, enabled ? refreshInterval : 0);

  return {
    chores,
    loading,
    error,
    refresh: fetchChores,
    completeChore,
    approveChore,
  };
}
