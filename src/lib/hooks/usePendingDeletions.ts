'use client';

import { useState, useEffect, useCallback } from 'react';

export interface PendingDeletion {
  id: string;
  title: string;
  startTime: string;
  allDay: boolean;
  /** Neat name of the source calendar the event came from. */
  sourceCalendar: string;
  provider: string;
  color: string | null;
}

/**
 * Synced calendar events the sync flagged for removal (the source dropped them),
 * held for review instead of deleted (#171 Stage 3). Drives the "N to review"
 * badge on the calendar.
 */
export function usePendingDeletions() {
  const [pending, setPending] = useState<PendingDeletion[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/calendars/pending-deletions');
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
    async (eventIds: string[], action: 'delete' | 'keep') => {
      const res = await fetch('/api/calendars/pending-deletions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventIds, action }),
      });
      await refresh();
      return res.ok;
    },
    [refresh],
  );

  return { pending, count: pending.length, loading, refresh, apply };
}
