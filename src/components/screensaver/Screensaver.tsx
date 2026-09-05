'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
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
import { WidgetStage } from './WidgetStage';
import { EffectStage } from './EffectStage';
import { ScreensaverQuickSettings } from './ScreensaverQuickSettings';
import { getEffect } from './effects';
import { scaledDuration } from './screensaverPrefs';
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
      <ScreensaverQuickSettings />
    </div>
  );
}

/**
 * Give the snapshot a body — a round one.
 *
 * A screensaver widget is about 97% transparent pixels, so an effect that
 * throws the widget's own pixels has almost nothing to throw. The obvious fix
 * was a flat translucent fill across the card, and it worked, but it also meant
 * every pixel inside a rectangle had something to throw: the burst was visibly
 * a rectangle coming apart, whatever the sampling did afterwards.
 *
 * So the material is a radial wash instead — strongest in the middle, gone
 * before the corners. The mass that leaves is round because the material is
 * round, and it is only roughly round, because the widget's own text and icons
 * are still in there being their own shape. The card's own fill is dropped for
 * the same reason it is dropped on screen.
 *
 * This runs on the snapshot only, so what you are reading is unchanged.
 */
function giveItBody(clone: HTMLElement) {
  const cards = clone.querySelectorAll<HTMLElement>('[class*="bg-card"]');
  const targets = cards.length ? Array.from(cards) : [clone];
  for (const el of targets) {
    el.style.setProperty('background-color', 'transparent', 'important');
    el.style.setProperty(
      'background-image',
      'radial-gradient(ellipse 58% 58% at 50% 50%, '
        + 'rgba(255,255,255,0.42) 0%, '
        + 'rgba(255,255,255,0.30) 30%, '
        + 'rgba(255,255,255,0.12) 62%, '
        + 'rgba(255,255,255,0) 88%)',
      'important',
    );
    el.style.setProperty('border-color', 'transparent', 'important');
    el.style.setProperty('box-shadow', 'none', 'important');
  }
}

function ScreensaverGrid() {
  const layout = useMemo(() => loadScreensaverLayout(), []);

  // Which widgets are currently on screen. Off by default, in which case every
  // widget shows and all of this is inert.
  const { motion, interval: motionInterval, floor, ceiling, outlines, drift } = useScreensaverMotion();
  const widgetIds = useMemo(
    () => layout.filter((w) => w.visible !== false).map((w) => w.i),
    [layout],
  );
  const [showing, setShowing] = useState<string[]>([]);

  // Fireworks is the one effect heavy enough to matter: it rasterises the
  // widget and then draws thousands of particles, and its cost scales with
  // area. Performance mode already strips backdrop-filter as the biggest GPU
  // win on thin clients, so handing those same displays a particle system would
  // be backwards. Both it and prefers-reduced-motion fall back to the plain
  // fade rather than to nothing, so the rotation still reads as intentional.
  const { enabled: lowPower } = usePerformanceMode();
  const reduced = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const motionId = motion === 'fireworks' && (lowPower || reduced) ? 'fade' : motion;
  const effect = motionId === 'off' ? null : getEffect(motionId);
  useEffect(() => {
    if (motion === 'off' || widgetIds.length === 0) return;
    // The board arrives empty and fills itself, one widget at a time.
    //
    // This used to seed straight to the target, on the reasoning that fading
    // them in one by one would read as the screensaver loading rather than
    // running. In practice the opposite is true: every widget appearing at once
    // is indistinguishable from them having always been there, and the whole
    // point of an effect is lost at the moment you are most likely to be
    // watching — the second the screensaver comes up.
    //
    // rotate() fills before it swaps, so the same call does both jobs; only the
    // gap between calls changes once the board is full.
    const target = showingCount(widgetIds.length, floor, ceiling);

    // A rotation must not start before the last one has finished. Fireworks
    // takes twenty-two seconds to leave; with the interval set shorter than
    // that, every swap interrupted the one before it, transitions piled up and
    // no widget was ever handed back to its resting state. The setting is a
    // minimum gap between changes, not a promise to change that often.
    const settle = effect ? Math.ceil((scaledDuration(effect.durationMs.out) + 900) / 1000) : 0;
    const gap = Math.max(4, motionInterval, settle) * 1000;
    // How long to wait between the widgets that fill the board at the start.
    //
    // Nine hundred milliseconds is a pleasant cascade for effects that do not
    // mind overlapping. A pour does mind: at ten seconds a transition and a
    // widget arriving every nine hundred milliseconds, eleven of them run at
    // once and the board is a wall of moving water. For those, each arrival
    // waits for the last one to finish.
    const ARRIVAL_GAP = effect?.pairedTransitions
      ? scaledDuration(effect.durationMs.in) + 300
      : 900;
    const FIRST = 600;

    let count = 0;
    let timer = window.setTimeout(function step() {
      setShowing((prev) => {
        const next = rotate(widgetIds, prev, Math.random, floor, ceiling);
        count = next.length;
        return next;
      });
      timer = window.setTimeout(step, count >= target ? gap : ARRIVAL_GAP);
    }, FIRST);

    return () => window.clearTimeout(timer);
  }, [motion, effect, widgetIds, motionInterval, floor, ceiling]);


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
      const on = !effect || showing.includes(w.i);
    // Every widget on its own schedule. Drifting in lockstep would move the
    // whole board as one object, which is both obvious and useless — the
    // relationship between widgets is exactly what would stay burned in.
    // Derived from the widget's id so it is stable across renders.
    let hash = 0;
    for (let i = 0; i < w.i.length; i++) hash = (hash * 31 + w.i.charCodeAt(i)) % 997;
    const driftPhase = -(hash % 60);

    return (
      <React.Suspense fallback={<div className="flex items-center justify-center h-full opacity-50 text-sm">Loading...</div>}>
        <div
          className={drift === 'off' ? 'h-full w-full' : `h-full w-full prism-drift-${drift}`}
          style={drift === 'off' ? undefined : { animationDelay: `${driftPhase}s` }}
        >
        <WidgetStage
          id={w.i}
          effect={effect}
          shown={on}
          className={'h-full w-full prism-screensaver-flat [&_*:not([data-keep-bg])]:!bg-transparent [&_.bg-card]:!bg-white/10 '
            + (outlines
              ? '[&_.border-border]:!border-white/20'
              // Only the perimeter — see .prism-no-outline in globals.css. This
              // was `[&_*]:!border-transparent`, which is every element in the
              // widget: it wiped the rules between table rows and left the
              // outline of the card, the exact opposite of what it says.
              : 'prism-no-outline')}
          prepare={giveItBody}
        >
          <Component {...props} />
        </WidgetStage>
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
      <EffectStage>
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
      </EffectStage>
    </CalendarPrefsScopeContext.Provider>
  );
}

export { ScreensaverGrid };
