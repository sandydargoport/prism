/**
 *
 * Provides a React hook for fetching upcoming birthdays, anniversaries,
 * and milestones for the dashboard widget.
 *
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

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

interface UseBirthdaysOptions {
  /** Max number of upcoming events to return */
  limit?: number;
  /** Auto-refresh interval in milliseconds (default: 1 hour) */
  refreshInterval?: number;
}

interface UseBirthdaysResult {
  birthdays: Birthday[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  syncFromGoogle: () => Promise<void>;
}

export function useBirthdays(options: UseBirthdaysOptions = {}): UseBirthdaysResult {
  const { limit = 10, refreshInterval = 60 * 60 * 1000 } = options;

  const [data, setData] = useState<Birthday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBirthdays = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams({ limit: String(limit) });
      const response = await fetch(`/api/birthdays?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch birthdays');
      }

      const json = await response.json();
      setData(json.birthdays || []);
    } catch (err) {
      console.error('Error fetching birthdays:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch birthdays');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  const syncFromGoogle = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/birthdays/sync', { method: 'POST' });

      if (!response.ok) {
        throw new Error('Failed to sync from Google Calendar');
      }

      // Refresh data after sync
      await fetchBirthdays();
    } catch (err) {
      console.error('Error syncing birthdays:', err);
      setError(err instanceof Error ? err.message : 'Failed to sync');
    }
  }, [fetchBirthdays]);

  // Initial fetch
  useEffect(() => {
    fetchBirthdays();
  }, [fetchBirthdays]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval <= 0) return;
    const interval = setInterval(fetchBirthdays, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, fetchBirthdays]);

  return {
    birthdays: data,
    loading,
    error,
    refresh: fetchBirthdays,
    syncFromGoogle,
  };
}
