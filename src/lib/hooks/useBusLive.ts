'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useVisibilityPolling } from './useVisibilityPolling';
import { useNow } from './useNow';
import type { StopTiming } from '@/lib/services/bus-eta';
import type { LiveTrackVehicle } from '@/lib/db/schema';
import { LOST_MS } from '@/lib/map/busTween';
import { checkFixes } from '@/lib/map/busFixCheck';
import {
  DEFAULT_BUS_MAP_CAMERA, DEFAULT_BUS_MAP_STYLE, type BusMapCamera, type BusMapStyle,
} from '@/lib/map/busMapOptions';

export interface LiveFix {
  id: string;
  ts: string;
  lat: number;
  lng: number;
  heading: number | null;
  /** Metres per second. */
  speed: number | null;
  moving: boolean | null;
  doorOpen: boolean | null;
}

export interface LiveTrack {
  id: string;
  routeId: string;
  routeLabel: string;
  direction: 'AM' | 'PM' | null;
  label: string | null;
  status: string | null;
  vehicle: LiveTrackVehicle | null;
  /** The driver as the family chose to show them, else as reported. */
  driverLabel: string | null;
  progress: { lastVisitedStop: number; totalStops: number } | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  lastFixAt: string | null;
  riderStopKey: string | null;
  shiftMs: number | null;
  stops: StopTiming[];
  /** Every fix received today, oldest first. */
  fixes: LiveFix[];
  /**
   * The route as the bus last drove it, [lng, lat], for drawing the road
   * ahead. Sent with the first load only; null before there is an earlier trip.
   */
  usualPath: [number, number][] | null;
}

interface LiveResponse {
  serverTime: string;
  cursor: string | null;
  speedUnit: 'mph' | 'km/h';
  mapStyle: BusMapStyle;
  camera: BusMapCamera;
  tracks: (Omit<LiveTrack, 'usualPath'> & { usualPath?: LiveTrack['usualPath'] })[];
}

/** Poll this often while a bus is moving: the feed itself is ~10s. */
const LIVE_POLL_MS = 5_000;
/** And this often otherwise, to notice a trip starting. */
const IDLE_POLL_MS = 60_000;

/** A track is live until it reports completed, or goes quiet for too long. */
export function isTrackLive(track: Pick<LiveTrack, 'status' | 'lastFixAt'>, now: number): boolean {
  if (track.status === 'completed' || !track.lastFixAt) return false;
  return now - new Date(track.lastFixAt).getTime() < LOST_MS;
}

/**
 * The live trip to show. With more than one running (two children on two
 * buses), the one due at its stop soonest.
 */
export function pickLiveTrack(tracks: LiveTrack[], now: number): LiveTrack | null {
  const running = tracks.filter((t) => isTrackLive(t, now));
  if (running.length <= 1) return running[0] ?? null;
  const due = (t: LiveTrack) => {
    const stop = t.stops.find((s) => s.key === t.riderStopKey);
    return stop?.projectedAt ? new Date(stop.projectedAt).getTime() : Infinity;
  };
  return [...running].sort((a, b) => due(a) - due(b))[0]!;
}

/** Merge a page of fixes into what is held, dropping repeats, oldest first. */
export function mergeFixes(held: LiveFix[], incoming: LiveFix[]): LiveFix[] {
  if (incoming.length === 0) return held;
  const seen = new Set(held.map((f) => f.id));
  const added = incoming.filter((f) => !seen.has(f.id));
  if (added.length === 0) return held;
  return [...held, ...added].sort((a, b) => a.ts.localeCompare(b.ts));
}

/**
 * Today's live bus tracks for the widget. The first request fetches the whole
 * day; after that only fixes received since the last one.
 */
export function useBusLive(enabled: boolean) {
  const [tracks, setTracks] = useState<LiveTrack[]>([]);
  const [speedUnit, setSpeedUnit] = useState<'mph' | 'km/h'>('mph');
  const [mapStyle, setMapStyle] = useState<BusMapStyle>(DEFAULT_BUS_MAP_STYLE);
  const [camera, setCamera] = useState<BusMapCamera>(DEFAULT_BUS_MAP_CAMERA);
  // Server time minus device time, so "updated 8s ago" is right on a display
  // whose clock has drifted.
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const cursorRef = useRef<string | null>(null);
  const tracksRef = useRef<LiveTrack[]>([]);

  const fetchLive = useCallback(async () => {
    if (!enabled) return;
    try {
      const url = cursorRef.current
        ? `/api/bus-tracking/live?since=${encodeURIComponent(cursorRef.current)}`
        : '/api/bus-tracking/live';
      const res = await fetch(url);
      if (!res.ok) return;
      const data: LiveResponse = await res.json();
      const held = new Map(tracksRef.current.map((t) => [t.id, t]));
      const next = data.tracks.map((t) => ({
        ...t,
        fixes: mergeFixes(held.get(t.id)?.fixes ?? [], t.fixes),
        usualPath: t.usualPath !== undefined ? t.usualPath : held.get(t.id)?.usualPath ?? null,
      }));
      tracksRef.current = next;
      cursorRef.current = data.cursor;
      // The raw fixes are kept for merging; what is shown has been checked.
      setTracks(next.map((t) => ({ ...t, fixes: checkFixes(t.fixes) })));
      setSpeedUnit(data.speedUnit);
      setMapStyle(data.mapStyle ?? DEFAULT_BUS_MAP_STYLE);
      setCamera(data.camera ?? DEFAULT_BUS_MAP_CAMERA);
      setClockOffsetMs(new Date(data.serverTime).getTime() - Date.now());
    } catch {
      // Keep what is shown; the next poll tries again.
    }
  }, [enabled]);

  useEffect(() => { void fetchLive(); }, [fetchLive]);

  // A new day starts from scratch: yesterday's tracks drop out of the
  // response, and their fixes go with them since nothing merges into them.
  const now = useNow();
  const anyLive = tracks.some((t) => isTrackLive(t, now.getTime() + clockOffsetMs));
  useVisibilityPolling(fetchLive, enabled ? (anyLive ? LIVE_POLL_MS : IDLE_POLL_MS) : 0);

  return { tracks, speedUnit, clockOffsetMs, mapStyle, camera };
}
