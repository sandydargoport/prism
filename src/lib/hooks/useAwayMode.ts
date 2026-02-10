'use client';

import { useState, useEffect, useCallback } from 'react';
import { useVisibilityPolling } from './useVisibilityPolling';

interface AwayModeState {
  enabled: boolean;
  enabledAt: string | null;
  enabledBy: string | null;
}

interface UseAwayModeResult {
  isAway: boolean;
  enabledAt: Date | null;
  enabledBy: string | null;
  loading: boolean;
  error: string | null;
  toggle: (enabled: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAwayMode(refreshInterval = 60 * 1000): UseAwayModeResult {
  const [state, setState] = useState<AwayModeState>({
    enabled: false,
    enabledAt: null,
    enabledBy: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/away-mode');
      if (!response.ok) throw new Error('Failed to fetch away mode state');

      const data: AwayModeState = await response.json();
      setState(data);
    } catch (err) {
      console.error('Error fetching away mode:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch away mode');
    } finally {
      setLoading(false);
    }
  }, []);

  const toggle = useCallback(async (enabled: boolean) => {
    try {
      setError(null);
      const response = await fetch('/api/away-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to toggle away mode');
      }

      const data: AwayModeState = await response.json();
      setState(data);
    } catch (err) {
      console.error('Error toggling away mode:', err);
      setError(err instanceof Error ? err.message : 'Failed to toggle away mode');
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
    window.addEventListener('prism:away-mode-change', handler);
    return () => window.removeEventListener('prism:away-mode-change', handler);
  }, [fetchState]);

  useVisibilityPolling(fetchState, refreshInterval);

  return {
    isAway: state.enabled,
    enabledAt: state.enabledAt ? new Date(state.enabledAt) : null,
    enabledBy: state.enabledBy,
    loading,
    error,
    toggle,
    refresh: fetchState,
  };
}
