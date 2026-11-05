'use client';

import { PhotoCaption } from '@/components/layout/PhotoCaption';
import { focalOf } from '@/lib/photos/focalPoint';
import { CENTRED, photoFrame } from '@/lib/photos/frame';
import { coveredRects } from '@/lib/photos/frameDom';
import { PhotoStage } from '@/components/layout/PhotoStage';
import * as SunCalc from 'suncalc';
import { isTodayNight } from '@/lib/today/night';
import { usePhotoTone } from '@/components/layout/WallpaperBackground';
import { waterVars } from '@/lib/design/water';
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
import { hidesWhenEmpty } from '@/components/layout/grid/hideWhenEmpty';
import { shouldShowScreensaver } from './shouldShowScreensaver';
import { rotate, showingCount } from './screensaverRotation';
import { useScreensaverMotion } from './useScreensaverMotion';
import { WidgetStage } from './WidgetStage';
import { EffectStage } from './EffectStage';
import { ScreensaverQuickSettings } from './ScreensaverQuickSettings';
import { getEffect } from './effects';
import { scaledDuration } from './screensaverPrefs';
import { useAutoPerformance, usePerformanceModeOn } from '@/lib/hooks/usePerformanceMode';
import { useScreenSafeZones } from '@/lib/hooks/useScreenSafeZones';
import { useViewportSize } from '@/lib/hooks/useViewportSize';
import { setDisplayIdle } from '@/lib/hooks/useDisplayIdle';
import { PollingScopeContext } from '@/lib/hooks/pollingScope';
import { useResetOn } from '@/lib/hooks/useResetOn';
import { useIdleSource, useSkyLocation } from './useIdleBackground';
import { setCalmIdle, useActiveIdleBackground } from './calmMode';
import { needsLocation } from '@/lib/idleBackground';
import { IdleDim } from './idleDim';

// Only displays that choose the sky load its star catalogue.
const NightSky = React.lazy(() => import('./nightSky/NightSky').then((m) => ({ default: m.NightSky })));

/**
 * Wrapper classes that make any dashboard widget legible as a screensaver
 * overlay: transparent backgrounds (wallpaper shows through), a faint frosted
 * card, light borders, and — the important part — forced white text with a soft
 * shadow so nothing goes dark-on-dark (or washes out over a bright photo).
 * Shared by the live screensaver and the editor's screensaver preview.
 */
export const SCREENSAVER_WIDGET_CLASS =
  'h-full w-full ' +
  '**:bg-transparent! [&_.bg-card]:bg-white/10! [&_.border-border]:border-white/20! ' +
  // Force white text for legibility over the photo — EXCEPT elements marked
  // data-keep-color (e.g. the birthdays "days until" urgency coloring), which
  // keep their own color but still get the shadow.
  '[&_*:not([data-keep-color])]:text-(--ss-ink)! **:[text-shadow:0_1px_4px_rgba(0,0,0,0.75)]';

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
  const idle = shouldShowScreensaver({ idle: idleNow, away: isAway, babysitter: isBabysitter });
  // What shows behind it (#782), which can change with the time of day. When
  // it is the dashboard itself (calm mode, #691) this decides when, and the
  // dashboard does the showing, so there is no overlay to put up.
  const background = useActiveIdleBackground();
  const { lat, lon, eclipse } = useSkyLocation(needsLocation(background));
  const source = useIdleSource(background, lat, lon, idle);
  const calm = source === 'dashboard';
  const showSky = source === 'sky';
  const isIdle = idle && !calm;
  useEffect(() => {
    setCalmIdle(idle && calm);
    return () => setCalmIdle(false);
  }, [idle, calm]);
  // Going idle and waking are the fades Auto performance times.
  useAutoPerformance(idle);
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
  // Tell the polling layer the display is covered. On a wall-mounted screen
  // this is the only pause signal that ever fires: document.hidden cannot,
  // because the tab is never hidden. See useDisplayIdle. A calm display is
  // never covered: its dashboard is what the idle screen shows, so it keeps
  // refreshing.
  useEffect(() => {
    setDisplayIdle(isIdle);
    return () => setDisplayIdle(false);
  }, [isIdle]);

  const [visible, setVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Only rotate if no pinned photo and interval is not "never" (0)
  useEffect(() => {
    if (!isIdle || showSky || photos.length <= 1 || pinnedId || screensaverInterval === 0) return;
    // The photo stage crossfades to the next one (#954).
    const timer = setInterval(() => setCurrentIndex((i) => (i + 1) % photos.length), screensaverInterval * 1000);
    return () => clearInterval(timer);
  }, [isIdle, showSky, photos.length, pinnedId, screensaverInterval]);

  // Fade in a tick after it mounts; start over transparent each time it ends.
  useResetOn(isIdle, () => {
    if (!isIdle) setVisible(false);
  });
  useEffect(() => {
    if (!isIdle) return;
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, [isIdle]);

  // Use pinned photo if set, otherwise use rotating photos. None at all under
  // the sky, so it loads nothing for as long as it is up.
  const src = showSky ? '' : pinnedId
    ? `/api/photos/${pinnedId}/file`
    : photos[currentIndex]
      ? `/api/photos/${photos[currentIndex]!.id}/file`
      : '';

  // Night ink from the place's sun, or 8 pm to 6 am without a place (#929).
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const sunTimes = lat !== undefined && lon !== undefined ? SunCalc.getTimes(new Date(nowTick), lat, lon) : null;
  const night = isTodayNight(new Date(nowTick), sunTimes?.sunrise ?? undefined, sunTimes?.sunset ?? undefined);
  const tone = usePhotoTone(isIdle && src ? src : null);
  const shadeVars = waterVars(tone, 0.25);

  // Over both idle screens, so it is outside the overlay below and stays
  // mounted while a calm dashboard is idle. Same place in both returns, so it
  // keeps its state and eases out on waking.
  const dim = <IdleDim idle={idle} />;
  if (!isIdle) return <>{dim}{null}</>;


  return (
    <>
      {dim}
      <div
        className={`fixed inset-0 z-9999 bg-black transition-opacity duration-1000 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        // Today's materials (#929): one ink, warm after dusk, and the shades
        // under the corners and the foot solved for this photo.
        style={{ '--ss-ink': night ? 'rgb(255 226 190)' : 'white', ...shadeVars } as React.CSSProperties}
        data-screensaver-night={night || undefined}
      >
        {/* Decorative layers are absolutely positioned, so in CSS paint order they
            sit ABOVE the (statically-positioned) widget grid and would swallow every
            tap. pointer-events-none lets taps fall through to the widgets — needed
            for the calendar view controls to be operable on the screensaver. */}
        {src && (
          <PhotoStage
            src={src}
            frameFor={(url) => {
              // Frame the subject clear of the screensaver's widgets (#957).
              const p = pinnedId ? undefined : photos.find((x) => url.endsWith(`/${x.id}/file`));
              if (!p?.width || !p.height) return CENTRED;
              return photoFrame({ aspect: p.width / p.height, screen: { width: window.innerWidth, height: window.innerHeight }, covered: coveredRects(), focal: focalOf(p) });
            }}
            zoomMs={pinnedId || screensaverInterval === 0 ? 0 : screensaverInterval * 1000}
          />
        )}
        {showSky ? (
          <React.Suspense fallback={null}>
            <NightSky lat={lat} lon={lon} eclipse={eclipse} />
          </React.Suspense>
        ) : (
          // A light dim over the photo, and the shades only where text sits,
          // as on the wall (#799, #929). The sky is already dark where it matters.
          <>
            <div className="pointer-events-none absolute inset-0 bg-black/25" />
            <div
              className="pointer-events-none absolute inset-0"
              data-screensaver-shade
              style={{ backgroundImage: [
                'radial-gradient(45% 40% at 0% 0%, rgb(0 0 0 / var(--ds-shade-tl, 0.35)), transparent)',
                'radial-gradient(45% 40% at 100% 0%, rgb(0 0 0 / var(--ds-shade-tr, 0.35)), transparent)',
                'linear-gradient(to top, rgb(0 0 0 / var(--ds-shade-bottom, 0.35)), transparent 35%)',
              ].join(', ') }}
            />
            {/* When it was taken, and where if shown (#958). */}
            <PhotoCaption photo={pinnedId ? { id: pinnedId, takenAt: null } : photos[currentIndex] ? { id: photos[currentIndex]!.id, takenAt: photos[currentIndex]!.takenAt } : null} />
          </>
        )}
        {/* Scoped from out here rather than inside ScreensaverGrid: the grid
            calls useDashboardData in its own body, which reads context from
            where the grid SITS, not from what it renders. */}
        <PollingScopeContext.Provider value="screensaver">
          <ScreensaverGrid />
        </PollingScopeContext.Provider>
        <ScreensaverQuickSettings />
      </div>
    </>
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
  // The editor's Screen frame for this screen's orientation: what the layout
  // was sized against, so it is what gets fitted to the screen.
  const { zones } = useScreenSafeZones();
  const { width: vw, height: vh } = useViewportSize();
  const screenFrame = zones[vw >= vh ? 'landscape' : 'portrait'][0];

  // Which widgets are currently on screen. Off by default, in which case every
  // widget shows and all of this is inert.
  const { motion, interval: motionInterval, floor, ceiling, outlines, drift, waterClear, ready } = useScreensaverMotion();
  // Widgets showing their empty state. One set to hide when empty (on by
  // default here, #738) sits out the rotation too, or it would take a turn and
  // leave a gap where it should have been.
  const [emptyIds, setEmptyIds] = useState<ReadonlySet<string>>(() => new Set());
  const widgetIds = useMemo(
    () => layout
      .filter((w) => w.visible !== false && !(emptyIds.has(w.i) && hidesWhenEmpty(w, true)))
      .map((w) => w.i),
    [layout, emptyIds],
  );

  /** Horizontal centre of each widget, so a pour can find a partner across the
   *  board rather than directly above or below it. */
  const colOf = useMemo(() => {
    const cols = new Map(layout.map((w) => [w.i, w.x + w.w / 2]));
    return (id: string) => cols.get(id) ?? 0;
  }, [layout]);
  const [showing, setShowing] = useState<string[]>([]);
  /** Last widget to arrive, so the next pour picks someone else. */
  const lastIn = useRef<string | undefined>(undefined);

  // Fireworks is the one effect heavy enough to matter: it rasterises the
  // widget and then draws thousands of particles, and its cost scales with
  // area. Performance mode already strips backdrop-filter as the biggest GPU
  // win on thin clients, so handing those same displays a particle system would
  // be backwards. Both it and prefers-reduced-motion fall back to the plain
  // fade rather than to nothing, so the rotation still reads as intentional.
  const lowPower = usePerformanceModeOn();
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
        const next = rotate(widgetIds, prev, Math.random, floor, ceiling, colOf, lastIn.current);
        lastIn.current = next.find((id) => !prev.includes(id)) ?? lastIn.current;
        count = next.length;
        return next;
      });
      timer = window.setTimeout(step, count >= target ? gap : ARRIVAL_GAP);
    }, FIRST);

    return () => window.clearTimeout(timer);
  }, [motion, effect, widgetIds, motionInterval, floor, ceiling, colOf]);


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

  // Nothing at all until the display's own settings have been read.
  //
  // These live in localStorage, which cannot be read while rendering, so for
  // one paint every value is still its default — and the default for motion is
  // 'off', which means "show every widget". The board therefore came up full
  // and then, as the real setting arrived, all of it drained away at once. The
  // effects are at their most visible in the first second of the screensaver,
  // and that second was being spent undoing a board that should never have
  // been drawn.
  //
  // Holding the grid back costs one frame. With motion off the widgets appear
  // a frame later than they used to, which is not perceptible; with an effect
  // on, the screensaver opens empty and fills itself the way it is meant to.
  if (!ready) return null;

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
    return (
      <React.Suspense fallback={<div className="flex items-center justify-center h-full opacity-50 text-sm">Loading...</div>}>
        <WidgetStage
          id={w.i}
          effect={effect}
          shown={on}
          className={'h-full w-full prism-screensaver-flat '
            // Only the waterline cuts into a widget, so only it needs the room.
            + (waterClear && motion === 'liquid' ? 'prism-water-clear ' : '') + '[&_*:not([data-keep-bg])]:bg-transparent! [&_.bg-card]:bg-white/10! '
            + (outlines
              ? '[&_.border-border]:border-white/20!'
              // Only the perimeter — see .prism-no-outline in globals.css. This
              // was `**:border-transparent!`, which is every element in the
              // widget: it wiped the rules between table rows and left the
              // outline of the card, the exact opposite of what it says.
              : 'prism-no-outline')}
          prepare={giveItBody}
        >
          <Component {...props} />
        </WidgetStage>
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
        screenFrame={screenFrame}
        headerOffset={0}
        drift={drift}
        hideEmptyByDefault
        onEmptyChange={setEmptyIds}
        className="w-full h-full"
      />
      </EffectStage>
    </CalendarPrefsScopeContext.Provider>
  );
}

export { ScreensaverGrid };
