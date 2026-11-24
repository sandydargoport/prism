'use client';

import { useState } from 'react';
import { useWeather } from '@/lib/hooks/useWeather';
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
