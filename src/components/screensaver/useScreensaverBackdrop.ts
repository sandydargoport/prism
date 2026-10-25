'use client';

import { useEffect, useState } from 'react';
import { useResetOn } from '@/lib/hooks/useResetOn';
import { useStoredString, writeStored } from '@/lib/hooks/useStoredValue';
import { useWeather } from '@/lib/hooks/useWeather';
import { skyShowsNow, type ScreensaverBackdrop } from './nightSky/sky';

const KEY = 'prism-screensaver-backdrop';
const BACKDROPS: ScreensaverBackdrop[] = ['photos', 'sky', 'skyAtNight'];

export type { ScreensaverBackdrop };

const setBackdrop = (v: ScreensaverBackdrop) => writeStored(KEY, v);

/**
 * What the screensaver draws behind its widgets: the photo slideshow, the
 * night sky, or photos by day and the sky after sunset.
 *
 * Per display, like the screensaver's other settings. Photos by default, so no
 * display changes character on an update.
 */
export function useScreensaverBackdrop() {
  const raw = useStoredString(KEY);
  const backdrop: ScreensaverBackdrop =
    raw && (BACKDROPS as string[]).includes(raw) ? (raw as ScreensaverBackdrop) : 'photos';
  return { backdrop, setBackdrop };
}

/**
 * Where to draw the sky from: the household location in Settings, which the
 * weather already resolves.
 *
 * With no location set, a longitude from the time zone gets sunset within the
 * hour, which is what "after dark" needs; the latitude is a guess, so the
 * stars are roughly right rather than right.
 */
export function useSkyLocation(enabled: boolean): { lat: number; lon: number } {
  const { data } = useWeather({ enabled });
  const [zoneLon] = useState(() => -new Date().getTimezoneOffset() / 4);
  if (data?.lat !== undefined && data?.lon !== undefined) return { lat: data.lat, lon: data.lon };
  return { lat: 40, lon: zoneLon };
}

/**
 * Whether the sky is showing now, rechecked each minute while the screensaver
 * is up so a display left idle through the evening changes over at sunset
 * without being touched.
 */
export function useSkyShowing(
  backdrop: ScreensaverBackdrop, lat: number, lon: number, active: boolean,
): boolean {
  const [now, setNow] = useState(() => new Date());
  // The screensaver stays mounted all day, so the time it last looked is stale
  // by the moment it comes up.
  useResetOn(active, () => setNow(new Date()));
  useEffect(() => {
    if (!active || backdrop !== 'skyAtNight') return;
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, [active, backdrop]);
  return skyShowsNow(backdrop, now, lat, lon);
}
