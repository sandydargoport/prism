'use client';

import { useState, useEffect, useCallback } from 'react';
import { useVisibilityPolling } from './useVisibilityPolling';

interface BabysitterModeState {
  enabled: boolean;
  enabledAt: string | null;
  enabledBy: string | null;
}

interface UseBabysitterModeResult {
  isActive: boolean;
  enabledAt: Date | null;
  enabledBy: string | null;
  loading: boolean;
  error: string | null;
  toggle: (enabled: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useBabysitterMode(refreshInterval = 60 * 1000): UseBabysitterModeResult {
  const [state, setState] = useState<BabysitterModeState>({
    enabled: false,
    enabledAt: null,
    enabledBy: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/babysitter-mode');
      if (!response.ok) throw new Error('Failed to fetch babysitter mode state');

      const data: BabysitterModeState = await response.json();
      setState(data);
    } catch (err) {
      console.error('Error fetching babysitter mode:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch babysitter mode');
    } finally {
      setLoading(false);
    }
  }, []);

  const toggle = useCallback(async (enabled: boolean) => {
    try {
      setError(null);
      const response = await fetch('/api/babysitter-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to toggle babysitter mode');
      }

      const data: BabysitterModeState = await response.json();
      setState(data);
    } catch (err) {
      console.error('Error toggling babysitter mode:', err);
      setError(err instanceof Error ? err.message : 'Failed to toggle babysitter mode');
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Listen for custom event to immediately refresh state
  useEffect(() => {
    const handler = () => {
      fetchState();
    };
    window.addEventListener('prism:babysitter-mode-change', handler);
    return () => window.removeEventListener('prism:babysitter-mode-change', handler);
  }, [fetchState]);

  useVisibilityPolling(fetchState, refreshInterval);

  return {
    isActive: state.enabled,
    enabledAt: state.enabledAt ? new Date(state.enabledAt) : null,
    enabledBy: state.enabledBy,
    loading,
    error,
    toggle,
    refresh: fetchState,
  };
}
