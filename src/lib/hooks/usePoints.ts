'use client';

import { useState, useEffect, useCallback } from 'react';
import { useVisibilityPolling } from './useVisibilityPolling';

export interface PointSummary {
  userId: string;
  name: string;
  color: string;
  weekly: number;
  monthly: number;
  yearly: number;
  allTime: number;
}

interface UsePointsResult {
  points: PointSummary[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePoints(refreshInterval = 2 * 60 * 1000): UsePointsResult {
  const [points, setPoints] = useState<PointSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPoints = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/points');
      if (!response.ok) throw new Error('Failed to fetch points');

      const data = await response.json();
      setPoints(data.points);
    } catch (err) {
      console.error('Error fetching points:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch points');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPoints(); }, [fetchPoints]);

  useVisibilityPolling(fetchPoints, refreshInterval);

  return { points, loading, error, refresh: fetchPoints };
}
