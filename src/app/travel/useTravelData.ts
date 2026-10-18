'use client';

import { useState, useCallback, useEffect } from 'react';
import { useVisibilityPolling } from '@/lib/hooks/useVisibilityPolling';
import type { TravelPin, TravelTrip } from './types';

export class TravelAuthError extends Error {
  /** 401: nobody is signed in (AuthProvider opens the PIN box). 403: signed in, not allowed. */
  constructor(public readonly status: 401 | 403 = 401) {
    super(status === 401 ? 'Not logged in' : 'Not allowed');
    this.name = 'TravelAuthError';
  }
}

function checkResponse(res: Response, action: string): void {
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new TravelAuthError(res.status);
    throw new Error(`Failed to ${action}`);
  }
}

async function fetchAll(): Promise<{ pins: TravelPin[]; trips: TravelTrip[] }> {
  const [pinsRes, tripsRes] = await Promise.all([
    fetch('/api/travel/pins'),
    fetch('/api/travel/trips'),
  ]);
  const pins = pinsRes.ok ? ((await pinsRes.json()).pins ?? []) : [];
  const trips = tripsRes.ok ? ((await tripsRes.json()).trips ?? []) : [];
  return { pins, trips };
}

export function useTravelData() {
  const [pins, setPins] = useState<TravelPin[]>([]);
  const [trips, setTrips] = useState<TravelTrip[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await fetchAll();
    setPins(data.pins);
    setTrips(data.trips);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useVisibilityPolling(load, 300_000);

  // ── Pins ──────────────────────────────────────────────────────────────────

  const addPin = useCallback(async (payload: Omit<TravelPin, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
    const res = await fetch('/api/travel/pins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    checkResponse(res, 'create pin');
    const pin = await res.json() as TravelPin;
    setPins((prev) => [pin, ...prev]);
    return pin;
  }, []);

  const updatePin = useCallback(async (id: string, payload: Partial<TravelPin>) => {
    const res = await fetch(`/api/travel/pins/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    checkResponse(res, 'update pin');
    const updated = await res.json() as TravelPin;
    setPins((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    return updated;
  }, []);

  const deletePin = useCallback(async (id: string) => {
    const res = await fetch(`/api/travel/pins/${id}`, { method: 'DELETE' });
    checkResponse(res, 'delete pin');
    setPins((prev) => prev.filter((p) => p.id !== id && p.parentId !== id));
  }, []);

  // ── Trips ─────────────────────────────────────────────────────────────────

  const addTrip = useCallback(async (payload: Omit<TravelTrip, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'stops'>) => {
    const res = await fetch('/api/travel/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    checkResponse(res, 'create trip');
    const trip = await res.json() as TravelTrip;
    setTrips((prev) => [trip, ...prev]);
    return trip;
  }, []);

  const updateTrip = useCallback(async (id: string, payload: Partial<TravelTrip>) => {
    const res = await fetch(`/api/travel/trips/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    checkResponse(res, 'update trip');
    const updated = await res.json() as TravelTrip;
    setTrips((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
    return updated;
  }, []);

  const deleteTrip = useCallback(async (id: string) => {
    const res = await fetch(`/api/travel/trips/${id}`, { method: 'DELETE' });
    checkResponse(res, 'delete trip');
    setTrips((prev) => prev.filter((t) => t.id !== id));
    // Cascade: remove pins that belonged to this trip from local state
    setPins((prev) => prev.filter((p) => p.tripId !== id));
  }, []);

  return { pins, trips, loading, addPin, updatePin, deletePin, addTrip, updateTrip, deleteTrip, refresh: load };
}
