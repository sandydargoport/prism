'use client';

import { useState, useCallback, useEffect } from 'react';
import { useFetch } from './useFetch';

export interface Birthday {
  id: string;
  name: string;
  birthDate: string;
  eventType: 'birthday' | 'anniversary' | 'milestone';
  age: number | null;
  daysUntil: number;
  nextBirthday: string;
  giftIdeas?: string;
}

/**
 * Fired on this screen when a birthday is removed or restored, so every list
 * of them reloads at once rather than at its next refresh. Other screens pick
 * the change up at theirs.
 */
export const BIRTHDAYS_CHANGED = 'prism:birthdays-changed';

export function announceBirthdaysChanged() {
  window.dispatchEvent(new Event(BIRTHDAYS_CHANGED));
}

/**
 * Remove a birthday. A synced one is also recorded as removed, so sync does
 * not add it back; Settings > Calendars can restore it. True if it went.
 */
export async function removeBirthday(id: string): Promise<boolean> {
  const res = await fetch(`/api/birthdays/${id}`, { method: 'DELETE' });
  if (res.ok) announceBirthdaysChanged();
  return res.ok;
}

interface UseBirthdaysOptions {
  limit?: number;
  refreshInterval?: number;
  enabled?: boolean;
}

export function useBirthdays(options: UseBirthdaysOptions = {}) {
  // Every 5 minutes, so a removal made on another screen shows here soon.
  const { limit = 10, refreshInterval = 5 * 60 * 1000, enabled } = options;
  const [syncError, setSyncError] = useState<string | null>(null);

  const { data: birthdays, loading, error: fetchError, refresh } = useFetch<Birthday[]>({
    url: `/api/birthdays?limit=${limit}`,
    initialData: [],
    transform: (json) => (json as { birthdays?: Birthday[] }).birthdays || [],
    refreshInterval,
    label: 'birthdays',
    enabled,
  });

  useEffect(() => {
    if (enabled === false) return;
    const handler = () => { void refresh(); };
    window.addEventListener(BIRTHDAYS_CHANGED, handler);
    return () => window.removeEventListener(BIRTHDAYS_CHANGED, handler);
  }, [enabled, refresh]);

  const syncFromGoogle = useCallback(async () => {
    try {
      setSyncError(null);
      const response = await fetch('/api/birthdays/sync', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to sync from Google Calendar');
      await refresh();
    } catch (err) {
      console.error('Error syncing birthdays:', err);
      setSyncError(err instanceof Error ? err.message : 'Failed to sync');
    }
  }, [refresh]);

  return {
    birthdays,
    loading,
    error: syncError || fetchError,
    refresh,
    syncFromGoogle,
  };
}
