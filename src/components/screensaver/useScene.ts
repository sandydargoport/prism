'use client';

import { useEffect, useState } from 'react';
import { useResetOn } from '@/lib/hooks/useResetOn';
import { needsLocation, withoutDashboard, type IdleBackground } from '@/lib/idleBackground';
import { backgroundOf, nightOpacity } from '@/lib/screenDay';
import { nightRule, screenStateAt, type Scene, type ScreenState } from '@/lib/throughTheDay';
import { useSkyLocation } from './useIdleBackground';
import { useDashboardShown } from './calmMode';
import { useScreenDay } from './useScreenDay';

/**
 * What the wall shows idle: the screen's own day (#1345), whichever dashboard
 * is up, a switch's included. A page with no dashboard to show (any other
 * page, or the phone layout) shows photos in its place.
 */
export function useWallBackground(): { background: IdleBackground; dimLevel: number } {
  const { day } = useScreenDay();
  const shown = useDashboardShown();
  const own = backgroundOf(day);
  return { background: shown ? own : withoutDashboard(own), dimLevel: nightOpacity(day) };
}

/**
 * The scene on the wall now (#1344), from `screenStateAt`: what the
 * screensaver draws, the warm ink and the dim.
 *
 * The looks, the night rule and how much darker are the screen's own day
 * (useWallBackground), not the dashboard's.
 *
 * The time is taken again whenever the screen goes idle or wakes, and each
 * minute while it is idle, so a screen left idle through the evening changes
 * over at dusk without being touched.
 */
export function useWallScene({ idle, away, sitter, editing = false }: {
  idle: boolean;
  away: boolean;
  sitter: boolean;
  /** A dashboard is being edited on this page (useEditing, #1342). */
  editing?: boolean;
}): Scene & { lat: number; lon: number; eclipse?: ReturnType<typeof useSkyLocation>['eclipse'] } {
  const { background, dimLevel } = useWallBackground();
  const { lat, lon, eclipse } = useSkyLocation(needsLocation(background));
  const resting = idle && !away && !sitter && !editing;
  const [now, setNow] = useState(() => new Date());
  // The screensaver stays mounted all day, so the time it last looked is
  // stale by the moment it comes up.
  useResetOn(resting, () => setNow(new Date()));
  useEffect(() => {
    if (!resting) return;
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, [resting]);
  const scene = screenStateAt({
    idle, away, sitter, editing, background, at: { now, lat, lon }, dimLevel,
  });
  return { ...scene, lat, lon, eclipse };
}

/**
 * The scene the dashboard draws (#1344), from `screenStateAt`: Glance's
 * night veil, whether its parts fade, and in the editor the state the
 * Through the day strip previews (null when not editing).
 *
 * The editor's Resting and Night previews give night outright; otherwise it
 * is night by the screen's rule, rechecked each minute. `background` is the
 * screen's day as the editor has it, which may not be saved yet.
 */
export function usePreviewScene({ previewState, calmIdle, background }: {
  previewState: ScreenState | null;
  /** The wall is showing this dashboard as its own idle screen. */
  calmIdle: boolean;
  background: IdleBackground;
}): Scene {
  const { lat, lon } = useSkyLocation(nightRule(background).by === 'sun');
  const { day } = useScreenDay();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return screenStateAt({
    idle: calmIdle || previewState === 'resting' || previewState === 'night',
    background,
    at: previewState === 'resting' ? { night: false } : previewState === 'night' ? { night: true } : { now, lat, lon },
    dimLevel: nightOpacity(day),
  });
}
