'use client';

import { useState, useEffect, useCallback } from 'react';

export interface PendingTaskDeletion {
  id: string;
  title: string;
  dueDate: string | null;
  completed: boolean;
  /** Where it came from, e.g. "Google Tasks — Shopping". */
  source: string;
  /** The Prism list it currently sits in. */
  list: string | null;
}

/**
 * Synced tasks the provider stopped listing, held for review instead of being
 * deleted. Drives the "Review N" badge on the Tasks page.
 *
 * Same shape as usePendingDeletions for calendar events.
 */
export function usePendingTaskDeletions() {
  const [pending, setPending] = useState<PendingTaskDeletion[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks/pending-deletions');
      if (res.ok) {
        const data = await res.json();
        setPending(data.pending ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const apply = useCallback(
    async (taskIds: string[], action: 'delete' | 'keep') => {
      const res = await fetch('/api/tasks/pending-deletions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds, action }),
      });
      await refresh();
      return res.ok;
    },
    [refresh],
  );

  return { pending, count: pending.length, loading, refresh, apply };
}
