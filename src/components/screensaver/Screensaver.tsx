'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useIdleDetection } from '@/lib/hooks/useIdleDetection';
import { useAwayMode } from '@/lib/hooks/useAwayMode';
import { useBabysitterMode } from '@/lib/hooks/useBabysitterMode';
import { usePhotos } from '@/lib/hooks/usePhotos';
import { useAutoOrientationSetting, usePinnedPhoto, useScreensaverInterval } from '@/components/layout/WallpaperBackground';
import { useScreenOrientation } from '@/lib/hooks/useScreenOrientation';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import { WIDGET_REGISTRY } from '@/components/widgets/widgetRegistry';
import { useDashboardData } from '@/components/dashboard/useDashboardData';
import { buildWidgetProps } from '@/components/dashboard/useWidgetProps';
import { GRID_COLS } from '@/lib/constants/grid';
import { CssGridDisplay } from '@/components/layout/grid/CssGridDisplay';
import { CalendarPrefsScopeContext } from '@/lib/hooks/useCalendarWidgetPrefs';
import { loadScreensaverLayout } from './screensaverStorage';
import { shouldShowScreensaver } from './shouldShowScreensaver';
import { rotate, showingCount } from './screensaverRotation';
import { useScreensaverMotion } from './useScreensaverMotion';
import { DissolveFilter, DISSOLVE_ID, DISSOLVE_MS } from './DissolveFilter';
import { usePerformanceMode } from '@/lib/hooks/usePerformanceMode';

/**
 * Wrapper classes that make any dashboard widget legible as a screensaver
 * overlay: transparent backgrounds (wallpaper shows through), a faint frosted
 * card, light borders, and — the important part — forced white text with a soft
 * shadow so nothing goes dark-on-dark (or washes out over a bright photo).
 * Shared by the live screensaver and the editor's screensaver preview.
 */
export const SCREENSAVER_WIDGET_CLASS =
  'h-full w-full ' +
  '[&_*]:!bg-transparent [&_.bg-card]:!bg-white/10 [&_.border-border]:!border-white/20 ' +
  // Force white text for legibility over the photo — EXCEPT elements marked
  // data-keep-color (e.g. the birthdays "days until" urgency coloring), which
  // keep their own color but still get the shadow.
  '[&_*:not([data-keep-color])]:!text-white [&_*]:[text-shadow:0_1px_4px_rgba(0,0,0,0.75)]';

// Re-export storage utilities for consumers
export {
  DEFAULT_SCREENSAVER_LAYOUT,
  loadScreensaverLayout,
  saveScreensaverLayout,
  getScreensaverPresets,
  saveScreensaverPreset,
  deleteScreensaverPreset,
} from './screensaverStorage';

export function Screensaver() {
  const { isIdle: idleNow } = useIdleDetection();
  // Away and Babysitter are deliberate, someone-chose-this states, and each
  // puts its own full-screen overlay up. The screensaver is rendered after both
  // in LazyOverlays, so on an untouched display it simply covered them: a home
  // left in Away mode showed holiday photos instead of the away screen, and the
  // babysitter's information disappeared behind them exactly when nobody was
  // there to touch the screen and bring it back.
  //
  // Idleness is the weakest of the three signals — it means only that nobody
  // has touched anything — so it yields to both.
  const { isAway } = useAwayMode();
  const { isActive: isBabysitter } = useBabysitterMode();
  const isIdle = shouldShowScreensaver({ idle: idleNow, away: isAway, babysitter: isBabysitter });
  const { enabled: autoOrientation } = useAutoOrientationSetting();
  const { pinnedId } = usePinnedPhoto('screensaver');
  const { interval: screensaverInterval } = useScreensaverInterval();
  const screenOrientation = useScreenOrientation();
  const orientationOverride = typeof window !== 'undefined'
    ? (localStorage.getItem('prism-orientation-override') as 'landscape' | 'portrait' | null) || null
    : null;
  const effectiveOrientation = orientationOverride || screenOrientation;
  const { photos } = usePhotos({
    sort: 'random',
    limit: 50,
    usage: 'screensaver',
    orientation: autoOrientation ? effectiveOrientation : undefined,
  });
  const [visible, setVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);

  // Only rotate if no pinned photo and interval is not "never" (0)
  useEffect(() => {
    if (!isIdle || photos.length <= 1 || pinnedId || screensaverInterval === 0) return;
    const timer = setInterval(() => {
      setFadingOut(true);
      setTimeout(() => {
        setCurrentIndex((i) => (i + 1) % photos.length);
        setFadingOut(false);
      }, 1000);
    }, screensaverInterval * 1000);
    return () => clearInterval(timer);
  }, [isIdle, photos.length, pinnedId, screensaverInterval]);

  useEffect(() => {
    if (isIdle) {
      const timer = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [isIdle]);

  if (!isIdle) return null;

  // Use pinned photo if set, otherwise use rotating photos
  const src = pinnedId
    ? `/api/photos/${pinnedId}/file`
    : photos[currentIndex]
      ? `/api/photos/${photos[currentIndex]!.id}/file`
      : '';

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-black transition-opacity duration-1000 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Decorative layers are absolutely positioned, so in CSS paint order they
          sit ABOVE the (statically-positioned) widget grid and would swallow every
          tap. pointer-events-none lets taps fall through to the widgets — needed
          for the calendar view controls to be operable on the screensaver. */}
      {src && (
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
          style={{
            backgroundImage: `url(${src})`,
            opacity: fadingOut ? 0 : 1,
          }}
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-black/40" />
      <ScreensaverGrid />
    </div>
  );
}

function ScreensaverGrid() {
  const layout = useMemo(() => loadScreensaverLayout(), []);

  // Which widgets are currently on screen. Off by default, in which case every
  // widget shows and all of this is inert.
  const { motion, interval: motionInterval } = useScreensaverMotion();
  const widgetIds = useMemo(
    () => layout.filter((w) => w.visible !== false).map((w) => w.i),
    [layout],
  );
  const [showing, setShowing] = useState<string[]>([]);
  useEffect(() => {
    if (motion === 'off' || widgetIds.length === 0) return;
    // Seed straight to the target rather than fading them in one at a time,
    // which would read as the screensaver loading rather than running.
    setShowing((prev) => {
      let next = prev;
      for (let k = 0; k < showingCount(widgetIds.length); k++) next = rotate(widgetIds, next);
      return next;
    });
    const id = window.setInterval(
      () => setShowing((prev) => rotate(widgetIds, prev)),
      Math.max(4, motionInterval) * 1000,
    );
    return () => window.clearInterval(id);
  }, [motion, widgetIds, motionInterval]);

  // Dissolve is the one effect heavy enough to matter. It is an SVG filter over
  // the widget's real pixels, and its cost scales with AREA — a tile-sized
  // widget is nearly free, a full-screen one is not. Two guards:
  //  - performance mode already strips backdrop-filter as the biggest GPU win
  //    on thin clients; piling a filter onto those same devices is backwards
  //  - reduced motion should never mean "the same effect, still moving"
  // Both fall back to the plain fade rather than to nothing, so the rotation
  // still reads as intentional.
  const { enabled: lowPower } = usePerformanceMode();
  const reduced = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const effect = motion === 'dissolve' && (lowPower || reduced) ? 'smoke' : motion;

  // Only ever one widget on its way out at a time — the rotation swaps one for
  // one — so a single shared filter is enough.
  const [leaving, setLeaving] = useState<{ id: string; t: number } | null>(null);
  const prevShowing = useRef<string[]>([]);
  useEffect(() => {
    const gone = prevShowing.current.find((id: string) => !showing.includes(id));
    prevShowing.current = showing;
    if (effect !== 'dissolve' || !gone) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / DISSOLVE_MS);
      setLeaving({ id: gone, t });
      if (t < 1) raf = requestAnimationFrame(step);
      else setLeaving(null);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [showing, effect]);

  // Only fetch what this overlay actually draws. Called bare, the hook enables
  // every data domain — eleven of them — while the default screensaver layout
  // renders three, and the dashboard underneath is already fetching its own
  // copy of all of it. The overlay used to be up for seconds at a time, so the
  // waste was a burst; it is worth fixing on a display that is never closed.
  //
  // deferRest is off because the screensaver's widget set is fixed for as long
  // as it is mounted, so the usual two-second "enable everything" catch-up has
  // nothing to catch up on and would simply undo the gating.
  const visibleWidgets = useMemo(
    () => new Set(layout.filter((w) => w.visible !== false).map((w) => w.i)),
    [layout],
  );
  const data = useDashboardData(visibleWidgets, { deferRest: false });
  const widgetProps = useMemo(() =>
    buildWidgetProps(
      data,
      async () => null, // no auth in screensaver
      { setShowAddTask: () => {}, setShowAddMessage: () => {}, setShowAddChore: () => {}, setShowAddShopping: () => {} },
      '',
    ),
  [data]);

  const renderWidget = (w: WidgetConfig) => {
    const reg = WIDGET_REGISTRY[w.i];
    if (!reg) return null;
    const Component = reg.component;
    const rawProps = { ...widgetProps[w.i] || {}, gridW: w.w, gridH: w.h };
    // Strip interactive callbacks — screensaver widgets are display-only
    const {
      onAddClick, onAddMeal, onListChange, onItemToggle, onTaskToggle,
      onChoreComplete, onEventClick, onMessageClick, onDeleteClick,
      onMarkCooked, onUnmarkCooked,
      ...props
    } = rawProps as Record<string, unknown>;
      // Arriving and leaving are not mirror images. A widget appears at once and
      // then settles (easeOutExpo); it holds a moment and then goes quickly
      // (easeInExpo). A symmetric fade reads as a crossfade between slides,
      // which is precisely what this should not feel like.
      const on = effect === 'off' || showing.includes(w.i);
      let fade: React.CSSProperties = {};
      if (effect === 'smoke'){
        // Arriving and leaving are not mirror images. It appears at once and
        // then settles (easeOutExpo); it holds a moment and then goes quickly
        // (easeInExpo). A symmetric fade reads as a crossfade between slides.
        fade = {
          opacity: on ? 1 : 0,
          transition: `opacity ${on ? 2.4 : 3.2}s ${on ? 'cubic-bezier(.16,1,.3,1)' : 'cubic-bezier(.7,0,.84,0)'}`,
        };
      } else if (effect === 'liquid'){
        // A level rather than a fade: the widget is uncovered from the bottom
        // as the vessel fills, using a soft-edged mask so the waterline is a
        // band rather than a hard line.
        //
        // The waterline is moved with mask-POSITION, not by re-declaring the
        // gradient. Chromium does not interpolate between two different
        // linear-gradient() values, so animating mask-image snaps from one to
        // the other in a single frame — with an opacity transition alongside
        // it, that looks exactly like a plain cross-fade, which is what this
        // mode did before. mask-position is a length and animates properly.
        //
        // The gradient is drawn at twice the widget's height: its lower half is
        // opaque, its upper half is clear, and sliding it from one end to the
        // other carries the waterline across the whole widget.
        const mask = 'linear-gradient(to top, #000 0%, #000 46%, transparent 56%, transparent 100%)';
        fade = {
          WebkitMaskImage: mask, maskImage: mask,
          WebkitMaskSize: '100% 200%', maskSize: '100% 200%',
          WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
          // 0% shows the clear top half (empty); 100% shows the opaque bottom
          // half (full).
          WebkitMaskPosition: on ? '0% 100%' : '0% 0%',
          maskPosition: on ? '0% 100%' : '0% 0%',
          transition: 'mask-position 3.4s cubic-bezier(.45,.05,.55,.95), '
                    + '-webkit-mask-position 3.4s cubic-bezier(.45,.05,.55,.95)',
          // Opacity stays put: a fade running at the same time as the level
          // hides the very thing this mode exists to show.
          opacity: 1,
        };
      } else if (effect === 'dissolve'){
        // The widget on its way out is handed to the SVG filter, which erodes
        // its real pixels into fragments. Arrivals stay a plain fade — two
        // competing effects at once reads as a glitch, not a transition.
        const going = leaving?.id === w.i;
        fade = going
          ? { filter: `url(#${DISSOLVE_ID})`, opacity: 1 }
          : { opacity: on ? 1 : 0,
              transition: on ? 'opacity 2.2s cubic-bezier(.16,1,.3,1)' : 'none' };
      }
    return (
      <React.Suspense fallback={<div className="flex items-center justify-center h-full opacity-50 text-sm">Loading...</div>}>
          <div
            style={fade}
            className="h-full w-full [&_*:not([data-keep-bg])]:!bg-transparent [&_.bg-card]:!bg-white/10 [&_.border-border]:!border-white/20"
          >
          <Component {...props} />
        </div>
      </React.Suspense>
    );
  };

  // Screensavers float over the wallpaper/photos, so widgets need transparent
  // backgrounds and LIGHT text — otherwise dark widget text/borders vanish on a
  // dark background (the CssGridDisplay text-color override alone doesn't reach
  // widget content that uses its own Tailwind text classes). Force it here, with
  // a soft shadow so it stays legible over bright photos too.
  const renderScreensaverWidget = (w: WidgetConfig) => (
    <div className={SCREENSAVER_WIDGET_CLASS}>
      {renderWidget(w)}
    </div>
  );

  return (
    // Scope calendar prefs to 'screensaver' so the screensaver's calendar keeps
    // its own view/display settings, independent of the dashboard calendar.
    <CalendarPrefsScopeContext.Provider value="screensaver">
      {effect === 'dissolve' && <DissolveFilter progress={leaving?.t ?? 0} />}
      <CssGridDisplay
        layout={layout}
        renderWidget={renderScreensaverWidget}
        margin={4}
        containerPadding={12}
        cols={GRID_COLS}
        containMode
        headerOffset={0}
        className="w-full h-full"
      />
    </CalendarPrefsScopeContext.Provider>
  );
}

export { ScreensaverGrid };
