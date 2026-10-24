'use client';

import { useState, useCallback } from 'react';
import { useVisibilityPolling } from '@/lib/hooks/useVisibilityPolling';
import type { WeekendPlace } from './types';
import { useFetchOnMount } from '@/lib/hooks/useFetchOnMount';

export class WeekendAuthError extends Error {
  /** 401: nobody is signed in (AuthProvider opens the PIN box). 403: signed in, not allowed. */
  constructor(public readonly status: 401 | 403 = 401) {
    super(status === 401 ? 'Not logged in' : 'Not allowed');
    this.name = 'WeekendAuthError';
  }
}

function checkResponse(res: Response, action: string): void {
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new WeekendAuthError(res.status);
    throw new Error(`Failed to ${action}`);
  }
}

export function useWeekendData() {
  const [places, setPlaces] = useState<WeekendPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/weekend/places');
      const data = res.ok ? await res.json() : { places: [] };
      setPlaces(data.places ?? []);
      setError(null);
    } catch {
      setError('Failed to load places');
    } finally {
      setLoading(false);
    }
  }, []);

  useFetchOnMount(load);
  useVisibilityPolling(load, 300_000);

  const addPlace = useCallback(async (payload: Omit<WeekendPlace, 'id' | 'visitCount' | 'lastVisitedDate' | 'createdBy' | 'createdAt' | 'updatedAt'>) => {
    const res = await fetch('/api/weekend/places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    checkResponse(res, 'create place');
    const place = await res.json() as WeekendPlace;
    setPlaces((prev) => [place, ...prev]);
    return place;
  }, []);

  const updatePlace = useCallback(async (id: string, payload: Partial<WeekendPlace>) => {
    const res = await fetch(`/api/weekend/places/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    checkResponse(res, 'update place');
    const updated = await res.json() as WeekendPlace;
    setPlaces((prev) => prev.map((p) => p.id === id ? updated : p));
    return updated;
  }, []);

  const deletePlace = useCallback(async (id: string) => {
    const res = await fetch(`/api/weekend/places/${id}`, { method: 'DELETE' });
    checkResponse(res, 'delete place');
    setPlaces((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { places, loading, error, refresh: load, addPlace, updatePlace, deletePlace };
}
