'use client';

import { useState, useCallback, useEffect } from 'react';
import { useFetch } from './useFetch';

interface ModeState {
  enabled: boolean;
  enabledAt: string | null;
  enabledBy: string | null;
}

interface UseModeToggleOptions {
  endpoint: string;
  eventName: string;
  label: string;
  refreshInterval?: number;
}

export interface UseModeToggleResult {
  isActive: boolean;
  enabledAt: Date | null;
  enabledBy: string | null;
  loading: boolean;
  error: string | null;
  toggle: (enabled: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useModeToggle(options: UseModeToggleOptions): UseModeToggleResult {
  const { endpoint, eventName, label, refreshInterval = 60 * 1000 } = options;
  const [toggleError, setToggleError] = useState<string | null>(null);

  const { data, setData, loading, error: fetchError, refresh } = useFetch<ModeState>({
    url: endpoint,
    initialData: { enabled: false, enabledAt: null, enabledBy: null },
    label,
    refreshInterval,
    // Away and Babysitter are set from elsewhere in the house, and each one
    // decides what the display shows instead of the screensaver. Learning
    // about it only when someone touches the screen defeats the point.
    pollWhileIdle: true,
  });

  const toggle = useCallback(async (enabled: boolean) => {
    try {
      setToggleError(null);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `Failed to toggle ${label}`);
      }

      const result: ModeState = await response.json();
      setData(result);
    } catch (err) {
      console.error(`Error toggling ${label}:`, err);
      setToggleError(err instanceof Error ? err.message : `Failed to toggle ${label}`);
      throw err;
    }
  }, [endpoint, label, setData]);

  useEffect(() => {
    const handler = () => { refresh(); };
    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }, [eventName, refresh]);

  return {
    isActive: data.enabled,
    enabledAt: data.enabledAt ? new Date(data.enabledAt) : null,
    enabledBy: data.enabledBy,
    loading,
    error: toggleError || fetchError,
    toggle,
    refresh,
  };
}
