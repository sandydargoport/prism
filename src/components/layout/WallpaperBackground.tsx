'use client';

import { focalOf, type FocalPoint } from '@/lib/photos/focalPoint';
import { CENTRED, photoFrame, type Frame } from '@/lib/photos/frame';
import { coveredRects } from '@/lib/photos/frameDom';
import { useFocalPointPass } from '@/lib/photos/focalPass';
import { PhotoStage } from './PhotoStage';
import { useState, useEffect, useCallback } from 'react';
import { usePhotos } from '@/lib/hooks/usePhotos';
import { useScreenOrientation } from '@/lib/hooks/useScreenOrientation';
import { SCENERY } from '@/lib/scenery';
import { useSceneryOn } from '@/lib/hooks/useSceneryOn';
import { photoTone, waterVars, type PhotoTone } from '@/lib/design/water';
import { PHOTO_DIM } from '@/lib/design/tokens';

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
    window.dispatchEvent(new StorageEvent('storage', { key: storageKey, newValue: id }));
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

/** Tones already measured, by image URL: a photo is read once per page load. */
const toneCache = new Map<string, PhotoTone | null>();

/**
 * The photo's tone, read from a 48x27 copy of it (#799). Null until it is
 * read, and for an image the browser cannot read back.
 */
export function usePhotoTone(src: string | null): PhotoTone | null {
  // The last tone read, with the photo it belongs to; a cached photo needs no read.
  const [read, setRead] = useState<{ src: string; tone: PhotoTone | null } | null>(null);
  useEffect(() => {
    if (!src || toneCache.has(src)) return;
    let cancelled = false;
    const setTone = (tone: PhotoTone | null) => setRead({ src, tone });
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      let measured: PhotoTone | null = null;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 48; canvas.height = 27;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          // Cover-crop to the screen's shape, as the wallpaper draws it.
          const screen = window.innerWidth / Math.max(1, window.innerHeight);
          const photo = img.naturalWidth / Math.max(1, img.naturalHeight);
          let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
          if (photo > screen) { sw = sh * screen; sx = (img.naturalWidth - sw) / 2; }
          else { sh = sw / screen; sy = (img.naturalHeight - sh) / 2; }
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 48, 27);
          measured = photoTone(ctx.getImageData(0, 0, 48, 27).data, 48, 27);
        }
      } catch {
        measured = null; // a tainted or unreadable image keeps the safe values
      }
      toneCache.set(src, measured);
      if (!cancelled) setTone(measured);
    };
    img.onerror = () => { toneCache.set(src, null); if (!cancelled) setTone(null); };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);
  if (!src) return null;
  if (toneCache.has(src)) return toneCache.get(src) ?? null;
  return read?.src === src ? read.tone : null;
}

/**
 * While a wallpaper shows, the page knows it (`data-wallpaper` on <html>) and
 * carries the water values for that photo, so CSS can draw cards as water and
 * the corner tiles straight on the photo (globals.css, "Water").
 */
function useWaterOnPage(src: string | null, scenery: boolean) {
  const tone = usePhotoTone(src);
  useEffect(() => {
    if (!src) return;
    const root = document.documentElement;
    // The lighter of the two mode dims: the harder case, so both modes read.
    const dim = scenery ? PHOTO_DIM.scenery.light : PHOTO_DIM.photos.light;
    const vars = waterVars(tone, dim);
    root.dataset.wallpaper = scenery ? 'scenery' : 'photo';
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    return () => {
      delete root.dataset.wallpaper;
      for (const k of Object.keys(vars)) root.style.removeProperty(k);
    };
  }, [src, scenery, tone]);
}

/** What to show: wallpaper photos added to Prism, or the bundled scenery when there are none. */
export function wallpaperPool(
  photos: Array<{ id: string; focalX?: number | null; focalY?: number | null; width?: number | null; height?: number | null }>,
  photosLoading: boolean,
  sceneryOn: boolean,
): { items: Array<{ id: string; src: string; focal?: FocalPoint; aspect?: number }>; scenery: boolean } {
  if (photos.length > 0) return { items: photos.map((p) => ({
    id: p.id, src: `/api/photos/${p.id}/file`, focal: focalOf(p),
    aspect: p.width && p.height ? p.width / p.height : undefined,
  })), scenery: false };
  if (sceneryOn && !photosLoading) return { items: SCENERY.map((s) => ({ id: s.id, src: s.src })), scenery: true };
  return { items: [], scenery: false };
}

export function WallpaperBackground() {
  const { enabled, interval } = useWallpaperSettings();
  const { enabled: autoOrientation } = useAutoOrientationSetting();
  const { pinnedId } = usePinnedPhoto('wallpaper');
  const screenOrientation = useScreenOrientation();
  const orientationOverride = useOrientationOverride();
  const effectiveOrientation = orientationOverride === 'auto' ? screenOrientation : orientationOverride;
  // Fetch all wallpaper photos, then PREFER the ones matching this screen's
  // orientation — but fall back to any photo when none match, so a display whose
  // orientation has no photos still shows a wallpaper instead of going blank.
  const { photos: allPhotos, loading: photosLoading } = usePhotos({
    sort: 'random',
    limit: 40,
    usage: 'wallpaper',
  });
  const orientedPhotos = autoOrientation
    ? allPhotos.filter((p) => p.orientation === effectiveOrientation)
    : allPhotos;
  const photos = orientedPhotos.length > 0 ? orientedPhotos : allPhotos;

  const [currentIndex, setCurrentIndex] = useState(0);

  // Track photos whose file is missing/deleted (the image 404s) so we skip past
  // them instead of showing a blank background. A broken pinned photo falls back
  // to the rotation; a broken rotation photo is dropped from the pool so the next
  // render lands on a good one. Resets on reload (so restored files reappear).
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set());
  const markBroken = useCallback((id: string) => {
    setBrokenIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  const sceneryOn = useSceneryOn();
  const { items, scenery } = wallpaperPool(photos, photosLoading, sceneryOn);
  const usePinned = !scenery && !!pinnedId && !brokenIds.has(pinnedId);
  const pool = items.filter((p) => !brokenIds.has(p.id));
  // Find the focal points of photos that have none yet (#956).
  useFocalPointPass(enabled && !scenery && pool.length > 0);

  // Rotate photos (only if no pinned photo and interval is not "never")
  useEffect(() => {
    if (!enabled || pool.length <= 1 || usePinned || interval === 0) return;
    // The photo stage crossfades to the next one (#954).
    const timer = window.setInterval(() => setCurrentIndex((i) => i + 1), interval * 1000);
    return () => window.clearInterval(timer);
  }, [enabled, pool.length, interval, usePinned]);

  if (!enabled) return null;

  // Pinned photo (if set and not broken), else the next non-broken rotation photo.
  const rotationPhoto = pool.length > 0 ? pool[currentIndex % pool.length] : undefined;
  const activeId = usePinned ? pinnedId : (rotationPhoto?.id ?? null);
  const src = usePinned ? `/api/photos/${pinnedId}/file` : (rotationPhoto?.src ?? null);
  // A pinned photo, or "never", stays put: no zoom (#955).
  const zoomMs = usePinned || interval === 0 ? 0 : interval * 1000;
  // Frame each photo's subject clear of the widgets (#957).
  const frameFor = (url: string) => {
    const item = pool.find((p) => p.src === url);
    if (!item?.aspect || !item.focal) return CENTRED;
    return photoFrame({ aspect: item.aspect, screen: { width: window.innerWidth, height: window.innerHeight }, covered: coveredRects(), focal: item.focal });
  };

  return <WallpaperLayers src={src} scenery={scenery} activeId={activeId} onBroken={markBroken} frameFor={frameFor} zoomMs={zoomMs} />;
}

function WallpaperLayers({ src, scenery, activeId, onBroken, frameFor, zoomMs }: {
  src: string | null;
  scenery: boolean;
  frameFor: (src: string) => Frame;
  zoomMs: number;
  activeId: string | null;
  onBroken: (id: string) => void;
}) {
  useWaterOnPage(src, scenery);
  if (!src) return null;
  const markBroken = onBroken;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      {/* Validator — if this photo's file 404s, mark it broken and skip it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={activeId ?? 'none'}
        src={src}
        alt=""
        className="hidden"
        onError={() => activeId && markBroken(activeId)}
      />
      {/* Photo: the shared stage crossfades to the next (#954). */}
      <PhotoStage src={src} frameFor={frameFor} zoomMs={zoomMs} />
      {/* Black layer that keeps widgets readable, PHOTO_DIM in
          src/lib/design/tokens.ts (a test holds these classes to it). The
          bundled scenery is shown with glass widgets, so it is only lightly
          dimmed and the photo shows. */}
      <div className={scenery ? 'absolute inset-0 bg-black/10 dark:bg-black/40' : 'absolute inset-0 bg-black/60 dark:bg-black/70'} />
      {/* Shades only where text sits on the photo: the two top corners and
          the bottom, each as dark as that part of the photo needs (#799). */}
      <div className="absolute inset-0" data-wallpaper-shade style={{ backgroundImage: [
        'radial-gradient(45% 40% at 0% 0%, rgb(0 0 0 / var(--ds-shade-tl, 0.35)), transparent)',
        'radial-gradient(45% 40% at 100% 0%, rgb(0 0 0 / var(--ds-shade-tr, 0.35)), transparent)',
        'linear-gradient(to top, rgb(0 0 0 / var(--ds-shade-bottom, 0.35)), transparent 35%)',
      ].join(', ') }} />
    </div>
  );
}
