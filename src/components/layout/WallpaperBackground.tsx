'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePhotos } from '@/lib/hooks/usePhotos';
import { useScreenOrientation } from '@/lib/hooks/useScreenOrientation';

const STORAGE_KEY = 'prism-wallpaper-enabled';
const INTERVAL_KEY = 'prism-wallpaper-interval';
const AUTO_ORIENTATION_KEY = 'prism-wallpaper-auto-orientation';
const ORIENTATION_OVERRIDE_KEY = 'prism-orientation-override';

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

export function WallpaperBackground() {
  const { enabled, interval } = useWallpaperSettings();
  const { enabled: autoOrientation } = useAutoOrientationSetting();
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

  // Rotate photos
  useEffect(() => {
    if (!enabled || photos.length <= 1) return;
    const timer = window.setInterval(() => {
      setFadingOut(true);
      // After fade out, switch image and fade back in
      setTimeout(() => {
        setCurrentIndex((i) => (i + 1) % photos.length);
        setFadingOut(false);
      }, 1000);
    }, interval * 1000);
    return () => window.clearInterval(timer);
  }, [enabled, photos.length, interval]);

  if (!enabled || photos.length === 0) return null;

  const photo = photos[currentIndex];
  if (!photo) return null;

  const src = `/api/photos/${photo.id}/file`;

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
