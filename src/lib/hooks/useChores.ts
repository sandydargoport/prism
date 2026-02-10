/**
 *
 * Provides a React hook for fetching and managing chores.
 *
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useVisibilityPolling } from './useVisibilityPolling';

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
  } = options;

  const [chores, setChores] = useState<Chore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch chores from the API
   */
  const fetchChores = useCallback(async () => {
    try {
      setError(null);

      const params = new URLSearchParams();
      if (assignedTo) params.set('assignedTo', assignedTo);
      if (!showDisabled) params.set('enabled', 'true');

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
          enabled: chore.enabled,
          requiresApproval: chore.requiresApproval,
          pointValue: chore.pointValue,
          assignedTo: chore.assignedTo || undefined,
          createdAt: new Date(chore.createdAt),
          pendingApproval: chore.pendingApproval || undefined,
        })
      );

      setChores(transformedChores);
    } catch (err) {
      console.error('Error fetching chores:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch chores');
    } finally {
      setLoading(false);
    }
  }, [assignedTo, showDisabled]);

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

  // Initial fetch
  useEffect(() => {
    fetchChores();
  }, [fetchChores]);

  // Set up refresh interval with visibility-based pause
  useVisibilityPolling(fetchChores, refreshInterval);

  return {
    chores,
    loading,
    error,
    refresh: fetchChores,
    completeChore,
    approveChore,
  };
}
