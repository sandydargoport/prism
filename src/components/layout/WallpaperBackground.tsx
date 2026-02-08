'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePhotos } from '@/lib/hooks/usePhotos';
import { useScreenOrientation } from '@/lib/hooks/useScreenOrientation';

const STORAGE_KEY = 'prism-wallpaper-enabled';
const INTERVAL_KEY = 'prism-wallpaper-interval';
const AUTO_ORIENTATION_KEY = 'prism-wallpaper-auto-orientation';
const ORIENTATION_OVERRIDE_KEY = 'prism-orientation-override';
const PINNED_WALLPAPER_KEY = 'prism-pinned-wallpaper';
const PINNED_SCREENSAVER_KEY = 'prism-pinned-screensaver';
const SCREENSAVER_INTERVAL_KEY = 'prism-screensaver-interval';

function useOrientationOverride(): 'auto' | 'landscape' | 'portrait' {
  const [override, setOverride] = useState<'auto' | 'landscape' | 'portrait'>(() => {
    if (typeof window === 'undefined') return 'auto';
    return (localStorage.getItem(ORIENTATION_OVERRIDE_KEY) as 'auto' | 'landscape' | 'portrait') || 'auto';
  });

  useEffect(() => {
    const handler = () => {
      setOverride((localStorage.getItem(ORIENTATION_OVERRIDE_KEY) as 'auto' | 'landscape' | 'portrait') || 'auto');
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return override;
}
const DEFAULT_INTERVAL = 60; // seconds
const DEFAULT_SCREENSAVER_INTERVAL = 15; // seconds

export function useWallpaperSettings() {
  const [enabled, setEnabledState] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  });
  const [interval, setIntervalState] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_INTERVAL;
    const stored = Number(localStorage.getItem(INTERVAL_KEY));
    return stored > 0 ? stored : DEFAULT_INTERVAL;
  });

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    localStorage.setItem(STORAGE_KEY, String(v));
  }, []);

  const setInterval = useCallback((v: number) => {
    setIntervalState(v);
    localStorage.setItem(INTERVAL_KEY, String(v));
  }, []);

  return { enabled, setEnabled, interval, setInterval };
}

export function useAutoOrientationSetting() {
  const [enabled, setEnabledState] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(AUTO_ORIENTATION_KEY) === 'true';
  });

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    localStorage.setItem(AUTO_ORIENTATION_KEY, String(v));
  }, []);

  return { enabled, setEnabled };
}

export function useScreensaverInterval() {
  const [interval, setIntervalState] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_SCREENSAVER_INTERVAL;
    const stored = Number(localStorage.getItem(SCREENSAVER_INTERVAL_KEY));
    return stored > 0 ? stored : DEFAULT_SCREENSAVER_INTERVAL;
  });

  const setInterval = useCallback((v: number) => {
    setIntervalState(v);
    localStorage.setItem(SCREENSAVER_INTERVAL_KEY, String(v));
    // Dispatch storage event so screensaver can react
    window.dispatchEvent(new StorageEvent('storage', { key: SCREENSAVER_INTERVAL_KEY }));
  }, []);

  // Listen for changes from settings
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === SCREENSAVER_INTERVAL_KEY) {
        const val = Number(e.newValue);
        if (val > 0) setIntervalState(val);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return { interval, setInterval };
}

export function usePinnedPhoto(context: 'wallpaper' | 'screensaver') {
  const storageKey = context === 'wallpaper' ? PINNED_WALLPAPER_KEY : PINNED_SCREENSAVER_KEY;

  const [pinnedId, setPinnedIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(storageKey);
  });

  const setPinnedId = useCallback((id: string | null) => {
    setPinnedIdState(id);
    if (id) {
      localStorage.setItem(storageKey, id);
    } else {
      localStorage.removeItem(storageKey);
    }
    // Dispatch storage event so other components can react
    window.dispatchEvent(new StorageEvent('storage', { key: storageKey }));
  }, [storageKey]);

  // Listen for changes from other tabs/components
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === storageKey) {
        setPinnedIdState(e.newValue);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [storageKey]);

  return { pinnedId, setPinnedId };
}

export function WallpaperBackground() {
  const { enabled, interval } = useWallpaperSettings();
  const { enabled: autoOrientation } = useAutoOrientationSetting();
  const { pinnedId } = usePinnedPhoto('wallpaper');
  const screenOrientation = useScreenOrientation();
  const orientationOverride = useOrientationOverride();
  const effectiveOrientation = orientationOverride === 'auto' ? screenOrientation : orientationOverride;
  const { photos } = usePhotos({
    sort: 'random',
    limit: 30,
    usage: 'wallpaper',
    orientation: autoOrientation ? effectiveOrientation : undefined,
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);

  // Rotate photos (only if no pinned photo and interval is not "never")
  useEffect(() => {
    if (!enabled || photos.length <= 1 || pinnedId || interval === 0) return;
    const timer = window.setInterval(() => {
      setFadingOut(true);
      // After fade out, switch image and fade back in
      setTimeout(() => {
        setCurrentIndex((i) => (i + 1) % photos.length);
        setFadingOut(false);
      }, 1000);
    }, interval * 1000);
    return () => window.clearInterval(timer);
  }, [enabled, photos.length, interval, pinnedId]);

  if (!enabled) return null;

  // Use pinned photo if set, otherwise use rotating photos
  const src = pinnedId
    ? `/api/photos/${pinnedId}/file`
    : photos[currentIndex]
      ? `/api/photos/${photos[currentIndex]!.id}/file`
      : null;

  if (!src) return null;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      {/* Photo */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
        style={{
          backgroundImage: `url(${src})`,
          opacity: fadingOut ? 0 : 1,
        }}
      />
      {/* Dark overlay to keep widgets readable */}
      <div className="absolute inset-0 bg-black/60 dark:bg-black/70" />
    </div>
  );
}
