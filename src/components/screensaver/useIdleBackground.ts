'use client';

import { useEffect, useState } from 'react';
import { useResetOn } from '@/lib/hooks/useResetOn';
import { useWeather } from '@/lib/hooks/useWeather';
import { idleSourceAt, type IdleBackground, type IdleSource } from '@/lib/idleBackground';
import type { Eclipse } from '@/lib/integrations/eclipse';

/**
 * Where to draw the sky from: the household location in Settings, which the
 * weather already resolves, and the eclipse it found for today.
 *
 * With no location set, a longitude from the time zone gets sunset within the
 * hour, which is what "after dark" needs; the latitude is a guess, so the
 * stars are roughly right rather than right.
 */
export function useSkyLocation(enabled: boolean): { lat: number; lon: number; eclipse?: Eclipse; guessed?: boolean } {
  const { data } = useWeather({ enabled });
  const [zoneLon] = useState(() => -new Date().getTimezoneOffset() / 4);
  // Today's eclipse seen from here, worked out with the weather, so the sky's
  // moon can go copper during a lunar one.
  const eclipse = data?.eclipse;
  if (data?.lat !== undefined && data?.lon !== undefined) return { lat: data.lat, lon: data.lon, eclipse };
  return { lat: 40, lon: zoneLon, eclipse, guessed: true };
}

/**
 * Which background shows now, rechecked each minute while the display is idle
 * so one left idle through the evening changes over at dusk without being
 * touched.
 */
export function useIdleSource(
  bg: IdleBackground, lat: number, lon: number, active: boolean,
): IdleSource {
  const [now, setNow] = useState(() => new Date());
  // The screensaver stays mounted all day, so the time it last looked is stale
  // by the moment it comes up.
  useResetOn(active, () => setNow(new Date()));
  const changes = 'switch' in bg;
  useEffect(() => {
    if (!active || !changes) return;
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, [active, changes]);
  return idleSourceAt(bg, now, lat, lon);
}
