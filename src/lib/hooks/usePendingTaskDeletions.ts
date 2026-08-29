'use client';

import { useState, useEffect, useCallback } from 'react';

/** Why an apply failed, so the UI can say so rather than doing nothing. */
export type ApplyResult = { ok: true } | { ok: false; reason: string };

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
    async (taskIds: string[], action: 'delete' | 'keep'): Promise<ApplyResult> => {
      try {
        const res = await fetch('/api/tasks/pending-deletions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskIds, action }),
        });
        await refresh();
        if (res.ok) return { ok: true };

        // A refusal has to say why. A child tapping Delete and watching
        // nothing happen cannot tell "not allowed" from "broken".
        if (res.status === 401 || res.status === 403) {
          return { ok: false, reason: 'Only a parent can review removed tasks.' };
        }
        const body = await res.json().catch(() => null);
        return { ok: false, reason: body?.error || 'Could not apply that. Please try again.' };
      } catch {
        return { ok: false, reason: 'Could not reach Prism. Please try again.' };
      }
    },
    [refresh],
  );

  return { pending, count: pending.length, loading, refresh, apply };
}
